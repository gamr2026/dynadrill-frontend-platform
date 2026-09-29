import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateGerenciamientoViajeInput, GerenciamientoViaje, TicketContexto } from '../models/gerenciamiento-viaje.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class GerenciamientoViajeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/gerenciamiento-viaje`;
  private readonly ticketsUrl = `${environment.apiUrl}/operations/pumping/tickets`;

  /** Autocompletar origen/destino/línea de servicio/supervisor asignado a partir del código del ticket — el conductor no debe volver a tipearlos. */
  contextoDeTicket(code: string): Observable<TicketContexto> {
    return this.http.get<TicketContexto>(`${this.ticketsUrl}/contexto/${encodeURIComponent(code)}`);
  }

  /** Bandeja del Jefe de Base — todos los registros. */
  listAll(): Observable<GerenciamientoViaje[]> {
    return this.http.get<GerenciamientoViaje[]>(this.baseUrl);
  }

  /** Los del conductor autenticado. */
  listMine(): Observable<GerenciamientoViaje[]> {
    return this.http.get<GerenciamientoViaje[]>(`${this.baseUrl}/mios`);
  }

  create(input: CreateGerenciamientoViajeInput): Observable<GerenciamientoViaje> {
    return this.http.post<GerenciamientoViaje>(this.baseUrl, input);
  }

  aprobar(id: number): Observable<GerenciamientoViaje> {
    return this.http.patch<GerenciamientoViaje>(`${this.baseUrl}/${id}/aprobar`, {});
  }

  rechazar(id: number, motivo: string): Observable<GerenciamientoViaje> {
    return this.http.patch<GerenciamientoViaje>(`${this.baseUrl}/${id}/rechazar`, { motivo });
  }
}
