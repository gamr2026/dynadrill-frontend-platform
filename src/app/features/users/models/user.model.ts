/**
 * Campos "comunes" de un CRUD de usuarios estándar — country_id se omite
 * a propósito (no está claro todavía qué datos guarda Dynadrill de cada
 * usuario, se ajusta cuando el modelo real esté definido). password_hash
 * del ER original nunca se expone al frontend; el formulario maneja
 * "password" en texto plano solo al crear, la app real lo envía por
 * HTTPS y el backend lo hashea.
 */
export interface Role {
  id: number;
  name: string;
  /** Identificador estable del rol (ej. 'conductor') — lo usa el backend para autorización. */
  code?: string;
  description?: string;
}

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
  id: number;
  email: string;
  username: string;
  name: string;
  phone: string;
  roleId: number;
  status: boolean;
  specialty?: OperatorSpecialty;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput extends DatosEmpleado {
  email: string;
  username: string;
  password: string;
  name: string;
  phone: string;
  roleId: number;
  status: boolean;
  specialty?: OperatorSpecialty;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & { password?: string };
