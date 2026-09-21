import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUserInput, Role, UpdateUserInput, User } from '../models/user.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);

  list(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users`);
  }

  get(id: number): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/users/${id}`);
  }

  create(input: CreateUserInput): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/users`, input);
  }

  update(id: number, input: UpdateUserInput): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/users/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);

  list(): Observable<Role[]> {
    return this.http.get<Role[]>(`${environment.apiUrl}/roles`);
  }

  /**
   * {id, name} de los usuarios activos con un rol (por code). Para los
   * selects de "responsable/supervisor" — no requiere `GET /api/users`
   * (Superadmin únicamente).
   */
  usuariosPorRol(code: string): Observable<{ id: number; name: string; specialty?: string | null }[]> {
    return this.http.get<{ id: number; name: string; specialty?: string | null }[]>(
      `${environment.apiUrl}/roles/${code}/usuarios`,
    );
  }
}
