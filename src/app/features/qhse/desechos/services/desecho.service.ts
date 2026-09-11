import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateDesechoInput, Desecho } from '../models/desecho.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class DesechoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/desechos`;

  list(): Observable<Desecho[]> {
    return this.http.get<Desecho[]>(this.baseUrl);
  }

  get(id: number): Observable<Desecho> {
    return this.http.get<Desecho>(`${this.baseUrl}/${id}`);
  }

  create(input: CreateDesechoInput): Observable<Desecho> {
    return this.http.post<Desecho>(this.baseUrl, input);
  }

  update(id: number, changes: Partial<Desecho>): Observable<Desecho> {
    return this.http.patch<Desecho>(`${this.baseUrl}/${id}`, changes);
  }
}
