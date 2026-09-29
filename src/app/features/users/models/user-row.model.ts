import { Role, User } from './user.model';

/** Usuario listo para mostrar (tabla en escritorio, tarjeta en móvil). */
export interface UserRow {
  id: number;
  name: string;
  username: string;
  email: string;
  cargo: string;
  departamento: string;
  role: string;
  active: boolean;
}

export function toUserRows(users: User[], roles: Role[]): UserRow[] {
  const roleById = new Map(roles.map(r => [r.id, r.name]));
  return users.map(user => ({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    cargo: user.cargo ?? '—',
    departamento: user.departamento ?? '—',
    role: roleById.get(user.roleId) ?? '—',
    active: user.status,
  }));
}

/** Búsqueda libre por nombre, usuario o correo (placeholder del buscador en Figma). */
export function matchesUserQuery(row: UserRow, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('es');
  if (!q) return true;
  return [row.name, row.username, row.email].some(value => value.toLocaleLowerCase('es').includes(q));
}
