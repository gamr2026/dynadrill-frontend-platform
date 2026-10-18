import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  AsignacionEntrada,
  FiltroReportes,
  OrdenMantenimiento,
  ReporteRecibido,
  TipoSuborden,
} from '../models/mantenimiento-nuevo';

/** Mantenimiento del contenedor `operaciones`. La autoridad de estados, códigos y permisos es el backend. */
@Injectable({ providedIn: 'root' })
export class MantenimientoNuevoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/mantenimiento`;

  tipos(): Observable<TipoSuborden[]> {
    return this.http.get<TipoSuborden[]>(`${this.base}/tipos-suborden`);
  }

  reportes(filtro: FiltroReportes = {}): Observable<ReporteRecibido[]> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<ReporteRecibido[]>(`${this.base}/reportes`, { params });
  }

  reporte(id: string): Observable<ReporteRecibido> {
    return this.http.get<ReporteRecibido>(`${this.base}/reportes/${id}`);
  }

  /** MAN-001-A, rama «No requiere mantenimiento»: el motivo es obligatorio. */
  descartar(id: string, motivo: string): Observable<ReporteRecibido> {
    return this.http.post<ReporteRecibido>(`${this.base}/reportes/${id}/descartar`, { motivo });
  }

  /** MAN-001-A, rama «Requiere mantenimiento»: genera la orden con una sub-orden por tipo. */
  clasificar(id: string, asignaciones: AsignacionEntrada[]): Observable<OrdenMantenimiento> {
    return this.http.post<OrdenMantenimiento>(`${this.base}/reportes/${id}/clasificar`, {
      asignaciones,
    });
  }

  ordenes(filtro: { estado?: string; q?: string } = {}): Observable<OrdenMantenimiento[]> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<OrdenMantenimiento[]>(`${this.base}/ordenes`, { params });
  }

  reclasificar(ordenId: string, asignaciones: AsignacionEntrada[]): Observable<OrdenMantenimiento> {
    return this.http.put<OrdenMantenimiento>(`${this.base}/ordenes/${ordenId}/clasificacion`, {
      asignaciones,
    });
  }
}
