import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { environment } from '@env';

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  /** Identificador estable de rol que usa el backend para autorización. */
  roleCode?: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser | null;
}

const TOKEN_KEY = 'dynadrill_access_token';
const USER_KEY = 'dynadrill_current_user';
const SUPERADMIN_KEY = 'dynadrill_superadmin_real';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly user = signal<AuthenticatedUser | null>(readStoredUser());

  readonly isAuthenticated = computed(() => this.token() !== null);
  readonly currentUser = computed(() => this.user());

  /**
   * La sesión se abrió con una cuenta Superadmin (aunque ahora actúe con otro rol vía `switchRole`) —
   * habilita el selector "Actuar como" del header para recorrer un flujo completo en la demo.
   */
  private readonly superadminReal = signal(localStorage.getItem(SUPERADMIN_KEY) === '1');
  readonly puedeActuarComo = computed(() => this.isAuthenticated() && this.superadminReal());

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap(({ accessToken, user }) => {
          this.setSession(accessToken, user);
          this.marcarSuperadminReal(user?.roleName === 'Superadmin');
        }),
      );
  }

  logout(): void {
    this.setSession(null, null);
    this.marcarSuperadminReal(false);
  }

  private marcarSuperadminReal(valor: boolean): void {
    this.superadminReal.set(valor);
    if (valor) localStorage.setItem(SUPERADMIN_KEY, '1');
    else localStorage.removeItem(SUPERADMIN_KEY);
  }

  /**
   * Cambia el rol de la sesión sin re-login. Usado en la demo del flujo de
   * Pumping/FCR: al avanzar un paso se pasa al rol que actúa el siguiente.
   *
   * Pide al backend un token nuevo emitido con ese rol (`POST
   * /api/auth/switch-role`, gated por `DEV_ROLE_SWITCH`) — así los guards de
   * autorización del backend ven el rol correcto. Si el backend lo rechaza
   * (flag apagado / offline), cae al cambio solo-cliente para no romper la
   * demo visual.
   */
  switchRole(roleName: string, roleId: number): void {
    const current = this.user();
    if (!current) return;

    this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/switch-role`, { roleId })
      .pipe(
        catchError(() => {
          const updated: AuthenticatedUser = { ...current, roleName, roleId };
          this.user.set(updated);
          localStorage.setItem(USER_KEY, JSON.stringify(updated));
          return of(null);
        }),
      )
      .subscribe(res => {
        if (res) this.setSession(res.accessToken, res.user);
      });
  }

  getToken(): string | null {
    return this.token();
  }

  private setSession(token: string | null, user: AuthenticatedUser | null): void {
    this.token.set(token);
    this.user.set(user);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }
}

function readStoredUser(): AuthenticatedUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthenticatedUser;
  } catch {
    // localStorage corrupto (escritura parcial, versión anterior con otro shape, etc.)
    // — tratarlo como "sin sesión" en vez de tumbar el bootstrap de toda la app.
    localStorage.removeItem(USER_KEY);
    return null;
  }
}
