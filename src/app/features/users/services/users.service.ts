import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUserInput, Role, UpdateUserInput, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }

  get(id: number): Observable<User> {
    return this.http.get<User>(`/api/users/${id}`);
  }

  create(input: CreateUserInput): Observable<User> {
    return this.http.post<User>('/api/users', input);
  }

  update(id: number, input: UpdateUserInput): Observable<User> {
    return this.http.put<User>(`/api/users/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/users/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);

  list(): Observable<Role[]> {
    return this.http.get<Role[]>('/api/roles');
  }

  /**
   * {id, name} de los usuarios activos con un rol (por code). Para los
   * selects de "responsable/supervisor" — no requiere `GET /api/users`
   * (Superadmin únicamente).
   */
  usuariosPorRol(code: string): Observable<{ id: number; name: string }[]> {
    return this.http.get<{ id: number; name: string }[]>(`/api/roles/${code}/usuarios`);
  }
}
