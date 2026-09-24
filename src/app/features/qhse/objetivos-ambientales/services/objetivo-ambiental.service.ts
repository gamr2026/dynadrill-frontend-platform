import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ObjetivoAmbiental, CreateObjetivoAmbientalInput } from '../models/objetivo-ambiental.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class ObjetivoAmbientalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/objetivos-ambientales`;

  list(): Observable<ObjetivoAmbiental[]> {
    return this.http.get<ObjetivoAmbiental[]>(this.baseUrl);
  }

  get(id: number): Observable<ObjetivoAmbiental> {
    return this.http.get<ObjetivoAmbiental>(`${this.baseUrl}/${id}`);
  }

  create(input: CreateObjetivoAmbientalInput): Observable<ObjetivoAmbiental> {
    return this.http.post<ObjetivoAmbiental>(this.baseUrl, input);
  }

  update(id: number, changes: Partial<ObjetivoAmbiental>): Observable<ObjetivoAmbiental> {
    return this.http.patch<ObjetivoAmbiental>(`${this.baseUrl}/${id}`, changes);
  }
}
