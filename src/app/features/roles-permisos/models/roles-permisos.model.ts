import { Role } from '../../users/models/user.model';

export type { Role };

/** Permiso del catálogo fijo (`GET /api/permissions`). */
export interface Permiso {
  id: string;
  /** `<modulo>.<recurso>.<accion>`, p. ej. `qhse.iperc.aprobar`. */
  codigo: string;
  modulo: string;
  recurso: string;
  accion: string;
  descripcion: string;
}

/** Respuesta de `PUT /api/roles/:id/permisos`. */
export interface GuardarPermisosResultado {
  roleId: string;
  permisos: string[];
  otorgados: string[];
  revocados: string[];
}

export interface HistorialPermiso {
  id: string;
  permiso: string;
  accion: 'otorgado' | 'revocado';
  realizadoPor: { id: string; name: string } | null;
  /** ISO 8601. */
  realizadoAt: string;
}

/** Código del rol que nunca puede quedarse sin administración (el backend también lo rechaza con 400). */
export const SUPERADMIN_ROLE_CODE = 'superadmin';

/** Permisos que no se pueden quitar al rol `superadmin`: evitan dejar el sistema sin administrador (el backend responde 400). */
export const PERMISOS_PROTEGIDOS_SUPERADMIN: readonly string[] = [
  'identidad.roles.ver',
  'identidad.roles.editar_permisos',
  'identidad.usuarios.ver',
  'identidad.usuarios.editar',
];

/** Permiso para ver la pantalla; sin `PERMISO_EDITAR_ROLES` la pantalla queda en solo lectura. */
export const PERMISO_VER_ROLES = 'identidad.roles.ver';
export const PERMISO_EDITAR_ROLES = 'identidad.roles.editar_permisos';

/** Acciones estándar: se muestran como columnas de la matriz, en este orden. */
export const ACCIONES_ESTANDAR = ['ver', 'crear', 'editar', 'anular', 'inactivar'] as const;
export type AccionEstandar = (typeof ACCIONES_ESTANDAR)[number];

export const ETIQUETAS_ACCION_ESTANDAR: Record<AccionEstandar, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  anular: 'Anular',
  inactivar: 'Inactivar',
};

/** Permisos del catálogo que pertenecen a un mismo módulo. */
export interface GrupoPermisos {
  modulo: string;
  permisos: Permiso[];
}

/** Agrupa el catálogo por módulo, con módulos y permisos en orden alfabético (estable entre cargas). */
export function agruparPorModulo(catalogo: Permiso[]): GrupoPermisos[] {
  const grupos = new Map<string, Permiso[]>();
  for (const permiso of catalogo) {
    grupos.set(permiso.modulo, [...(grupos.get(permiso.modulo) ?? []), permiso]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([modulo, permisos]) => ({ modulo, permisos: [...permisos].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es')) }));
}

/** Un recurso del módulo: una fila de la matriz (acciones estándar por columna + acciones propias del negocio). */
export interface FilaRecurso {
  recurso: string;
  /** Permiso del catálogo para cada acción estándar, o `null` si el recurso no la tiene. */
  estandar: Record<AccionEstandar, Permiso | null>;
  /** Acciones propias del negocio (`aprobar`, `operar`, `editar_permisos`…), en orden alfabético. */
  otras: Permiso[];
}

const esAccionEstandar = (accion: string): accion is AccionEstandar => (ACCIONES_ESTANDAR as readonly string[]).includes(accion);

/** Agrupa los permisos de un módulo por recurso (orden alfabético). */
export function filasPorRecurso(permisos: Permiso[]): FilaRecurso[] {
  const filas = new Map<string, FilaRecurso>();
  for (const permiso of permisos) {
    let fila = filas.get(permiso.recurso);
    if (!fila) {
      fila = { recurso: permiso.recurso, estandar: { ver: null, crear: null, editar: null, anular: null, inactivar: null }, otras: [] };
      filas.set(permiso.recurso, fila);
    }
    if (esAccionEstandar(permiso.accion)) fila.estandar[permiso.accion] = permiso;
    else fila.otras.push(permiso);
  }
  return [...filas.values()]
    .sort((a, b) => a.recurso.localeCompare(b.recurso, 'es'))
    .map(fila => ({ ...fila, otras: [...fila.otras].sort((a, b) => a.accion.localeCompare(b.accion, 'es')) }));
}

/** "guias_remision" -> "Guias remision"; "editar_permisos" -> "Editar permisos". */
export function textoLegible(texto: string): string {
  const limpio = texto.replace(/[_-]/g, ' ');
  return `${limpio.charAt(0).toUpperCase()}${limpio.slice(1)}`;
}

/** "iperc" + "aprobar" -> "Iperc · aprobar" (nombre legible; el código completo se muestra aparte). */
export function nombrePermiso(permiso: Pick<Permiso, 'recurso' | 'accion'>): string {
  const recurso = permiso.recurso.replace(/[_-]/g, ' ');
  const accion = permiso.accion.replace(/[_-]/g, ' ');
  return `${recurso.charAt(0).toUpperCase()}${recurso.slice(1)} · ${accion}`;
}

/** "qhse" -> "QHSE", "identidad" -> "Identidad": los códigos de módulo cortos son siglas. */
export function nombreModulo(modulo: string): string {
  return modulo.length <= 4 ? modulo.toUpperCase() : `${modulo.charAt(0).toUpperCase()}${modulo.slice(1)}`;
}

/** Extrae el `message` (string o string[]) del cuerpo de error del backend; si no hay, usa el texto por defecto. */
export function mensajeError(err: unknown, porDefecto: string): string {
  const message = (err as { error?: { message?: unknown } } | null)?.error?.message;
  if (Array.isArray(message)) {
    const texto = message.filter(m => typeof m === 'string').join(' ');
    return texto || porDefecto;
  }
  return typeof message === 'string' && message ? message : porDefecto;
}

/** Texto de coincidencia de un rol con la búsqueda (sin tildes ni mayúsculas). */
export function rolCoincide(rol: Pick<Role, 'name' | 'code'>, consulta: string): boolean {
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = normalizar(consulta.trim());
  return q === '' || normalizar(rol.name).includes(q) || normalizar(rol.code).includes(q);
}
