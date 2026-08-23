import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Unidad } from '../models/unidad.model';

export interface RegistrarPMInput {
  intervaloHoras?: number;
  horometroAlMomento?: number;
  kmAlMomento?: number;
  fecha: string;
  responsable: string;
  observaciones?: string;
}

@Injectable({ providedIn: 'root' })
export class UnidadesService {
  private readonly http = inject(HttpClient);

  list(): Observable<Unidad[]> {
    return this.http.get<Unidad[]>('/api/unidades');
  }

  registrarMantenimiento(unidadId: number, input: RegistrarPMInput): Observable<Unidad> {
    return this.http.patch<Unidad>(`/api/unidades/${unidadId}/mantenimiento`, input);
  }
}
