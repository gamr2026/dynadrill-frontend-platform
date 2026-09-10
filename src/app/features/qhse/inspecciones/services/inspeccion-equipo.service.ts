import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateInspeccionInput, InspeccionEquipo } from '../models/inspeccion-equipo.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class InspeccionEquipoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/inspecciones`;

  list(): Observable<InspeccionEquipo[]> {
    return this.http.get<InspeccionEquipo[]>(this.baseUrl);
  }

  create(input: CreateInspeccionInput): Observable<InspeccionEquipo> {
    return this.http.post<InspeccionEquipo>(this.baseUrl, input);
  }
}
