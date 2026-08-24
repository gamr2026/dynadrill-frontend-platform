import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateInspeccionInput, InspeccionEquipo } from '../models/inspeccion-equipo.model';

@Injectable({ providedIn: 'root' })
export class InspeccionEquipoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/qhse/inspecciones';

  list(): Observable<InspeccionEquipo[]> {
    return this.http.get<InspeccionEquipo[]>(this.baseUrl);
  }

  create(input: CreateInspeccionInput): Observable<InspeccionEquipo> {
    return this.http.post<InspeccionEquipo>(this.baseUrl, input);
  }
}
