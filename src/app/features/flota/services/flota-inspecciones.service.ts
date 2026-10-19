import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  CasoInspeccion,
  ConductorEstado,
  InspeccionDetalle,
  InspeccionResumen,
  ItemInspeccion,
  MomentoInspeccion,
  PermisoHistoria,
  RegistrarInspeccionEntrada,
  TipoPermiso,
} from '../models/inspeccion-flota.model';

/** Inspección de vehículos y documentos de los conductores (contenedor `operaciones`). */
@Injectable({ providedIn: 'root' })
export class FlotaInspeccionesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/flota`;

  items(): Observable<ItemInspeccion[]> {
    return this.http.get<ItemInspeccion[]>(`${this.base}/inspecciones-vehiculo/items`);
  }

  /** Casos del ticket con el estado de la inspección de cada unidad. */
  casos(ticketId: string): Observable<CasoInspeccion[]> {
    return this.http.get<CasoInspeccion[]>(`${this.base}/inspecciones-vehiculo/casos`, {
      params: { ticketId },
    });
  }

  misCasos(): Observable<CasoInspeccion[]> {
    return this.http.get<CasoInspeccion[]>(`${this.base}/inspecciones-vehiculo/mis-casos`);
  }

  listar(
    filtro: {
      ticketId?: string;
      unidadId?: string;
      momento?: MomentoInspeccion;
      incluirAnuladas?: boolean;
    } = {},
  ): Observable<InspeccionResumen[]> {
    let params = new HttpParams();
    if (filtro.ticketId) params = params.set('ticketId', filtro.ticketId);
    if (filtro.unidadId) params = params.set('unidadId', filtro.unidadId);
    if (filtro.momento) params = params.set('momento', filtro.momento);
    if (filtro.incluirAnuladas) params = params.set('incluirAnuladas', 'true');
    return this.http.get<InspeccionResumen[]>(`${this.base}/inspecciones-vehiculo`, { params });
  }

  obtener(id: string): Observable<InspeccionDetalle> {
    return this.http.get<InspeccionDetalle>(`${this.base}/inspecciones-vehiculo/${id}`);
  }

  registrar(
    cuerpo: RegistrarInspeccionEntrada,
  ): Observable<{ id: string; hayNovedades: boolean; bloqueaUso: boolean }> {
    return this.http.post<{ id: string; hayNovedades: boolean; bloqueaUso: boolean }>(
      `${this.base}/inspecciones-vehiculo`,
      cuerpo,
    );
  }

  aprobar(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/inspecciones-vehiculo/${id}/aprobar`, {});
  }

  rechazar(id: string, motivo: string): Observable<unknown> {
    return this.http.post(`${this.base}/inspecciones-vehiculo/${id}/rechazar`, { motivo });
  }

  anular(id: string, motivo: string): Observable<unknown> {
    return this.http.post(`${this.base}/inspecciones-vehiculo/${id}/anular`, { motivo });
  }

  // ---- conductores
  conductores(q?: string): Observable<ConductorEstado[]> {
    let params = new HttpParams();
    if (q?.trim()) params = params.set('q', q.trim());
    return this.http.get<ConductorEstado[]>(`${this.base}/conductores`, { params });
  }

  conductor(usuarioId: string): Observable<ConductorEstado> {
    return this.http.get<ConductorEstado>(`${this.base}/conductores/${usuarioId}`);
  }

  tiposPermiso(): Observable<TipoPermiso[]> {
    return this.http.get<TipoPermiso[]>(`${this.base}/conductores/tipos-permiso`);
  }

  registrarPermiso(
    usuarioId: string,
    cuerpo: { tipoId: string; vigenteHasta?: string | null; observaciones?: string | null },
  ): Observable<unknown> {
    return this.http.post(`${this.base}/conductores/${usuarioId}/permisos`, cuerpo);
  }

  historiaPermisos(usuarioId: string): Observable<PermisoHistoria[]> {
    return this.http.get<PermisoHistoria[]>(`${this.base}/conductores/${usuarioId}/permisos`);
  }

  anularPermiso(permisoId: string, motivo: string): Observable<unknown> {
    return this.http.post(`${this.base}/conductores/permisos/${permisoId}/anular`, { motivo });
  }
}
