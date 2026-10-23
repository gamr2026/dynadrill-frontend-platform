import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  ActivarDerrame,
  ActualizarBanda,
  BandaConfigurable,
  CatalogosDerrame,
  CatalogosDesechoDerrame,
  DerrameActivado,
  DerrameDetalle,
  DerrameResumen,
  EstadoDerrame,
  GenerarDesechoDerrame,
  TableroDerrames,
} from '../models/derrame';

/** Derrames del contenedor `qhse`. La autoridad del ciclo y de los permisos es el backend (y la base de datos). */
@Injectable({ providedIn: 'root' })
export class DerrameService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v2/qhse/derrames`;

  catalogos(): Observable<CatalogosDerrame> {
    return this.http.get<CatalogosDerrame>(`${this.base}/catalogos`);
  }

  /** Contenedores y características CRETIB para el desecho que genera un derrame en suelo. */
  catalogosDeDesecho(): Observable<CatalogosDesechoDerrame> {
    return this.http.get<CatalogosDesechoDerrame>(
      `${environment.apiUrl}/v2/qhse/desechos/catalogos`,
    );
  }

  /** Activa la alerta (cualquier trabajador). Devuelve solo lo mínimo: quien activa puede no tener permiso de ver. */
  activar(cuerpo: ActivarDerrame): Observable<DerrameActivado> {
    return this.http.post<DerrameActivado>(this.base, cuerpo);
  }

  listar(filtro: { estado?: EstadoDerrame; q?: string } = {}): Observable<DerrameResumen[]> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<DerrameResumen[]>(this.base, { params });
  }

  detalle(id: string): Observable<DerrameDetalle> {
    return this.http.get<DerrameDetalle>(`${this.base}/${id}`);
  }

  tablero(anio?: number): Observable<TableroDerrames> {
    const params = anio ? new HttpParams().set('anio', anio) : undefined;
    return this.http.get<TableroDerrames>(`${this.base}/resumen`, { params });
  }

  confirmarPaso(id: string, itemId: string): Observable<DerrameDetalle> {
    return this.http.post<DerrameDetalle>(`${this.base}/${id}/checklist`, { itemId });
  }

  contener(id: string): Observable<DerrameDetalle> {
    return this.http.post<DerrameDetalle>(`${this.base}/${id}/contener`, {});
  }

  confirmarVolumen(id: string, barriles: number): Observable<DerrameDetalle> {
    return this.http.post<DerrameDetalle>(`${this.base}/${id}/volumen`, { barriles });
  }

  notificarMae(id: string, referencia?: string): Observable<DerrameDetalle> {
    return this.http.post<DerrameDetalle>(`${this.base}/${id}/notificar-mae`, {
      ...(referencia?.trim() ? { referencia: referencia.trim() } : {}),
    });
  }

  cerrar(id: string): Observable<DerrameDetalle> {
    return this.http.post<DerrameDetalle>(`${this.base}/${id}/cerrar`, {});
  }

  generarDesecho(id: string, cuerpo: GenerarDesechoDerrame): Observable<DerrameDetalle> {
    return this.http.post<DerrameDetalle>(`${this.base}/${id}/generar-desecho`, cuerpo);
  }

  bandas(): Observable<BandaConfigurable[]> {
    return this.http.get<BandaConfigurable[]>(`${this.base}/bandas`);
  }

  actualizarBanda(id: string, cuerpo: ActualizarBanda): Observable<BandaConfigurable> {
    return this.http.put<BandaConfigurable>(`${this.base}/bandas/${id}`, cuerpo);
  }
}
