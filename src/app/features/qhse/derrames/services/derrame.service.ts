import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateDerrameInput, DerrameEvento } from '../models/derrame.model';

@Injectable({ providedIn: 'root' })
export class DerrameService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/qhse/derrames';

  list(): Observable<DerrameEvento[]> {
    return this.http.get<DerrameEvento[]>(this.baseUrl);
  }

  get(id: number): Observable<DerrameEvento> {
    return this.http.get<DerrameEvento>(`${this.baseUrl}/${id}`);
  }

  activar(input: CreateDerrameInput): Observable<DerrameEvento> {
    return this.http.post<DerrameEvento>(this.baseUrl, input);
  }

  update(id: number, changes: Partial<DerrameEvento>): Observable<DerrameEvento> {
    return this.http.patch<DerrameEvento>(`${this.baseUrl}/${id}`, changes);
  }

  /** Suelo contaminado → genera un registro de Desecho peligroso (integración HSE-AMBIENTAL-001/002). */
  generarDesecho(derrameId: number): Observable<DerrameEvento> {
    return this.http.post<DerrameEvento>(`${this.baseUrl}/${derrameId}/generar-desecho`, {});
  }
}
