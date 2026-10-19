import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { FasePtw, PtwDetalle, PtwResumen, TipoConfirmacion } from '../models/permiso-trabajo';

/** Permisos de trabajo del contenedor `qhse`. La autoridad de fases, reglas y permisos es el backend (y la base de datos). */
@Injectable({ providedIn: 'root' })
export class PermisoTrabajoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v2/qhse/ptw`;

  listar(
    filtro: { fase?: FasePtw; q?: string; incluirAnulados?: boolean } = {},
  ): Observable<PtwResumen[]> {
    let params = new HttpParams();
    if (filtro.fase) params = params.set('fase', filtro.fase);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    if (filtro.incluirAnulados) params = params.set('incluirAnulados', 'true');
    return this.http.get<PtwResumen[]>(this.base, { params });
  }

  detalle(id: string): Observable<PtwDetalle> {
    return this.http.get<PtwDetalle>(`${this.base}/${id}`);
  }

  abrir(ticketId: string, diaOperacion: string): Observable<PtwDetalle> {
    return this.http.post<PtwDetalle>(this.base, { ticketId, diaOperacion });
  }

  validarDocumentos(id: string): Observable<PtwDetalle> {
    return this.http.post<PtwDetalle>(`${this.base}/${id}/validar-documentos`, {});
  }

  confirmar(id: string, tipo: TipoConfirmacion): Observable<PtwDetalle> {
    return this.http.post<PtwDetalle>(`${this.base}/${id}/confirmaciones`, { tipo });
  }

  aprobar(id: string): Observable<PtwDetalle> {
    return this.http.post<PtwDetalle>(`${this.base}/${id}/aprobar`, {});
  }

  anular(id: string, motivo: string): Observable<PtwDetalle> {
    return this.http.post<PtwDetalle>(`${this.base}/${id}/anular`, { motivo });
  }
}
