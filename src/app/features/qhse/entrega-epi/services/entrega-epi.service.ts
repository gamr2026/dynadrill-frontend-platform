import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  ElementoEpi,
  EntregaEpi,
  EntregaEpiResumen,
  FiltroEntregasEpi,
  LugarEpi,
  OperadorEpiTicket,
  RenglonEntrada,
  TallaEpi,
} from '../models/entrega-epi';

/** Entregas de EPI del contenedor `qhse`. La autoridad de estados y permisos es el backend. */
@Injectable({ providedIn: 'root' })
export class EntregaEpiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v2/qhse/epi`;

  listar(filtro: FiltroEntregasEpi = {}): Observable<EntregaEpiResumen[]> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<EntregaEpiResumen[]>(this.base, { params });
  }

  elementos(): Observable<ElementoEpi[]> {
    return this.http.get<ElementoEpi[]>(`${this.base}/elementos`);
  }

  tallas(): Observable<TallaEpi[]> {
    return this.http.get<TallaEpi[]>(`${this.base}/tallas`);
  }

  lugares(): Observable<LugarEpi[]> {
    return this.http.get<LugarEpi[]>(`${this.base}/lugares`);
  }

  detalle(id: string): Observable<EntregaEpi> {
    return this.http.get<EntregaEpi>(`${this.base}/${id}`);
  }

  crear(cuerpo: {
    trabajadorId: string;
    lugarBodegaId?: string;
    renglones?: RenglonEntrada[];
  }): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(this.base, cuerpo);
  }

  guardarContenido(
    id: string,
    cuerpo: { lugarBodegaId?: string; renglones: RenglonEntrada[] },
  ): Observable<EntregaEpi> {
    return this.http.put<EntregaEpi>(`${this.base}/${id}/contenido`, cuerpo);
  }

  aprobar(id: string): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(`${this.base}/${id}/aprobar`, {});
  }

  rechazar(id: string, motivo: string): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(`${this.base}/${id}/rechazar`, { motivo });
  }

  despachar(id: string): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(`${this.base}/${id}/despachar`, {});
  }

  revertir(id: string, motivo: string): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(`${this.base}/${id}/revertir`, { motivo });
  }

  firmarTrabajador(id: string): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(`${this.base}/${id}/firma-trabajador`, {});
  }

  firmarTalentoHumano(id: string): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(`${this.base}/${id}/firma-talento-humano`, {});
  }

  /** Los operadores asignados al ticket y el estado de la solicitud de EPI de cada uno (lo ve el equipo de Pumping). */
  deTicket(ticketId: string): Observable<OperadorEpiTicket[]> {
    return this.http.get<OperadorEpiTicket[]>(`${this.base}/ticket/${ticketId}`);
  }

  /** Pumping pide el EPI de un operador del ticket; QHSE la aprueba, la rechaza o la despacha. */
  solicitarDeTicket(
    ticketId: string,
    cuerpo: { trabajadorId: string; lugarBodegaId?: string; renglones: RenglonEntrada[] },
  ): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(`${this.base}/ticket/${ticketId}`, cuerpo);
  }
}
