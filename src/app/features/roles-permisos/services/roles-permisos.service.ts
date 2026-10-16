import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { GuardarPermisosResultado, HistorialPermiso, Permiso, Role } from '../models/roles-permisos.model';

/** RBAC editable: catálogo de permisos y permisos asignados a cada rol (`:id` = UUID del rol). */
@Injectable({ providedIn: 'root' })
export class RolesPermisosService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  listarRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.base}/roles`);
  }

  /** Catálogo fijo de permisos. Requiere `identidad.roles.ver`. */
  listarPermisos(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(`${this.base}/permissions`);
  }

  /** Códigos de permiso asignados al rol. */
  permisosDeRol(roleId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/roles/${roleId}/permisos`);
  }

  /** Reemplaza el conjunto COMPLETO de permisos del rol. */
  guardarPermisos(roleId: string, permisos: string[]): Observable<GuardarPermisosResultado> {
    return this.http.put<GuardarPermisosResultado>(`${this.base}/roles/${roleId}/permisos`, { permisos });
  }

  /** Cambios de permisos del rol, el más reciente primero. */
  historial(roleId: string, limite = 50): Observable<HistorialPermiso[]> {
    return this.http.get<HistorialPermiso[]>(`${this.base}/roles/${roleId}/permisos/historial`, {
      params: new HttpParams().set('limite', limite),
    });
  }
}
