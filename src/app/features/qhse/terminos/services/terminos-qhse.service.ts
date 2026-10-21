import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { VersionTerminos } from '../models/terminos';

/** Administración de los términos y condiciones (permiso `pumping.terminos.validar`). */
@Injectable({ providedIn: 'root' })
export class TerminosQhseService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/pumping/terminos/versiones`;

  versiones(): Observable<VersionTerminos[]> {
    return this.http.get<VersionTerminos[]>(this.base);
  }

  /** Da por válido el texto de una versión tal como está. Devuelve la lista actualizada. */
  validar(codigo: string): Observable<VersionTerminos[]> {
    return this.http.post<VersionTerminos[]>(`${this.base}/${codigo}/validar`, {});
  }

  /** Publica una versión nueva: queda validada y vigente; la anterior se conserva. */
  publicar(titulo: string, texto: string): Observable<VersionTerminos[]> {
    return this.http.post<VersionTerminos[]>(this.base, { titulo, texto });
  }
}
