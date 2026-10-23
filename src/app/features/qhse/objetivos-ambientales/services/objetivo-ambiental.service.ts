import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  BandejaObjetivos,
  CatalogosObjetivos,
  CerrarObjetivo,
  CrearObjetivo,
  EstadoObjetivoAmbiental,
  ObjetivoDetalle,
} from '../models/objetivo-ambiental.model';

/** Objetivos ambientales del contenedor `qhse`. La autoridad del ciclo y de los permisos es el backend (y la base de datos). */
@Injectable({ providedIn: 'root' })
export class ObjetivoAmbientalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v2/qhse/objetivos-ambientales`;

  catalogos(): Observable<CatalogosObjetivos> {
    return this.http.get<CatalogosObjetivos>(`${this.baseUrl}/catalogos`);
  }

  list(
    filtro: { estado?: EstadoObjetivoAmbiental; q?: string } = {},
  ): Observable<BandejaObjetivos> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<BandejaObjetivos>(this.baseUrl, { params });
  }

  get(id: string): Observable<ObjetivoDetalle> {
    return this.http.get<ObjetivoDetalle>(`${this.baseUrl}/${id}`);
  }

  create(input: CrearObjetivo): Observable<ObjetivoDetalle> {
    return this.http.post<ObjetivoDetalle>(this.baseUrl, input);
  }

  /** Agrega un registro de seguimiento (fecha, avance y observación). No se reescribe: un error se corrige con otro registro. */
  registrarSeguimiento(
    id: string,
    s: { fecha?: string; avancePorcentaje: number; observacion: string },
  ): Observable<ObjetivoDetalle> {
    return this.http.post<ObjetivoDetalle>(`${this.baseUrl}/${id}/seguimientos`, s);
  }

  /** Cierra el objetivo como cumplido o no cumplido, con su resultado. Queda congelado. */
  cerrar(id: string, c: CerrarObjetivo): Observable<ObjetivoDetalle> {
    return this.http.post<ObjetivoDetalle>(`${this.baseUrl}/${id}/cerrar`, c);
  }
}
