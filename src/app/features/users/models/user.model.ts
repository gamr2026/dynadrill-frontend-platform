/**
 * Campos "comunes" de un CRUD de usuarios estándar — country_id se omite
 * a propósito (no está claro todavía qué datos guarda Dynadrill de cada
 * usuario, se ajusta cuando el modelo real esté definido). password_hash
 * del ER original nunca se expone al frontend; el formulario maneja
 * "password" en texto plano solo al crear, la app real lo envía por
 * HTTPS y el backend lo hashea.
 */
export interface Role {
  /** UUID del backend de identidad (plataforma). */
  id: string;
  /**
   * TRANSICIÓN (puente de ids): id numérico que el rol tenía en el backend demo. Se retira cuando los
   * módulos viejos (pedidos, FCR, pumping, mantenimiento...) migren al backend nuevo.
   */
  legacyId?: number | null;
  name: string;
  /** Identificador estable del rol (ej. 'conductor') — lo usa el backend para autorización. */
  code: string;
  description?: string | null;
}

/** Usuario activo de un rol, tal como lo devuelve `GET /api/roles/:code/usuarios`. */
export interface UsuarioPorRol {
  /** UUID del backend de identidad. */
  id: string;
  /** TRANSICIÓN (puente de ids): id numérico del usuario en la demo; `null` si no se migró desde ella. */
  legacyId: number | null;
  name: string;
  specialty: OperatorSpecialty | null;
}

/**
 * TRANSICIÓN (puente de ids): los módulos viejos (backend demo) identifican a las personas con id numérico.
 * Mapea a `{ id: legacyId, name, specialty }` y descarta a quien no tenga `legacyId` — enviarle a la demo un
 * id inexistente asignaría trabajo a nadie. Se retira cuando el módulo consumidor migre al backend nuevo.
 */
export function conIdLegacy(usuarios: UsuarioPorRol[]): { id: number; name: string; specialty: OperatorSpecialty | null }[] {
  return usuarios.flatMap(u => (u.legacyId == null ? [] : [{ id: u.legacyId, name: u.name, specialty: u.specialty }]));
}

/** Vínculo de la persona con Dynadrill. Lo valida el backend (`CHECK` en la base de datos). */
export type TipoVinculo = 'empleado' | 'contratista' | 'externo';

/** Solo aplica a usuarios con rol "Operador de Mantenimiento" — decide a qué sub-órdenes puede asignarse. */
export type OperatorSpecialty = 'Mecánico' | 'Instrumental';

/**
 * Datos de RRHH (campos_empleado.xlsx) — todos opcionales a propósito:
 * enriquecen el perfil de un usuario existente sin exigir que cada alta
 * los complete, y ningún flujo actual (login, roles, asignación de
 * sub-órdenes) depende de ellos. `empleadoActivo` es DELIBERADAMENTE
 * distinto de `status`: `status` es acceso al sistema (¿puede iniciar
 * sesión?), `empleadoActivo` es situación laboral real (¿sigue
 * contratado?) — un empleado que salió de la empresa puede seguir
 * "Activo" en el sistema por un tiempo mientras se procesa la baja, y
 * viceversa, un usuario puede estar desactivado en el sistema sin que
 * eso signifique que dejó la empresa.
 */
export interface DatosEmpleado {
  cedula?: string;
  tipoIdentificacion?: string;
  nacionalidad?: string;
  apellidos?: string;
  nombres?: string;
  cargo?: string;
  departamento?: string;
  area?: string;
  /** ISO. */
  fechaIngreso?: string;
  /** ISO, null = sigue activo. */
  fechaSalida?: string | null;
  causaSalidaEmpleado?: string;
  tipoContrato?: string;
  sucursal?: string;
  tipoDiscapacidad?: string;
  cargasActivas?: number;
  categoria?: string;
  centroCosto?: string;
  empleadoActivo?: boolean;
}

export interface User extends DatosEmpleado {
  /** UUID del backend de identidad. */
  id: string;
  /** TRANSICIÓN (puente de ids): id numérico en la demo (`null` si el usuario nació en el backend nuevo). */
  legacyId?: number | null;
  email: string;
  username: string;
  name: string;
  phone: string;
  roleId: string;
  status: boolean;
  /** Por defecto `empleado`. */
  tipoVinculo?: TipoVinculo;
  specialty?: OperatorSpecialty | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput extends DatosEmpleado {
  email: string;
  username: string;
  password: string;
  name: string;
  phone: string;
  roleId: string;
  status: boolean;
  /** Opcional: si se omite, el backend usa `empleado`. */
  tipoVinculo?: TipoVinculo;
  specialty?: OperatorSpecialty;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & { password?: string };
