import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  EstadoEquipo,
  InspeccionDetalle,
  InspeccionResumen,
  RegistrarInspeccion,
  ResultadoInspeccion,
  TipoInspeccion,
} from '../models/inspeccion';

/** Inspecciones de campo del contenedor `qhse`. La autoridad de las reglas y los permisos es el backend (y la base de datos). */
@Injectable({ providedIn: 'root' })
export class InspeccionesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v2/qhse/inspecciones`;

  tipos(): Observable<TipoInspeccion[]> {
    return this.http.get<TipoInspeccion[]>(`${this.base}/tipos`);
  }

  /** Registra la inspección (cualquier usuario). Devuelve solo lo mínimo: quien inspecciona puede no tener permiso de ver la bandeja. */
  registrar(
    cuerpo: RegistrarInspeccion,
  ): Observable<{
    id: string;
    codigo: string;
    resultado: ResultadoInspeccion;
    enCuarentena: boolean;
  }> {
    return this.http.post<{
      id: string;
      codigo: string;
      resultado: ResultadoInspeccion;
      enCuarentena: boolean;
    }>(this.base, cuerpo);
  }

  listar(
    filtro: { resultado?: ResultadoInspeccion; q?: string } = {},
  ): Observable<InspeccionResumen[]> {
    let params = new HttpParams();
    if (filtro.resultado) params = params.set('resultado', filtro.resultado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<InspeccionResumen[]>(this.base, { params });
  }

  detalle(id: string): Observable<InspeccionDetalle> {
    return this.http.get<InspeccionDetalle>(`${this.base}/${id}`);
  }

  /** Cuarentena y próxima inspección debida de cada equipo. */
  equipos(): Observable<EstadoEquipo[]> {
    return this.http.get<EstadoEquipo[]>(`${this.base}/equipos`);
  }
}
