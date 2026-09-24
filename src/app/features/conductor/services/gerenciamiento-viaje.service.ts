import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateGerenciamientoViajeInput, GerenciamientoViaje } from '../models/gerenciamiento-viaje.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class GerenciamientoViajeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/gerenciamiento-viaje`;

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
