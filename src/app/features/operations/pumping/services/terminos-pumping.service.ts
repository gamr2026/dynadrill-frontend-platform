import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { AceptacionTerminos, AceptarTerminosInput, TerminosPumping } from '../models/terminos.model';

/** Términos y condiciones de uso de equipos de Pumping — solo crear y leer (las aceptaciones no se editan). */
@Injectable({ providedIn: 'root' })
export class TerminosPumpingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/operations/pumping`;

  vigentes(): Observable<TerminosPumping> {
    return this.http.get<TerminosPumping>(`${this.baseUrl}/terminos/vigente`);
  }

  deTicket(ticketId: number): Observable<AceptacionTerminos[]> {
    return this.http.get<AceptacionTerminos[]>(`${this.baseUrl}/tickets/${ticketId}/aceptaciones-terminos`);
  }

  aceptar(ticketId: number, input: AceptarTerminosInput): Observable<AceptacionTerminos> {
    return this.http.post<AceptacionTerminos>(`${this.baseUrl}/tickets/${ticketId}/aceptaciones-terminos`, input);
  }

  historial(filtro: { cedula?: string; nombre?: string }): Observable<AceptacionTerminos[]> {
    const params: Record<string, string> = {};
    if (filtro.cedula?.trim()) params['cedula'] = filtro.cedula.trim();
    if (filtro.nombre?.trim()) params['nombre'] = filtro.nombre.trim();
    return this.http.get<AceptacionTerminos[]>(`${this.baseUrl}/aceptaciones-terminos`, { params });
  }
}
