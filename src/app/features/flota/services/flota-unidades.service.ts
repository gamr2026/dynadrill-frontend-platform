import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  AlertaPreventivaFlota,
  LecturaFlota,
  PreventivoEntrada,
  PreventivoFlota,
  ProveedorMantenimiento,
  TipoLecturaFlota,
  TipoUnidadFlota,
  UnidadCambios,
  UnidadEntrada,
  UnidadFlota,
} from '../models/unidad-flota.model';

/** Unidades de Flota, sus lecturas y preventivos (contenedor `operaciones`). */
@Injectable({ providedIn: 'root' })
export class FlotaUnidadesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/flota`;

  listar(
    filtro: { tipo?: TipoUnidadFlota; q?: string; activa?: 'true' | 'false' | 'todas' } = {},
  ): Observable<UnidadFlota[]> {
    let params = new HttpParams();
    if (filtro.tipo) params = params.set('tipo', filtro.tipo);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    if (filtro.activa) params = params.set('activa', filtro.activa);
    return this.http.get<UnidadFlota[]>(`${this.base}/unidades`, { params });
  }

  obtener(id: string): Observable<UnidadFlota> {
    return this.http.get<UnidadFlota>(`${this.base}/unidades/${id}`);
  }

  crear(cuerpo: UnidadEntrada): Observable<UnidadFlota> {
    return this.http.post<UnidadFlota>(`${this.base}/unidades`, cuerpo);
  }

  actualizar(id: string, cuerpo: UnidadCambios): Observable<UnidadFlota> {
    return this.http.patch<UnidadFlota>(`${this.base}/unidades/${id}`, cuerpo);
  }

  cambiarActiva(id: string, activa: boolean): Observable<UnidadFlota> {
    return this.http.patch<UnidadFlota>(`${this.base}/unidades/${id}/activa`, { activa });
  }

  /** Alertas preventivas de las unidades activas, de la más urgente a la menos. */
  alertas(): Observable<AlertaPreventivaFlota[]> {
    return this.http.get<AlertaPreventivaFlota[]>(`${this.base}/unidades/alertas`);
  }

  lecturas(id: string, tipo?: TipoLecturaFlota): Observable<LecturaFlota[]> {
    let params = new HttpParams();
    if (tipo) params = params.set('tipo', tipo);
    return this.http.get<LecturaFlota[]>(`${this.base}/unidades/${id}/lecturas`, { params });
  }

  registrarLectura(id: string, tipo: TipoLecturaFlota, valor: number): Observable<LecturaFlota> {
    return this.http.post<LecturaFlota>(`${this.base}/unidades/${id}/lecturas`, { tipo, valor });
  }

  preventivos(id: string): Observable<PreventivoFlota[]> {
    return this.http.get<PreventivoFlota[]>(`${this.base}/unidades/${id}/preventivos`);
  }

  registrarPreventivo(id: string, cuerpo: PreventivoEntrada): Observable<PreventivoFlota> {
    return this.http.post<PreventivoFlota>(`${this.base}/unidades/${id}/preventivos`, cuerpo);
  }

  proveedores(): Observable<ProveedorMantenimiento[]> {
    return this.http.get<ProveedorMantenimiento[]>(`${this.base}/proveedores-mantenimiento`);
  }
}
