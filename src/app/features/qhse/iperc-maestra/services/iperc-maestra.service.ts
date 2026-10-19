import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '@env';
import { ArchivosService } from '../../../facturacion/pedidos-comercial/services/archivos.service';
import {
  MODULO_ARCHIVO_IPERC,
  aContenidoDto,
  type ActividadResumen,
  type CatalogosIperc,
  type ContenidoBorrador,
  type MapaCobertura,
  type MatrizDetalle,
  type TipoCatalogo,
} from '../models/iperc';

/** Matriz IPERC maestra del contenedor `qhse`. La autoridad de las reglas, el ciclo y los permisos es el backend (y la base de datos). */
@Injectable({ providedIn: 'root' })
export class IpercMaestraService {
  private readonly http = inject(HttpClient);
  private readonly archivos = inject(ArchivosService);
  private readonly base = `${environment.apiUrl}/v2/qhse/iperc`;

  catalogos(): Observable<CatalogosIperc> {
    return this.http.get<CatalogosIperc>(`${this.base}/catalogos`);
  }

  /** Agrega un proceso, zona, clasificación, «generado en» o cargo (si ya existe escrito de otra forma, devuelve el existente). */
  agregarCatalogo(tipo: TipoCatalogo, nombre: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/catalogos/${tipo}`, { nombre });
  }

  actividades(q = ''): Observable<ActividadResumen[]> {
    return this.http.get<ActividadResumen[]>(`${this.base}/actividades`, {
      params: q.trim() ? new HttpParams().set('q', q.trim()) : undefined,
    });
  }

  crearActividad(cuerpo: {
    procesoId: string;
    zonaId: string;
    nombre: string;
  }): Observable<MatrizDetalle> {
    return this.http.post<MatrizDetalle>(`${this.base}/actividades`, cuerpo);
  }

  /** Revisión anual: crea una versión nueva copiada de la aprobada (la aprobada sigue valiendo mientras se aprueba la nueva). */
  nuevaVersion(actividadId: string): Observable<MatrizDetalle> {
    return this.http.post<MatrizDetalle>(
      `${this.base}/actividades/${actividadId}/nueva-version`,
      {},
    );
  }

  matriz(id: string): Observable<MatrizDetalle> {
    return this.http.get<MatrizDetalle>(`${this.base}/matrices/${id}`);
  }

  guardarContenido(id: string, borrador: ContenidoBorrador): Observable<MatrizDetalle> {
    return this.http.put<MatrizDetalle>(
      `${this.base}/matrices/${id}/contenido`,
      aContenidoDto(borrador),
    );
  }

  iniciarEvaluacion(id: string): Observable<MatrizDetalle> {
    return this.http.post<MatrizDetalle>(`${this.base}/matrices/${id}/iniciar-evaluacion`, {});
  }

  /** Sube el archivo al servicio de archivos y lo enlaza como procedimiento o ATS base (se exigen para aprobar). */
  adjuntar(id: string, tipo: 'procedimiento' | 'ats', archivo: File): Observable<MatrizDetalle> {
    return this.archivos
      .subir(archivo, MODULO_ARCHIVO_IPERC)
      .pipe(
        switchMap((a) =>
          this.http.post<MatrizDetalle>(`${this.base}/matrices/${id}/adjuntos`, {
            tipo,
            archivoId: a.id,
          }),
        ),
      );
  }

  enviarARevision(id: string): Observable<MatrizDetalle> {
    return this.http.post<MatrizDetalle>(`${this.base}/matrices/${id}/enviar-revision`, {});
  }

  aprobar(id: string): Observable<MatrizDetalle> {
    return this.http.post<MatrizDetalle>(`${this.base}/matrices/${id}/aprobar`, {});
  }

  rechazar(id: string, motivo: string): Observable<MatrizDetalle> {
    return this.http.post<MatrizDetalle>(`${this.base}/matrices/${id}/rechazar`, { motivo });
  }

  cobertura(): Observable<MapaCobertura> {
    return this.http.get<MapaCobertura>(`${this.base}/cobertura`);
  }

  /** Códigos de tipo de servicio que QHSE conoce (los nombres los pone el catálogo de comercial si la cuenta puede leerlo). */
  tiposDeServicio(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/tipos-servicio`);
  }

  fijarCobertura(tipoCodigo: string, actividadIds: string[]): Observable<MapaCobertura> {
    return this.http.put<MapaCobertura>(
      `${this.base}/cobertura/${encodeURIComponent(tipoCodigo)}`,
      { actividadIds },
    );
  }

  /** Abre un adjunto (el contenido exige el token: se baja como blob). */
  abrirArchivo(archivoId: string): Observable<Blob> {
    return this.archivos.contenido(archivoId);
  }
}
