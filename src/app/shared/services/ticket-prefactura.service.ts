import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '@env';
import type { LineaTicketPrefactura, TicketPrefacturaVista } from '../models/ticket-prefactura.model';

/** "Ver prefactura" desde el ticket de Pumping o FCR (Supervisor): vista de la prefactura y registro de la firma del Company Man. */
@Injectable({ providedIn: 'root' })
export class TicketPrefacturaService {
  private readonly http = inject(HttpClient);

  private url(linea: LineaTicketPrefactura, ticketId: number): string {
    return `${environment.apiUrl}/operations/${linea}/tickets/${ticketId}/prefactura`;
  }

  ver(linea: LineaTicketPrefactura, ticketId: number): Observable<TicketPrefacturaVista> {
    return this.http.get<TicketPrefacturaVista>(this.url(linea, ticketId));
  }

  /** ¿Todavía falta registrar la firma del Company Man (y ya se puede)? Si no se puede consultar, `false`: nunca estorba. */
  necesitaFirma(linea: LineaTicketPrefactura, ticketId: number): Observable<boolean> {
    return this.ver(linea, ticketId).pipe(
      map(v => v.puedeFirmar),
      catchError(() => of(false)),
    );
  }

  /** Sube la prefactura firmada por el Company Man: queda FIRMADA para Facturación. */
  firmar(linea: LineaTicketPrefactura, ticketId: number, firma: { nombre: string; cargo: string }, archivo: File): Observable<unknown> {
    const form = new FormData();
    form.append('nombre', firma.nombre);
    form.append('cargo', firma.cargo);
    form.append('file', archivo);
    return this.http.post(`${this.url(linea, ticketId)}/firma`, form);
  }
}
