import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  AspectoDetalle,
  BandejaAspectos,
  CatalogosAspectos,
  Clasificacion,
  CrearAspecto,
  EstadoAspecto,
  EstadoControl,
} from '../models/aspecto-ambiental.model';

/** Aspectos ambientales del contenedor `qhse`. La autoridad de las reglas (rangos, baja, permisos) es el backend y la base de datos. */
@Injectable({ providedIn: 'root' })
export class AspectoAmbientalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v2/qhse/aspectos-ambientales`;

  catalogos(): Observable<CatalogosAspectos> {
    return this.http.get<CatalogosAspectos>(`${this.baseUrl}/catalogos`);
  }

  list(
    filtro: {
      clasificacion?: Clasificacion;
      estadoControl?: EstadoControl;
      estado?: EstadoAspecto;
      q?: string;
    } = {},
  ): Observable<BandejaAspectos> {
    let params = new HttpParams();
    if (filtro.clasificacion) params = params.set('clasificacion', filtro.clasificacion);
    if (filtro.estadoControl) params = params.set('estadoControl', filtro.estadoControl);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<BandejaAspectos>(this.baseUrl, { params });
  }

  get(id: string): Observable<AspectoDetalle> {
    return this.http.get<AspectoDetalle>(`${this.baseUrl}/${id}`);
  }

  create(input: CrearAspecto): Observable<AspectoDetalle> {
    return this.http.post<AspectoDetalle>(this.baseUrl, input);
  }

  /** Cambios parciales: lo que no se envía queda como estaba (por ejemplo, solo el estado del control). */
  update(id: string, cambios: Partial<CrearAspecto>): Observable<AspectoDetalle> {
    return this.http.patch<AspectoDetalle>(`${this.baseUrl}/${id}`, cambios);
  }

  /** Registro de seguimiento: si los controles fueron eficaces y la observación. No se reescribe. */
  registrarSeguimiento(
    id: string,
    s: { fecha?: string; eficaz: boolean; observacion: string },
  ): Observable<AspectoDetalle> {
    return this.http.post<AspectoDetalle>(`${this.baseUrl}/${id}/seguimientos`, s);
  }

  /** Da de baja el aspecto con su motivo (no se borra): queda congelado. */
  darDeBaja(id: string, motivo: string): Observable<AspectoDetalle> {
    return this.http.post<AspectoDetalle>(`${this.baseUrl}/${id}/baja`, { motivo });
  }
}
