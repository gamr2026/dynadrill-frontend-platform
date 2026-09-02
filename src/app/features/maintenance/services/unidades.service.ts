import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUnidadInput, TipoServicio, Unidad, UpdatePatrimonioInput } from '../models/unidad.model';

export interface RegistrarPMInput {
  tipoServicio?: TipoServicio;
  horometroAlMomento?: number;
  kmAlMomento?: number;
  fecha: string;
  responsable: string;
  observaciones?: string;
  /** Nombre del checklist de fábrica adjuntado (formato propio del fabricante) — solo aplica a mantenimiento Interno. */
  checklistFabricanteArchivo?: string;
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

  create(input: CreateUnidadInput): Observable<Unidad> {
    return this.http.post<Unidad>('/api/unidades', input);
  }

  registrarMantenimiento(unidadId: number, input: RegistrarPMInput): Observable<Unidad> {
    return this.http.patch<Unidad>(`/api/unidades/${unidadId}/mantenimiento`, input);
  }

  /** Módulo Inventario — solo los campos patrimoniales, nunca los operativos. */
  updatePatrimonio(unidadId: number, input: UpdatePatrimonioInput): Observable<Unidad> {
    return this.http.patch<Unidad>(`/api/unidades/${unidadId}/patrimonio`, input);
  }
}
