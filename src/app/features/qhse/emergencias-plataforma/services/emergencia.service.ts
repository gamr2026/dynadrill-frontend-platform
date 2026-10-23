import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  ActivarEmergencia,
  CatalogosEmergencia,
  DatosMedevac,
  EmergenciaDetalle,
  EmergenciaResumen,
  EstadoEmergencia,
  Hospital,
  NivelEmergencia,
  NuevoHerido,
  NuevoReporteFlash,
  NuevosSignos,
  TableroEmergencias,
  TriageColor,
} from '../models/emergencia';

/** Emergencias / MEDEVAC del contenedor `qhse`. La autoridad del ciclo y de los permisos es el backend (y la base de datos). */
@Injectable({ providedIn: 'root' })
export class EmergenciaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v2/qhse/emergencias`;

  catalogos(): Observable<CatalogosEmergencia> {
    return this.http.get<CatalogosEmergencia>(`${this.base}/catalogos`);
  }

  /** Activa la emergencia (cualquier trabajador). Devuelve solo lo mínimo: quien activa puede no tener permiso de ver. */
  activar(
    cuerpo: ActivarEmergencia,
  ): Observable<{ id: string; codigo: string; estado: EstadoEmergencia }> {
    return this.http.post<{ id: string; codigo: string; estado: EstadoEmergencia }>(
      this.base,
      cuerpo,
    );
  }

  listar(filtro: { estado?: EstadoEmergencia; q?: string } = {}): Observable<EmergenciaResumen[]> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<EmergenciaResumen[]>(this.base, { params });
  }

  detalle(id: string): Observable<EmergenciaDetalle> {
    return this.http.get<EmergenciaDetalle>(`${this.base}/${id}`);
  }

  tablero(anio?: number): Observable<TableroEmergencias> {
    let params = new HttpParams();
    if (anio) params = params.set('anio', anio);
    return this.http.get<TableroEmergencias>(`${this.base}/resumen`, { params });
  }

  // ------------------------------------------------------------------------------------------------ hospitales

  hospitales(): Observable<Hospital[]> {
    return this.http.get<Hospital[]>(`${this.base}/hospitales`);
  }

  agregarHospital(cuerpo: {
    nombre: string;
    ciudad: string;
    telefono?: string;
  }): Observable<Hospital> {
    return this.http.post<Hospital>(`${this.base}/hospitales`, cuerpo);
  }

  // ------------------------------------------------------------------------------------------- plan de la emergencia

  agregarLinea(id: string, texto: string): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(`${this.base}/${id}/cronometro`, { texto });
  }

  declararNivel(id: string, nivel: NivelEmergencia): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(`${this.base}/${id}/nivel`, { nivel });
  }

  registrarConteo(
    id: string,
    totalEnLocacion: number,
    evacuados: number,
  ): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(`${this.base}/${id}/conteo`, {
      totalEnLocacion,
      evacuados,
    });
  }

  notificarPaso(id: string, pasoId: string): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(`${this.base}/${id}/notificaciones`, { pasoId });
  }

  // ------------------------------------------------------------------------------------ heridos, triage y MEDEVAC

  registrarHerido(id: string, herido: NuevoHerido): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(`${this.base}/${id}/heridos`, herido);
  }

  actualizarHerido(
    id: string,
    heridoId: string,
    cambios: { triage?: TriageColor; lesiones?: string; tratamientoCampo?: string },
  ): Observable<EmergenciaDetalle> {
    return this.http.patch<EmergenciaDetalle>(`${this.base}/${id}/heridos/${heridoId}`, cambios);
  }

  registrarSignos(
    id: string,
    heridoId: string,
    signos: NuevosSignos,
  ): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(
      `${this.base}/${id}/heridos/${heridoId}/signos-vitales`,
      signos,
    );
  }

  activarMedevac(id: string, heridoId: string): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(`${this.base}/${id}/heridos/${heridoId}/medevac`, {});
  }

  datosMedevac(id: string, heridoId: string, datos: DatosMedevac): Observable<EmergenciaDetalle> {
    return this.http.put<EmergenciaDetalle>(
      `${this.base}/${id}/heridos/${heridoId}/medevac`,
      datos,
    );
  }

  notificarHospital(id: string, heridoId: string): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(
      `${this.base}/${id}/heridos/${heridoId}/hospital-notificado`,
      {},
    );
  }

  transferir(id: string, heridoId: string): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(
      `${this.base}/${id}/heridos/${heridoId}/transferir`,
      {},
    );
  }

  // -------------------------------------------------------------------------- Reporte Flash, controlada y cierre

  emitirReporteFlash(id: string, reporte: NuevoReporteFlash): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(`${this.base}/${id}/reporte-flash`, reporte);
  }

  controlar(id: string): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(`${this.base}/${id}/controlar`, {});
  }

  cerrar(id: string): Observable<EmergenciaDetalle> {
    return this.http.post<EmergenciaDetalle>(`${this.base}/${id}/cerrar`, {});
  }
}
