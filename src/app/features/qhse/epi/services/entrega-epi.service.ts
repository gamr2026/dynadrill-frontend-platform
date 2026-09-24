import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateEntregaEpiInput, EntregaEpi } from '../models/entrega-epi.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class EntregaEpiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/epi`;

  list(): Observable<EntregaEpi[]> {
    return this.http.get<EntregaEpi[]>(this.baseUrl);
  }

  /** Entregas de un ticket de Pumping/FCR puntual — ver el bloque de EPI en el ticket. */
  listDeTicket(pumpingTicketId: number): Observable<EntregaEpi[]> {
    return this.http.get<EntregaEpi[]>(this.baseUrl, { params: { pumpingTicketId } });
  }

  create(input: CreateEntregaEpiInput): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(this.baseUrl, input);
  }

  /** Firmar (trabajador o Talento Humano) — mismo patrón "una línea" del resto de QHSE. */
  update(id: number, changes: Partial<EntregaEpi>): Observable<EntregaEpi> {
    return this.http.patch<EntregaEpi>(`${this.baseUrl}/${id}`, changes);
  }

  /** Fase 5 — ciclo de vida: QHSE aprueba/rechaza/despacha. */
  aprobar(id: number): Observable<EntregaEpi> {
    return this.http.patch<EntregaEpi>(`${this.baseUrl}/${id}/aprobar`, {});
  }

  rechazar(id: number, motivo: string): Observable<EntregaEpi> {
    return this.http.patch<EntregaEpi>(`${this.baseUrl}/${id}/rechazar`, { motivo });
  }

  despachar(id: number): Observable<EntregaEpi> {
    return this.http.patch<EntregaEpi>(`${this.baseUrl}/${id}/despachar`, {});
  }
}
