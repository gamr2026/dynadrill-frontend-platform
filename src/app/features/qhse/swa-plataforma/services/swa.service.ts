import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  ActivarSwa,
  EstadoSwa,
  SwaDetalle,
  SwaResumen,
  TicketDetenible,
  TipoPeligro,
} from '../models/swa';

/** SWA del contenedor `qhse`. La autoridad del ciclo y de los permisos es el backend (y la base de datos). */
@Injectable({ providedIn: 'root' })
export class SwaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v2/qhse/swa`;

  tiposDePeligro(): Observable<TipoPeligro[]> {
    return this.http.get<TipoPeligro[]>(`${this.base}/tipos-peligro`);
  }

  ticketsDetenibles(): Observable<TicketDetenible[]> {
    return this.http.get<TicketDetenible[]>(`${this.base}/tickets`);
  }

  /** Activa la SWA (cualquier trabajador). Devuelve solo lo mínimo: quien activa puede no tener permiso de ver. */
  activar(cuerpo: ActivarSwa): Observable<{ id: string; codigo: string; estado: EstadoSwa }> {
    return this.http.post<{ id: string; codigo: string; estado: EstadoSwa }>(this.base, cuerpo);
  }

  listar(filtro: { estado?: EstadoSwa; q?: string } = {}): Observable<SwaResumen[]> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<SwaResumen[]>(this.base, { params });
  }

  detalle(id: string): Observable<SwaDetalle> {
    return this.http.get<SwaDetalle>(`${this.base}/${id}`);
  }

  notificar(id: string, rolCadenaId: string): Observable<SwaDetalle> {
    return this.http.post<SwaDetalle>(`${this.base}/${id}/notificaciones`, { rolCadenaId });
  }

  evaluar(id: string, riesgoReal: boolean, nota?: string): Observable<SwaDetalle> {
    return this.http.post<SwaDetalle>(`${this.base}/${id}/evaluar`, {
      riesgoReal,
      ...(nota?.trim() ? { nota: nota.trim() } : {}),
    });
  }

  confirmarCriterio(id: string, criterioId: string): Observable<SwaDetalle> {
    return this.http.post<SwaDetalle>(`${this.base}/${id}/reinicio`, { criterioId });
  }

  reanudar(id: string, heroeSeguridad: boolean): Observable<SwaDetalle> {
    return this.http.post<SwaDetalle>(`${this.base}/${id}/reanudar`, { heroeSeguridad });
  }
}
