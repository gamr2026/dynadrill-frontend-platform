import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '@env';
import { ArchivosService } from '../../../facturacion/pedidos-comercial/services/archivos.service';
import {
  MODULO_ARCHIVO_REQUISITO_LEGAL,
  type RegistrarRevisionLegal,
  type RequisitoLegalGrupo,
  type RevisionLegal,
} from '../models/documento-legal.model';

/** Requisitos legales del contenedor `qhse`. La autoridad de las reglas (una vigente por tipo, vigencias) es el backend y la base de datos. */
@Injectable({ providedIn: 'root' })
export class DocumentoLegalService {
  private readonly http = inject(HttpClient);
  private readonly archivos = inject(ArchivosService);
  private readonly baseUrl = `${environment.apiUrl}/v2/qhse/legal`;

  /** Por cada tipo: su revisión vigente y su historial. */
  listar(): Observable<RequisitoLegalGrupo[]> {
    return this.http.get<RequisitoLegalGrupo[]>(this.baseUrl);
  }

  /** Sube el documento al servicio de archivos y registra la revisión nueva (la anterior del tipo queda reemplazada). */
  registrarRevision(
    datos: Omit<RegistrarRevisionLegal, 'archivoId'>,
    archivo: File,
  ): Observable<RevisionLegal> {
    return this.archivos
      .subir(archivo, MODULO_ARCHIVO_REQUISITO_LEGAL)
      .pipe(
        switchMap((a) =>
          this.http.post<RevisionLegal>(this.baseUrl, { ...datos, archivoId: a.id }),
        ),
      );
  }

  /** El contenido exige el token: se baja como blob por el servicio de archivos. */
  descargar(archivoId: string): Observable<Blob> {
    return this.archivos.contenido(archivoId);
  }
}
