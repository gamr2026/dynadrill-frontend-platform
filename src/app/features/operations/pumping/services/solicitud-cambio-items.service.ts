import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { ItemEstimado } from '../../../facturacion/models/pedido.model';
import type { EstadoSolicitudCambioItems, SolicitudCambioItems } from '../models/solicitud-cambio-items.model';

@Injectable({ providedIn: 'root' })
export class SolicitudCambioItemsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/operations/pumping/solicitudes-cambio-items`;

  list(estado?: EstadoSolicitudCambioItems): Observable<SolicitudCambioItems[]> {
    return this.http.get<SolicitudCambioItems[]>(this.baseUrl, estado ? { params: { estado } } : undefined);
  }

  porTicket(pumpingTicketId: number): Observable<SolicitudCambioItems[]> {
    return this.http.get<SolicitudCambioItems[]>(this.baseUrl, { params: { pumpingTicketId } });
  }

  proponer(input: {
    pumpingTicketId: number;
    itemsPropuestos: ItemEstimado[];
    motivo: string;
    solicitadoPor: string;
  }): Observable<SolicitudCambioItems> {
    return this.http.post<SolicitudCambioItems>(this.baseUrl, input);
  }

  aprobar(id: number, aprobadoPor: string): Observable<SolicitudCambioItems> {
    return this.http.patch<SolicitudCambioItems>(`${this.baseUrl}/${id}/approve`, { aprobadoPor });
  }

  rechazar(id: number, rechazadoPor: string, motivoRechazo?: string): Observable<SolicitudCambioItems> {
    return this.http.patch<SolicitudCambioItems>(`${this.baseUrl}/${id}/reject`, { rechazadoPor, motivoRechazo });
  }
}
