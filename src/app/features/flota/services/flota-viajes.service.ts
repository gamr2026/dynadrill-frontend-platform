import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  BodegaViaje,
  EstadoViaje,
  PreguntaRiesgo,
  SolicitarViajeEntrada,
  TipoViaje,
  UmbralRiesgo,
  UnidadViaje,
  ViajeContextoPumping,
  ViajeDetalle,
  ViajeResumen,
} from '../models/viaje-flota.model';

/** Gerenciamiento de Viaje (Flota) y, para autocompletar la solicitud, los viajes del Conductor que ofrece Pumping. */
@Injectable({ providedIn: 'root' })
export class FlotaViajesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/flota/gerenciamientos-viaje`;

  preguntas(): Observable<PreguntaRiesgo[]> {
    return this.http.get<PreguntaRiesgo[]>(`${this.base}/preguntas`);
  }

  umbrales(): Observable<UmbralRiesgo[]> {
    return this.http.get<UmbralRiesgo[]>(`${this.base}/umbrales`);
  }

  unidades(): Observable<UnidadViaje[]> {
    return this.http.get<UnidadViaje[]>(`${this.base}/unidades`);
  }

  bodegas(): Observable<BodegaViaje[]> {
    return this.http.get<BodegaViaje[]>(`${this.base}/bodegas`);
  }

  /** Tickets de Pumping donde la cuenta es operador asignado (permiso `pumping.tickets.contexto_conductor`). */
  misViajesPumping(): Observable<ViajeContextoPumping[]> {
    return this.http.get<ViajeContextoPumping[]>(
      `${environment.apiUrl}/operaciones/pumping/tickets/mis-viajes`,
    );
  }

  listar(
    filtro: { estado?: EstadoViaje; ticketId?: string; tipo?: TipoViaje } = {},
  ): Observable<ViajeResumen[]> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.ticketId) params = params.set('ticketId', filtro.ticketId);
    if (filtro.tipo) params = params.set('tipo', filtro.tipo);
    return this.http.get<ViajeResumen[]>(this.base, { params });
  }

  obtener(id: string): Observable<ViajeDetalle> {
    return this.http.get<ViajeDetalle>(`${this.base}/${id}`);
  }

  solicitar(
    cuerpo: SolicitarViajeEntrada,
  ): Observable<{ id: string; codigo: string; nivel: string; estado: string }> {
    return this.http.post<{ id: string; codigo: string; nivel: string; estado: string }>(
      this.base,
      cuerpo,
    );
  }

  autorizar(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/autorizar`, {});
  }

  rechazar(id: string, motivo: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/rechazar`, { motivo });
  }
}
