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
  description?: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  name: string;
  code: string;
  phone: string;
  roleId: number;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  name: string;
  code: string;
  phone: string;
  roleId: number;
  status: boolean;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & { password?: string };
