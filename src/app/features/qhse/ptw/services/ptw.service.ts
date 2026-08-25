import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PtwMatrix } from '../models/ptw.model';

@Injectable({ providedIn: 'root' })
export class PtwService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/qhse/ptw';

  list(): Observable<PtwMatrix[]> {
    return this.http.get<PtwMatrix[]>(this.baseUrl);
  }

  get(id: number): Observable<PtwMatrix> {
    return this.http.get<PtwMatrix>(`${this.baseUrl}/${id}`);
  }

  /** Rechazado por el backend/mock (400) si la Matriz IPERC referida no está aprobada. */
  createFromIperc(ipercMatrixId: number): Observable<PtwMatrix> {
    return this.http.post<PtwMatrix>(this.baseUrl, { ipercMatrixId });
  }

  update(id: number, changes: Partial<PtwMatrix>): Observable<PtwMatrix> {
    return this.http.patch<PtwMatrix>(`${this.baseUrl}/${id}`, changes);
  }
}
