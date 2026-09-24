import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AspectoAmbiental, CreateAspectoAmbientalInput } from '../models/aspecto-ambiental.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class AspectoAmbientalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/aspectos-ambientales`;

  list(): Observable<AspectoAmbiental[]> {
    return this.http.get<AspectoAmbiental[]>(this.baseUrl);
  }

  get(id: number): Observable<AspectoAmbiental> {
    return this.http.get<AspectoAmbiental>(`${this.baseUrl}/${id}`);
  }

  create(input: CreateAspectoAmbientalInput): Observable<AspectoAmbiental> {
    return this.http.post<AspectoAmbiental>(this.baseUrl, input);
  }

  update(id: number, changes: Partial<AspectoAmbiental>): Observable<AspectoAmbiental> {
    return this.http.patch<AspectoAmbiental>(`${this.baseUrl}/${id}`, changes);
  }
}
