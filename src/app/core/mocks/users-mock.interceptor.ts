import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { CreateUserInput, Role, UpdateUserInput, User } from '../../features/users/models/user.model';

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
   * Rol propio para quien llena la Inspección de Vehículos (DYN-SGI-RE-068)
   * antes de salir con un vehículo de apoyo — Plan de Mantenimiento 2026,
   * sección 5.4, lo llama explícitamente "conductor". Antes reusaba
   * "Operador" (id 2), que en realidad es el rol de Pumping/FCR — se separó
   * porque son módulos distintos y los "Documentos del conductor" del
   * formato (licencia, manejo defensivo, examen médico) son atestación
   * personal de quien maneja, no algo que el Jefe de Mantenimiento pueda
   * llenar por él.
   */
  { id: 7, name: 'Conductor' },
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
];

let users: User[] = [
  {
    id: 1,
    email: 'admin@dynadrill.com',
    username: 'admin',
    name: 'Ana Torres',
    code: 'EMP-001',
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
    code: 'EMP-002',
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
    code: 'EMP-003',
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
    code: 'EMP-004',
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
    code: 'EMP-005',
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
    code: 'EMP-006',
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
    code: 'EMP-008',
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
    code: 'EMP-009',
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
    code: 'EMP-010',
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
    code: 'EMP-011',
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
    code: 'EMP-012',
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
    code: 'EMP-013',
    phone: '0997778899',
    roleId: 10,
    status: true,
    createdAt: '2026-08-15T08:10:00.000Z',
    updatedAt: '2026-08-15T08:10:00.000Z',
  },
];

/** Compartido con auth-mock.interceptor.ts: solo el login los necesita fuera de este archivo. */
export function getMockUsers(): User[] {
  return users;
}

export function getMockRoles(): Role[] {
  return roles;
}

let nextId = 14;

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
    const input = req.body as CreateUserInput;
    const now = new Date().toISOString();
    const created: User = {
      id: nextId++,
      email: input.email,
      username: input.username,
      name: input.name,
      code: input.code,
      phone: input.phone,
      roleId: input.roleId,
      status: input.status,
      specialty: input.specialty,
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
