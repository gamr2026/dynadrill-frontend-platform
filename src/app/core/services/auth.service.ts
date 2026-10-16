import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '@env';

export interface AuthenticatedUser {
  /** UUID del backend de identidad. */
  id: string;
  /**
   * TRANSICIÓN (puente de ids): id numérico que el usuario tenía en el backend demo. Los módulos viejos
   * (pedidos, FCR, pumping, mantenimiento...) siguen identificando personas con ese id; usar `AuthService.legacyUserId`.
   * Se retira cuando esos módulos migren al backend nuevo.
   */
  legacyId: number | null;
  name: string;
  email: string;
  /** UUID del rol. */
  roleId: string;
  /** TRANSICIÓN (puente de ids): id numérico del rol en la demo. */
  roleLegacyId: number | null;
  roleName: string;
  /** Identificador estable de rol que usa el backend para autorización. */
  roleCode: string;
  /** Códigos de permiso (`modulo.recurso.accion`) del rol efectivo; viajan en el token y se refrescan con cada renovación. */
  permissions: string[];
  /** La persona debe elegir su propia clave antes de usar el sistema (cuenta con clave provisional). */
  mustChangePassword?: boolean;
}

/** Respuesta de `POST /auth/login` y `POST /auth/refresh`. */
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  /** Vigencia del access token, en segundos. */
  expiresIn: number;
  user: AuthenticatedUser;
}

/** Respuesta de `POST /auth/switch-role`: token corto de impersonación, sin refreshToken. */
interface SwitchRoleResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
}

/** Rol con el que se está "actuando" (selector del header / auto-switch de la demo) y, opcionalmente, la persona. */
interface ActuandoComo {
  roleName: string;
  roleCode: string;
  /** TRANSICIÓN (puente de ids): id numérico (demo) de la persona elegida; `null` = se actúa solo como el rol. */
  legacyUserId: number | null;
}

const TOKEN_KEY = 'dynadrill_access_token';
const REFRESH_TOKEN_KEY = 'dynadrill_refresh_token';
const EXPIRES_AT_KEY = 'dynadrill_access_token_expires_at';
const USER_KEY = 'dynadrill_current_user';
const SUPERADMIN_KEY = 'dynadrill_superadmin_real';
const SUPERADMIN_ID_KEY = 'dynadrill_superadmin_real_id';
const ACTING_KEY = 'dynadrill_acting_as';

const SUPERADMIN_ROLE_CODE = 'superadmin';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly stored = readStoredSession();
  private readonly token = signal<string | null>(this.stored.token);
  private readonly user = signal<AuthenticatedUser | null>(this.stored.user);
  private readonly refreshToken = signal<string | null>(this.stored.refreshToken);
  private readonly expiresAtMs = signal<number | null>(this.stored.expiresAt);
  private readonly actuandoComo = signal<ActuandoComo | null>(this.stored.actuandoComo);

  /** Renovación en curso: todas las peticiones que fallen a la vez comparten la misma (el refresh token es de un solo uso). */
  private refreshEnCurso$: Observable<AuthResponse> | null = null;

  readonly isAuthenticated = computed(() => this.token() !== null);
  readonly currentUser = computed(() => this.user());
  /** Permisos del rol efectivo (vacío sin sesión o con una sesión guardada antes de existir los permisos). */
  readonly permissions = computed<string[]>(() => this.user()?.permissions ?? []);
  private readonly permissionSet = computed(() => new Set(this.permissions()));
  /** Cuenta con clave provisional: solo puede entrar a la pantalla de cambio de clave hasta elegir la suya. */
  readonly mustChangePassword = computed(() => this.user()?.mustChangePassword === true);
  /** Instante (epoch ms) en que vence el access token vigente, o `null` si se desconoce. */
  readonly accessTokenExpiresAt = computed(() => this.expiresAtMs());

  /**
   * TRANSICIÓN (puente de ids): id numérico del usuario actual para los módulos viejos (demo), que comparan
   * contra ids numéricos (`assignedUserId`, etc.). Si se está "actuando como" una persona concreta, es el
   * de esa persona. `null` si el usuario no existe en la demo. Se retira cuando esos módulos migren.
   */
  readonly legacyUserId = computed<number | null>(() => this.actuandoComo()?.legacyUserId ?? this.user()?.legacyId ?? null);

  /**
   * La sesión se abrió con una cuenta Superadmin (aunque ahora actúe con otro rol vía `switchRole`) —
   * habilita el selector "Actuar como" del header para recorrer un flujo completo en la demo.
   */
  private readonly superadminReal = signal(localStorage.getItem(SUPERADMIN_KEY) === '1');
  readonly puedeActuarComo = computed(() => this.isAuthenticated() && this.superadminReal());

  /** Id (UUID) del usuario Superadmin con el que se abrió la sesión — para volver a él tras actuar como otra persona. */
  readonly superadminId = signal<string | null>(localStorage.getItem(SUPERADMIN_ID_KEY) || null);

  /** ¿El rol efectivo tiene este permiso? Es reactivo: leerlo en un `computed`/plantilla lo mantiene al día. */
  can(codigo: string): boolean {
    return this.permissionSet().has(codigo);
  }

  /** ¿Tiene al menos uno de los permisos indicados? Sin códigos devuelve `false`. */
  canAny(...codigos: string[]): boolean {
    return codigos.some(codigo => this.can(codigo));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => {
        this.setSession(res);
        this.actuandoComo.set(null);
        localStorage.removeItem(ACTING_KEY);
        this.marcarSuperadminReal(res.user.roleCode === SUPERADMIN_ROLE_CODE, res.user.id);
      }),
    );
  }

  /**
   * La persona elige su clave. El backend cierra las sesiones anteriores y devuelve una sesión nueva sin la marca
   * de cambio pendiente, que reemplaza a la actual.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/change-password`, { currentPassword, newPassword })
      .pipe(tap(res => this.setSession(res)));
  }

  /** El backend avisó (403 `PASSWORD_CHANGE_REQUIRED`) de un cambio pendiente que la sesión guardada no conocía. */
  marcarCambioClavePendiente(): void {
    const current = this.user();
    if (current && !current.mustChangePassword) this.guardarUsuario({ ...current, mustChangePassword: true });
  }

  /**
   * Cambia el refresh token por un par nuevo (cada refresh token sirve UNA sola vez) y guarda ambos.
   * Es "single-flight": si se pide varias veces mientras hay una en curso, todas comparten la misma
   * petición — disparar N renovaciones en paralelo invalidaría el token de las demás.
   *
   * Si la sesión estaba "actuando como" otro rol, la renovación devuelve la identidad real; se
   * vuelve a pedir el rol impersonado para no revertirlo en silencio.
   */
  refresh(): Observable<AuthResponse> {
    if (this.refreshEnCurso$) return this.refreshEnCurso$;

    const refreshToken = this.refreshToken();
    if (!refreshToken) return throwError(() => new Error('No hay refresh token para renovar la sesión.'));

    const actuando = this.actuandoComo();
    const peticion$ = this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken }).pipe(
      tap(res => this.setSession(res)),
      switchMap(res => (actuando ? this.aplicarRol(actuando.roleName, actuando.roleCode).pipe(map(() => res)) : of(res))),
      finalize(() => (this.refreshEnCurso$ = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.refreshEnCurso$ = peticion$;
    return peticion$;
  }

  /**
   * Cierra la sesión. Si hay refresh token avisa al backend (`POST /auth/logout`, que invalida esa
   * sesión) ignorando cualquier error — salir nunca debe fallar por red. La petición se dispara
   * ANTES de limpiar el estado local para que el interceptor aún adjunte el access token.
   */
  logout(): void {
    const refreshToken = this.refreshToken();
    if (refreshToken) {
      this.http
        .post(`${environment.apiUrl}/auth/logout`, { refreshToken })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.limpiarSesion();
  }

  private limpiarSesion(): void {
    this.setSession(null);
    this.actuandoComo.set(null);
    localStorage.removeItem(ACTING_KEY);
    this.marcarSuperadminReal(false);
  }

  private marcarSuperadminReal(valor: boolean, userId?: string): void {
    this.superadminReal.set(valor);
    this.superadminId.set(valor && userId ? userId : null);
    if (valor) {
      localStorage.setItem(SUPERADMIN_KEY, '1');
      if (userId) localStorage.setItem(SUPERADMIN_ID_KEY, userId);
    } else {
      localStorage.removeItem(SUPERADMIN_KEY);
      localStorage.removeItem(SUPERADMIN_ID_KEY);
    }
  }

  /**
   * Cambia el rol de la sesión sin re-login. Usado en la demo del flujo de
   * Pumping/FCR: al avanzar un paso se pasa al rol que actúa el siguiente.
   *
   * Pide al backend un token nuevo emitido con ese rol (`POST
   * /api/auth/switch-role` por `roleCode`, gated por `DEV_ROLE_SWITCH`) — así los guards de
   * autorización del backend ven el rol correcto. Si el backend lo rechaza
   * (flag apagado / offline), cae al cambio solo-cliente para no romper la
   * demo visual. El token impersonado es corto y NO reemplaza al refresh token guardado.
   *
   * `persona` (opcional): a quién se representa dentro del rol (p. ej. qué operador de mantenimiento).
   * El backend nuevo no la conoce, así que solo afecta a `legacyUserId` (vistas de los módulos viejos).
   */
  switchRole(roleName: string, roleCode: string, persona?: { legacyId: number | null }): void {
    if (!this.user()) return;
    const esSuperadmin = roleCode === SUPERADMIN_ROLE_CODE;
    this.aplicarRol(roleName, roleCode).subscribe(() => {
      // Volver a Superadmin descarta la persona: se actúa de nuevo como la cuenta real.
      const actuando: ActuandoComo | null = esSuperadmin ? null : { roleName, roleCode, legacyUserId: persona?.legacyId ?? null };
      this.guardarActuandoComo(actuando);
    });
  }

  /** Pide el token impersonado; si el backend no lo concede, aplica el rol solo en el cliente. Nunca falla. */
  private aplicarRol(roleName: string, roleCode: string): Observable<void> {
    return this.http.post<SwitchRoleResponse>(`${environment.apiUrl}/auth/switch-role`, { roleCode }).pipe(
      tap(res => {
        // Sin refreshToken a propósito: el que ya está guardado sigue siendo el de la sesión real.
        this.token.set(res.accessToken);
        localStorage.setItem(TOKEN_KEY, res.accessToken);
        this.setExpiracion(res.expiresIn);
        this.guardarUsuario(res.user);
      }),
      map(() => undefined),
      catchError(() => {
        const current = this.user();
        if (current) this.guardarUsuario({ ...current, roleName, roleCode });
        return of(undefined);
      }),
    );
  }

  getToken(): string | null {
    return this.token();
  }

  getRefreshToken(): string | null {
    return this.refreshToken();
  }

  private guardarActuandoComo(actuando: ActuandoComo | null): void {
    this.actuandoComo.set(actuando);
    if (actuando) localStorage.setItem(ACTING_KEY, JSON.stringify(actuando));
    else localStorage.removeItem(ACTING_KEY);
  }

  private guardarUsuario(user: AuthenticatedUser | null): void {
    // Defensivo: un backend que aún no envía `permissions` deja al usuario sin permisos en vez de romper `can()`.
    const normalizado = user ? { ...user, permissions: Array.isArray(user.permissions) ? user.permissions : [] } : null;
    this.user.set(normalizado);
    if (normalizado) localStorage.setItem(USER_KEY, JSON.stringify(normalizado));
    else localStorage.removeItem(USER_KEY);
  }

  private setExpiracion(expiresInSeconds: number | null): void {
    const expiresAt = expiresInSeconds != null ? Date.now() + expiresInSeconds * 1000 : null;
    this.expiresAtMs.set(expiresAt);
    if (expiresAt !== null) localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
    else localStorage.removeItem(EXPIRES_AT_KEY);
  }

  /** Guarda (o, con `null`, borra) la sesión completa que devuelven login y refresh. */
  private setSession(res: AuthResponse | null): void {
    this.token.set(res?.accessToken ?? null);
    this.refreshToken.set(res?.refreshToken ?? null);
    this.setExpiracion(res ? res.expiresIn : null);
    this.guardarUsuario(res?.user ?? null);
    for (const [key, value] of [
      [TOKEN_KEY, res?.accessToken],
      [REFRESH_TOKEN_KEY, res?.refreshToken],
    ] as const) {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    }
  }
}

interface StoredSession {
  token: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  user: AuthenticatedUser | null;
  actuandoComo: ActuandoComo | null;
}

/**
 * Lectura defensiva de la sesión guardada. Una sesión es válida solo si hay token Y un usuario con el
 * shape actual (id UUID string, roleCode): una sesión del backend demo anterior (id numérico) o un
 * localStorage corrupto se descartan por completo en vez de arrancar con un estado a medias.
 */
function readStoredSession(): StoredSession {
  const vacia: StoredSession = { token: null, refreshToken: null, expiresAt: null, user: null, actuandoComo: null };
  const token = localStorage.getItem(TOKEN_KEY);
  const user = readJson<AuthenticatedUser>(USER_KEY);
  if (!token || !user || typeof user.id !== 'string' || typeof user.roleCode !== 'string') {
    // Sesión ausente, incompleta, corrupta o con el shape anterior (ids numéricos) — tratarla como "sin sesión"
    // en vez de tumbar el bootstrap de toda la app.
    for (const key of [TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRES_AT_KEY, USER_KEY, SUPERADMIN_KEY, SUPERADMIN_ID_KEY, ACTING_KEY]) {
      localStorage.removeItem(key);
    }
    return vacia;
  }
  // Una sesión guardada antes de existir los permisos no los trae: se trata como "sin permisos" hasta renovar o volver a entrar.
  user.permissions = Array.isArray(user.permissions) ? user.permissions.filter(p => typeof p === 'string') : [];
  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY));
  const actuando = readJson<ActuandoComo>(ACTING_KEY);
  return {
    token,
    user,
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
    expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null,
    actuandoComo: actuando && typeof actuando.roleCode === 'string' && typeof actuando.roleName === 'string' ? actuando : null,
  };
}

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // localStorage corrupto (escritura parcial, versión anterior con otro shape, etc.).
    localStorage.removeItem(key);
    return null;
  }
}
