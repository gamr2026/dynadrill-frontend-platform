import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { MODULO_ARCHIVO_PEDIDO, type ArchivoSubido } from '../models/documentos-pedido';

/** Módulo de archivos de plataforma: subida multipart y descarga autenticada. */
@Injectable({ providedIn: 'root' })
export class ArchivosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/archivos`;

  /** `POST /api/archivos` (multipart: `modulo` y `archivo`). */
  subir(archivo: File, modulo: string = MODULO_ARCHIVO_PEDIDO): Observable<ArchivoSubido> {
    const form = new FormData();
    form.append('modulo', modulo);
    form.append('archivo', archivo, archivo.name);
    return this.http.post<ArchivoSubido>(this.base, form);
  }

  /** El contenido exige el token Bearer: se baja como blob con HttpClient (un enlace directo no lo llevaría). */
  contenido(archivoId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${archivoId}/contenido`, { responseType: 'blob' });
  }

  /** Dispara la descarga del blob con un object URL y lo revoca después. */
  guardarComo(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
