import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  AsignacionApi,
  AvanceEntradaApi,
  EstadoReporteApi,
  OrdenApi,
  ReporteApi,
  SubordenApi,
} from '../models/mantenimiento-plataforma.model';

/**
 * Cliente del backend nuevo de Mantenimiento (el gateway enruta `/api/operaciones/*` al contenedor operaciones). Devuelve las
 * respuestas tal cual; `MaintenanceOrdersService` y `UnitReportsService` las traducen a los modelos de las pantallas.
 */
@Injectable({ providedIn: 'root' })
export class MantenimientoPlataformaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/mantenimiento`;

  // --- reportes recibidos (MAN-001-A) ---
  reportes(
    filtros: { estado?: EstadoReporteApi; unidadId?: string; q?: string } = {},
  ): Observable<ReporteApi[]> {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.unidadId) params = params.set('unidadId', filtros.unidadId);
    if (filtros.q) params = params.set('q', filtros.q);
    return this.http.get<ReporteApi[]>(`${this.base}/reportes`, { params });
  }

  reporte(id: string): Observable<ReporteApi> {
    return this.http.get<ReporteApi>(`${this.base}/reportes/${id}`);
  }

  descartar(id: string, motivo: string): Observable<ReporteApi> {
    return this.http.post<ReporteApi>(`${this.base}/reportes/${id}/descartar`, { motivo });
  }

  clasificar(reporteId: string, asignaciones: AsignacionApi[]): Observable<OrdenApi> {
    return this.http.post<OrdenApi>(`${this.base}/reportes/${reporteId}/clasificar`, {
      asignaciones,
    });
  }

  // --- órdenes ---
  /** `asignadaA`: solo las órdenes con una sub-orden asignada a esa cuenta («Mis tareas»). */
  ordenes(
    filtros: { estado?: string; unidadId?: string; asignadaA?: string; q?: string } = {},
  ): Observable<OrdenApi[]> {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.unidadId) params = params.set('unidadId', filtros.unidadId);
    if (filtros.asignadaA) params = params.set('asignadaA', filtros.asignadaA);
    if (filtros.q) params = params.set('q', filtros.q);
    return this.http.get<OrdenApi[]>(`${this.base}/ordenes`, { params });
  }

  /** Las órdenes de las unidades que lleva un ticket de Pumping (la tarjeta «Mantenimientos» del ticket). */
  ordenesDeTicket(ticketId: string): Observable<OrdenApi[]> {
    return this.http.get<OrdenApi[]>(`${this.base}/tickets/${ticketId}/ordenes`);
  }

  orden(id: string): Observable<OrdenApi> {
    return this.http.get<OrdenApi>(`${this.base}/ordenes/${id}`);
  }

  reclasificar(ordenId: string, asignaciones: AsignacionApi[]): Observable<OrdenApi> {
    return this.http.put<OrdenApi>(`${this.base}/ordenes/${ordenId}/clasificacion`, {
      asignaciones,
    });
  }

  /** Fin correctivo: el Jefe devuelve la unidad a Operaciones (con todas las sub-órdenes resueltas). */
  retornar(
    ordenId: string,
    estadoFinal: 'disponible' | 'con_restricciones',
    observaciones: string | null,
  ): Observable<OrdenApi> {
    return this.http.post<OrdenApi>(`${this.base}/ordenes/${ordenId}/retornar`, {
      estadoFinal,
      observaciones,
    });
  }

  // --- ejecución y cierre de la sub-orden (MAN-001-B y C) ---
  suborden(id: string): Observable<SubordenApi> {
    return this.http.get<SubordenApi>(`${this.base}/subordenes/${id}`);
  }

  guardarAvance(id: string, avance: AvanceEntradaApi): Observable<SubordenApi> {
    return this.http.put<SubordenApi>(`${this.base}/subordenes/${id}/avance`, avance);
  }

  enviarARevision(id: string): Observable<SubordenApi> {
    return this.http.post<SubordenApi>(`${this.base}/subordenes/${id}/enviar-revision`, {});
  }

  /** El Jefe aprueba el cierre: los repuestos del catálogo salen de bodega. */
  aprobarCierre(id: string): Observable<SubordenApi> {
    return this.http.post<SubordenApi>(`${this.base}/subordenes/${id}/aprobar-cierre`, {});
  }

  solicitarCorreccion(id: string, nota: string): Observable<SubordenApi> {
    return this.http.post<SubordenApi>(`${this.base}/subordenes/${id}/solicitar-correccion`, {
      nota,
    });
  }
}
