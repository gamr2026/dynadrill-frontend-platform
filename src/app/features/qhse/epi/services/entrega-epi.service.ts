import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateEntregaEpiInput, EntregaEpi } from '../models/entrega-epi.model';

@Injectable({ providedIn: 'root' })
export class EntregaEpiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/qhse/epi';

  list(): Observable<EntregaEpi[]> {
    return this.http.get<EntregaEpi[]>(this.baseUrl);
  }

  create(input: CreateEntregaEpiInput): Observable<EntregaEpi> {
    return this.http.post<EntregaEpi>(this.baseUrl, input);
  }

  /** Firmar (trabajador o Talento Humano) — mismo patrón "una línea" del resto de QHSE. */
  update(id: number, changes: Partial<EntregaEpi>): Observable<EntregaEpi> {
    return this.http.patch<EntregaEpi>(`${this.baseUrl}/${id}`, changes);
  }
}
