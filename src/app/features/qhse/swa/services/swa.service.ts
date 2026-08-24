import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateSwaInput, SwaEvento } from '../models/swa.model';

@Injectable({ providedIn: 'root' })
export class SwaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/qhse/swa';

  list(): Observable<SwaEvento[]> {
    return this.http.get<SwaEvento[]>(this.baseUrl);
  }

  get(id: number): Observable<SwaEvento> {
    return this.http.get<SwaEvento>(`${this.baseUrl}/${id}`);
  }

  activar(input: CreateSwaInput): Observable<SwaEvento> {
    return this.http.post<SwaEvento>(this.baseUrl, input);
  }

  update(id: number, changes: Partial<SwaEvento>): Observable<SwaEvento> {
    return this.http.patch<SwaEvento>(`${this.baseUrl}/${id}`, changes);
  }
}
