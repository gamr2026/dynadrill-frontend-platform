import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateInvestigacionInput, Investigacion } from '../models/investigacion.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class InvestigacionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/investigaciones`;

  list(): Observable<Investigacion[]> {
    return this.http.get<Investigacion[]>(this.baseUrl);
  }

  get(id: number): Observable<Investigacion> {
    return this.http.get<Investigacion>(`${this.baseUrl}/${id}`);
  }

  abrir(input: CreateInvestigacionInput): Observable<Investigacion> {
    return this.http.post<Investigacion>(this.baseUrl, input);
  }

  update(id: number, changes: Partial<Investigacion>): Observable<Investigacion> {
    return this.http.patch<Investigacion>(`${this.baseUrl}/${id}`, changes);
  }
}
