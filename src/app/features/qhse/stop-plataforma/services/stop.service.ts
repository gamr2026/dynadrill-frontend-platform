import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '@env';
import { ArchivosService } from '../../../facturacion/pedidos-comercial/services/archivos.service';
import {
  MODULO_ARCHIVO_STOP_FOTO,
  type EstadoStop,
  type FormatoStop,
  type RegistrarStop,
  type StopDetalle,
  type StopResumen,
  type Tendencias,
} from '../models/stop';

/** Tarjetas STOP del contenedor `qhse`. La autoridad del ciclo y de los permisos es el backend (y la base de datos). */
@Injectable({ providedIn: 'root' })
export class StopService {
  private readonly http = inject(HttpClient);
  private readonly archivos = inject(ArchivosService);
  private readonly base = `${environment.apiUrl}/v2/qhse/stop`;

  formato(): Observable<FormatoStop> {
    return this.http.get<FormatoStop>(`${this.base}/formato`);
  }

  /** Registra la tarjeta (cualquier trabajador). Con foto: se sube primero al servicio de archivos y se enlaza. */
  registrar(
    cuerpo: RegistrarStop,
    foto?: File | null,
  ): Observable<{ id: string; codigo: string; estado: EstadoStop }> {
    if (!foto)
      return this.http.post<{ id: string; codigo: string; estado: EstadoStop }>(this.base, cuerpo);
    return this.archivos
      .subir(foto, MODULO_ARCHIVO_STOP_FOTO)
      .pipe(
        switchMap((a) =>
          this.http.post<{ id: string; codigo: string; estado: EstadoStop }>(this.base, {
            ...cuerpo,
            fotoArchivoId: a.id,
          }),
        ),
      );
  }

  listar(filtro: { estado?: EstadoStop; q?: string } = {}): Observable<StopResumen[]> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<StopResumen[]>(this.base, { params });
  }

  detalle(id: string): Observable<StopDetalle> {
    return this.http.get<StopDetalle>(`${this.base}/${id}`);
  }

  tendencias(): Observable<Tendencias> {
    return this.http.get<Tendencias>(`${this.base}/tendencias`);
  }

  derivar(
    id: string,
    destino: 'mantenimiento' | 'otro',
    observacion: string,
  ): Observable<StopDetalle> {
    return this.http.post<StopDetalle>(`${this.base}/${id}/derivar`, { destino, observacion });
  }

  resolver(id: string, observacion: string): Observable<StopDetalle> {
    return this.http.post<StopDetalle>(`${this.base}/${id}/resolver`, { observacion });
  }

  cerrar(id: string): Observable<StopDetalle> {
    return this.http.post<StopDetalle>(`${this.base}/${id}/cerrar`, {});
  }

  abrirFoto(archivoId: string): Observable<Blob> {
    return this.archivos.contenido(archivoId);
  }
}
