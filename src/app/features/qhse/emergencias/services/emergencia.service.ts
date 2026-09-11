import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateEmergenciaInput, EmergenciaEvento } from '../models/emergencia.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class EmergenciaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/emergencias`;

  list(): Observable<EmergenciaEvento[]> {
    return this.http.get<EmergenciaEvento[]>(this.baseUrl);
  }

  get(id: number): Observable<EmergenciaEvento> {
    return this.http.get<EmergenciaEvento>(`${this.baseUrl}/${id}`);
  }

  activar(input: CreateEmergenciaInput): Observable<EmergenciaEvento> {
    return this.http.post<EmergenciaEvento>(this.baseUrl, input);
  }

  update(id: number, changes: Partial<EmergenciaEvento>): Observable<EmergenciaEvento> {
    return this.http.patch<EmergenciaEvento>(`${this.baseUrl}/${id}`, changes);
  }
}
