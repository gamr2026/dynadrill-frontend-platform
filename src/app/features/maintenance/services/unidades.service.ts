import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TipoServicio, Unidad } from '../models/unidad.model';

export interface RegistrarPMInput {
  tipoServicio?: TipoServicio;
  horometroAlMomento?: number;
  kmAlMomento?: number;
  fecha: string;
  responsable: string;
  observaciones?: string;
  /** D2: solo se registra que el check list interno se completó — su contenido queda fuera del sistema. */
  checklistRealizado?: boolean;
  ejecutadoPor: 'Interno' | 'Tercero';
  /** Requerido cuando ejecutadoPor = 'Tercero'. */
  proveedor?: string;
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
