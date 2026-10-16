import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUserInput, Role, UpdateUserInput, User, UsuarioPorRol } from '../models/user.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users`);
  }

  get(id: string): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/users/${id}`);
  }

  create(input: CreateUserInput): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/users`, input);
  }

  update(id: string, input: UpdateUserInput): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}`, input);
  }

  /** El backend no borra: `DELETE /users/:id` desactiva la cuenta (status=false). */
  delete(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${environment.apiUrl}/users/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);

  list(): Observable<Role[]> {
    return this.http.get<Role[]>(`${environment.apiUrl}/roles`);
  }

  /**
   * Usuarios activos con un rol (por code): `{ id (uuid), legacyId, name, specialty }`. Para los
   * selects de "responsable/supervisor" — no requiere `GET /api/users` (Superadmin únicamente).
   * Los módulos viejos deben pasar el resultado por `conIdLegacy()` antes de enviar ids a la demo.
   */
  usuariosPorRol(code: string): Observable<UsuarioPorRol[]> {
    return this.http.get<UsuarioPorRol[]>(`${environment.apiUrl}/roles/${code}/usuarios`);
  }
}
