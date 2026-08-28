import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { CreateUserInput, DatosEmpleado, Role, UpdateUserInput, User } from '../../features/users/models/user.model';

/**
 * Solo activo mientras no exista el backend NestJS real de usuarios. Se
 * registra condicionalmente en app.config.ts (isDevMode()) — mismo patrón
 * que auth-mock.interceptor.ts. Borrar este archivo y su registro cuando
 * /api/users y /api/roles existan de verdad.
 */
const roles: Role[] = [
  { id: 1, name: 'Supervisor' },
  { id: 2, name: 'Operador' },
  { id: 3, name: 'Op. Mantenimiento' },
  { id: 4, name: 'Jefe de Base' },
  { id: 5, name: 'Jefe de Mantenimiento' },
  { id: 6, name: 'Operador de Mantenimiento' },
  /**
   * Roles del módulo QHSE (HSE-MASTER-001, sección "Roles y
   * Responsabilidades"). Los tres tienen login propio — a diferencia del
   * Company Man (cliente, queda fuera del sistema) y del personal
   * operativo (que actúa sobre QHSE con sus roles existentes, no con uno
   * nuevo — ver plan de desarrollo del módulo en el proyecto).
   */
  { id: 8, name: 'Técnico HSE' },
  { id: 9, name: 'Coordinador HSE' },
  { id: 10, name: 'Gerente HSE' },
  /** Encargado del módulo Inventario (Artículos + Vehículos) — sin acceso a ningún otro módulo. */
  { id: 11, name: 'Bodeguero' },
  /** Encargado del módulo Facturación (FACT-001 a FACT-005) — sin acceso a ningún otro módulo. */
  { id: 13, name: 'Facturación' },
  /**
   * Acceso total (todos los módulos, incluida Administración) — el único
   * rol que ve Administración. "Jefe de Base" se trata igual (ver
   * sidebar.ts): ya se comportaba como acceso completo antes de que el
   * sidebar pasara a listas explícitas por rol.
   */
  { id: 12, name: 'Superadmin' },
];

/** "dd/mm/yyyy" (formato del Excel de RRHH) → ISO, medianoche UTC. */
function fechaEcuadorToIso(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

/**
 * Datos de RRHH reales (campos_empleado.xlsx, 15 empleados) mapeados
 * 1 a 1 sobre los 14 usuarios de prueba YA existentes — por id, en el
 * mismo orden en que aparecen en el Excel. A propósito NO se tocan
 * username/email/roleId/status/specialty/name: son las credenciales y
 * roles con los que se prueba cada flujo del sistema hoy, cambiarlas
 * habría roto el login y la navegación por rol documentados hasta
 * ahora. Solo se agregan los campos nuevos de DatosEmpleado. El
 * empleado #15 del Excel (CAGUANO ROTO, cédula 0606370815) queda sin
 * usar — solo hay 14 usuarios de prueba para mapear.
 */
const DATOS_EMPLEADO_POR_ID: Record<number, Partial<User>> = {
  1: { cedula: '0401686662', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'CORAL FIERRO', nombres: 'IRVIN DAVID', cargo: 'ESPECIALISTA DE FACTURACIÓN I', departamento: 'ADMINISTRATIVO', area: 'General', fechaIngreso: fechaEcuadorToIso('08/01/2026'), tipoContrato: 'CONTRATO PRODUCTIVO CONTINUO', sucursal: 'QUITO', cargasActivas: 0, categoria: 'Categoria Empleado Asistencial', centroCosto: 'GASTOS ADMINISTRATIVOS', empleadoActivo: true },
  2: { cedula: '0502223423', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'PAEZ VIZCAINO', nombres: 'HERMES FABIAN', cargo: 'OPERADOR DE FLUIDOS', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('01/06/2025'), tipoContrato: 'POR OBRA', sucursal: 'COCA', cargasActivas: 3, categoria: 'Categoria Empleado Asistencial', centroCosto: 'SISTEMAS QUIMICOS', empleadoActivo: true },
  3: { cedula: '0503517310', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'LAICA TULMO', nombres: 'BRYAN FABRICIO', cargo: 'INGENIERO TRAINEE', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('21/05/2025'), tipoContrato: 'POR OBRA', sucursal: 'COCA', cargasActivas: 0, categoria: 'Categoria Empleado Asistencial', centroCosto: 'SISTEMAS QUIMICOS', empleadoActivo: true },
  4: { cedula: '0602016099', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'CUJILEMA CUJILEMA', nombres: 'MANUEL', cargo: 'MECÁNICO SENIOR', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('08/10/2025'), tipoContrato: 'CONTRATO PRODUCTIVO CONTINUO', sucursal: 'COCA', cargasActivas: 0, categoria: 'Categoria Empleado Asistencial', centroCosto: 'CTU - BOMBEO', empleadoActivo: true },
  5: { cedula: '0602033219', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'SAETEROS ANDRADE', nombres: 'CESAR VINICIO', cargo: 'JEFE DE BASE', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('01/06/2025'), tipoContrato: 'POR OBRA', sucursal: 'COCA', cargasActivas: 1, categoria: 'Categoria Empleado Asistencial', centroCosto: '', empleadoActivo: true },
  6: { cedula: '0602471153', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'AUQUILLA SALCAN', nombres: 'LUIS HERNAN', cargo: 'OPERADOR DE FLUIDOS', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('19/05/2025'), tipoContrato: 'POR OBRA', sucursal: 'COCA', cargasActivas: 1, categoria: 'Categoria Empleado Asistencial', centroCosto: 'SISTEMAS QUIMICOS', empleadoActivo: true },
  8: { cedula: '0602909020', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'CACERES VASQUEZ', nombres: 'MONICA ELIZABETH', cargo: 'JEFE DE PRE FACTURACIÓN', departamento: 'ADMINISTRATIVO', area: 'General', fechaIngreso: fechaEcuadorToIso('05/08/2025'), tipoContrato: 'CONTRATO PRODUCTIVO CONTINUO', sucursal: 'QUITO', cargasActivas: 1, categoria: 'Categoria Empleado Asistencial', centroCosto: 'GASTOS ADMINISTRATIVOS', empleadoActivo: true },
  9: { cedula: '0603049586', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'HERNANDEZ VILEMA', nombres: 'FABIAN CLODOVEO', cargo: 'OPERADOR III CTU', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('01/06/2025'), tipoContrato: 'POR OBRA', sucursal: 'COCA', cargasActivas: 2, categoria: 'Categoria Empleado Asistencial', centroCosto: 'CTU - BOMBEO', empleadoActivo: true },
  10: { cedula: '0603055872', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'SAETEROS AMOROZO', nombres: 'DARIO JAVIER', cargo: 'INGENIERO DE VENTAS Y APLICACIONES SR', departamento: 'VTAS', area: 'General', fechaIngreso: fechaEcuadorToIso('01/06/2025'), tipoContrato: 'POR OBRA', sucursal: 'QUITO', cargasActivas: 0, categoria: 'Categoria Empleado Asistencial', centroCosto: 'CTU - BOMBEO', empleadoActivo: true },
  11: { cedula: '0604107870', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'LEMACHE RIVERA', nombres: 'JEFERSON XAVIER', cargo: 'OPERADOR II CTU', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('01/08/2025'), tipoContrato: 'CONTRATO PRODUCTIVO CONTINUO', sucursal: 'COCA', cargasActivas: 0, categoria: 'Categoria Empleado Asistencial', centroCosto: 'CTU - BOMBEO', empleadoActivo: true },
  12: { cedula: '0604792861', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'GUAMAN TOGLLA', nombres: 'JULIO CESAR', cargo: 'AUXILIAR DE OPERACIONES', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('06/10/2025'), tipoContrato: 'CONTRATO PRODUCTIVO CONTINUO', sucursal: 'COCA', cargasActivas: 2, categoria: 'Categoria Empleado Asistencial', centroCosto: 'SISTEMAS QUIMICOS', empleadoActivo: true },
  13: { cedula: '0604800037', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'YEPEZ CAJO', nombres: 'CARLOS ERNESTO', cargo: 'AUXILIAR DE OPERACIONES', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('15/10/2025'), tipoContrato: 'CONTRATO PRODUCTIVO CONTINUO', sucursal: 'COCA', cargasActivas: 1, categoria: 'Categoria Empleado Asistencial', centroCosto: 'SISTEMAS QUIMICOS', empleadoActivo: true },
  14: { cedula: '0605081264', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'LOPEZ LOPEZ', nombres: 'PAULINA ELIZABETH', cargo: 'LABORATORISTA TRAINEE', departamento: 'OPERACIONES', area: 'General', fechaIngreso: fechaEcuadorToIso('22/10/2025'), tipoContrato: 'CONTRATO PRODUCTIVO CONTINUO', sucursal: 'COCA', cargasActivas: 0, categoria: 'Categoria Empleado Asistencial', centroCosto: 'SISTEMAS QUIMICOS', empleadoActivo: true },
  15: { cedula: '0605194489', tipoIdentificacion: 'Cedula', nacionalidad: 'Ecuatoriano', apellidos: 'ROMERO BRAVO', nombres: 'VERÓNICA ALEXANDRA', cargo: 'INGENIERO DE VENTAS Y APLICACIONES', departamento: 'VTAS', area: 'General', fechaIngreso: fechaEcuadorToIso('22/05/2025'), tipoContrato: 'POR OBRA', sucursal: 'QUITO', cargasActivas: 0, categoria: 'Categoria Empleado Asistencial', centroCosto: 'SISTEMAS QUIMICOS', empleadoActivo: true },
};

const BASE_USERS: Omit<User, keyof DatosEmpleado>[] = [
  {
    id: 1,
    email: 'admin@dynadrill.com',
    username: 'admin',
    name: 'Ana Torres',
    phone: '0991234567',
    roleId: 4,
    status: true,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 2,
    email: 'lvega@dynadrill.com',
    username: 'lvega',
    name: 'Luis Vega',
    phone: '0987654321',
    roleId: 1,
    status: true,
    createdAt: '2026-02-03T09:30:00.000Z',
    updatedAt: '2026-02-03T09:30:00.000Z',
  },
  {
    id: 3,
    email: 'mruiz@dynadrill.com',
    username: 'mruiz',
    name: 'Marco Ruiz',
    phone: '0976543210',
    roleId: 2,
    status: false,
    createdAt: '2026-03-11T14:15:00.000Z',
    updatedAt: '2026-05-02T08:45:00.000Z',
  },
  {
    id: 4,
    email: 'jefe.mantenimiento@dynadrill.com',
    username: 'jhidalgo',
    name: 'Jorge Hidalgo',
    phone: '0991112233',
    roleId: 5,
    status: true,
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 5,
    email: 'operador.mecanico@dynadrill.com',
    username: 'dsalazar',
    name: 'Diego Salazar',
    phone: '0992223344',
    roleId: 6,
    status: true,
    specialty: 'Mecánico',
    createdAt: '2026-06-01T08:05:00.000Z',
    updatedAt: '2026-06-01T08:05:00.000Z',
  },
  {
    id: 6,
    email: 'operador.instrumental@dynadrill.com',
    username: 'ncastro',
    name: 'Natalia Castro',
    phone: '0993334455',
    roleId: 6,
    status: true,
    specialty: 'Instrumental',
    createdAt: '2026-06-01T08:10:00.000Z',
    updatedAt: '2026-06-01T08:10:00.000Z',
  },
  {
    id: 8,
    email: 'jefebase@dynadrill.com',
    username: 'jefebase',
    name: 'Carlos Mendoza',
    phone: '0995556677',
    roleId: 4,
    status: true,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 9,
    email: 'supervisor@dynadrill.com',
    username: 'supervisor',
    name: 'Luis Vega',
    phone: '0996667788',
    roleId: 1,
    status: true,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 10,
    email: 'operador@dynadrill.com',
    username: 'operador',
    name: 'Marco Ruiz',
    phone: '0997778899',
    roleId: 2,
    status: true,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 11,
    email: 'tecnico.hse@dynadrill.com',
    username: 'atorres',
    name: 'Ana Torres',
    phone: '0995556677',
    roleId: 8,
    status: true,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 12,
    email: 'coordinador.hse@dynadrill.com',
    username: 'jhidalgo.hse',
    name: 'Jorge Hidalgo',
    phone: '0996667788',
    roleId: 9,
    status: true,
    createdAt: '2026-08-15T08:05:00.000Z',
    updatedAt: '2026-08-15T08:05:00.000Z',
  },
  {
    id: 13,
    email: 'gerente.hse@dynadrill.com',
    username: 'mflores',
    name: 'Mónica Flores',
    phone: '0997778899',
    roleId: 10,
    status: true,
    createdAt: '2026-08-15T08:10:00.000Z',
    updatedAt: '2026-08-15T08:10:00.000Z',
  },
  {
    id: 14,
    email: 'bodega@dynadrill.com',
    username: 'bodega',
    name: 'Patricia Sánchez',
    phone: '0998889900',
    roleId: 11,
    status: true,
    createdAt: '2026-08-27T08:00:00.000Z',
    updatedAt: '2026-08-27T08:00:00.000Z',
  },
  {
    id: 15,
    email: 'superadmin@dynadrill.com',
    username: 'superadmin',
    name: 'Root Dynadrill',
    phone: '0999990000',
    roleId: 12,
    status: true,
    createdAt: '2026-08-27T08:00:00.000Z',
    updatedAt: '2026-08-27T08:00:00.000Z',
  },
  {
    id: 16,
    email: 'facturacion@dynadrill.com',
    username: 'facturacion',
    name: 'Ricardo Vallejo',
    phone: '0991239876',
    roleId: 13,
    status: true,
    createdAt: '2026-08-28T08:00:00.000Z',
    updatedAt: '2026-08-28T08:00:00.000Z',
  },
];

let users: User[] = BASE_USERS.map(u => ({ ...u, ...DATOS_EMPLEADO_POR_ID[u.id] }));

/** Compartido con auth-mock.interceptor.ts: solo el login los necesita fuera de este archivo. */
export function getMockUsers(): User[] {
  return users;
}

export function getMockRoles(): Role[] {
  return roles;
}

let nextId = 16;

function matchUsersId(url: string): number | null {
  const match = url.match(/\/api\/users\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

export const usersMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url === '/api/roles' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: roles })).pipe(delay(300));
  }

  if (req.url === '/api/users' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: users })).pipe(delay(400));
  }

  if (req.url === '/api/users' && req.method === 'POST') {
    const { password: _password, ...rest } = req.body as CreateUserInput;
    const now = new Date().toISOString();
    const created: User = {
      ...rest,
      id: nextId++,
      createdAt: now,
      updatedAt: now,
    };
    users = [...users, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  const idFromUrl = matchUsersId(req.url);
  if (idFromUrl !== null && req.method === 'GET') {
    const found = users.find(u => u.id === idFromUrl);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ?? null })).pipe(delay(300));
  }

  if (idFromUrl !== null && req.method === 'PUT') {
    const input = req.body as UpdateUserInput;
    let updated: User | undefined;
    users = users.map(u => {
      if (u.id !== idFromUrl) return u;
      updated = { ...u, ...input, updatedAt: new Date().toISOString() };
      return updated;
    });
    return of(new HttpResponse({ status: updated ? 200 : 404, body: updated ?? null })).pipe(delay(400));
  }

  if (idFromUrl !== null && req.method === 'DELETE') {
    users = users.filter(u => u.id !== idFromUrl);
    return of(new HttpResponse({ status: 204 })).pipe(delay(300));
  }

  return next(req);
};
