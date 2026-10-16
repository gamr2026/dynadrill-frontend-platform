import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  AsignacionEntrada,
  ConfirmacionIngreso,
  FiltroTickets,
  GasIngreso,
  AceptacionOperador,
  IngresoLocacion,
  ReporteUnidad,
  SalidaEntrada,
  TerminosVigentes,
  TicketPumping,
  TicketPumpingResumen,
  UnidadReporte,
} from '../models/ticket-pumping';

/** Tickets de Pumping del contenedor `operaciones`. La autoridad de pasos y permisos es el backend. */
@Injectable({ providedIn: 'root' })
export class TicketsPumpingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/pumping`;

  listar(filtro: FiltroTickets = {}): Observable<TicketPumpingResumen[]> {
    let params = new HttpParams();
    if (filtro.paso) params = params.set('paso', filtro.paso);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    if (filtro.mios) params = params.set('mios', 'true');
    return this.http.get<TicketPumpingResumen[]>(`${this.base}/tickets`, { params });
  }

  detalle(id: string): Observable<TicketPumping> {
    return this.http.get<TicketPumping>(`${this.base}/tickets/${id}`);
  }

  asignar(id: string, cuerpo: AsignacionEntrada): Observable<TicketPumping> {
    return this.http.post<TicketPumping>(`${this.base}/tickets/${id}/asignar`, cuerpo);
  }

  avanzar(id: string, hacia: string, motivo?: string): Observable<TicketPumping> {
    return this.http.post<TicketPumping>(`${this.base}/tickets/${id}/avanzar`, motivo?.trim() ? { hacia, motivo: motivo.trim() } : { hacia });
  }

  // ── Traslado de salida ──

  terminosVigentes(): Observable<TerminosVigentes> {
    return this.http.get<TerminosVigentes>(`${this.base}/terminos/vigente`);
  }

  terminos(id: string): Observable<AceptacionOperador[]> {
    return this.http.get<AceptacionOperador[]>(`${this.base}/tickets/${id}/terminos`);
  }

  aceptarTerminos(id: string): Observable<{ versionCodigo: string; aceptadoAt: string }> {
    return this.http.post<{ versionCodigo: string; aceptadoAt: string }>(`${this.base}/tickets/${id}/terminos/aceptar`, {});
  }

  ingreso(id: string): Observable<IngresoLocacion> {
    return this.http.get<IngresoLocacion>(`${this.base}/tickets/${id}/ingreso`);
  }

  actualizarIngreso(id: string, cambios: Partial<Record<ConfirmacionIngreso, boolean>> & { nuevaLectura?: { gas: GasIngreso; lectura: number } }): Observable<IngresoLocacion> {
    return this.http.patch<IngresoLocacion>(`${this.base}/tickets/${id}/ingreso`, cambios);
  }

  alternarLoto(id: string, itemId: string): Observable<IngresoLocacion> {
    return this.http.patch<IngresoLocacion>(`${this.base}/tickets/${id}/ingreso/loto/${itemId}`, {});
  }

  unidadesReporte(id: string): Observable<UnidadReporte[]> {
    return this.http.get<UnidadReporte[]>(`${this.base}/tickets/${id}/reportes-unidad`);
  }

  reporteUnidad(id: string, vehiculoId: string): Observable<ReporteUnidad> {
    return this.http.get<ReporteUnidad>(`${this.base}/tickets/${id}/reportes-unidad/${vehiculoId}`);
  }

  guardarSalida(id: string, vehiculoId: string, cuerpo: SalidaEntrada): Observable<ReporteUnidad> {
    return this.http.put<ReporteUnidad>(`${this.base}/tickets/${id}/reportes-unidad/${vehiculoId}/salida`, cuerpo);
  }

  /** PUENTE TEMPORAL: confirma a mano un requisito de un módulo que aún no existe (QHSE, Mantenimiento). */
  cumplirRequisitoManual(requisitoId: string, motivo: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/requisitos/${requisitoId}/cumplir-manual`, { motivo });
  }
}
