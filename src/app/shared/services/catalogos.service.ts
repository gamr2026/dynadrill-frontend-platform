import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { Bloque, Campo, Pozo, Taladro } from '../models/catalogos.model';
import { environment } from '@env';

/** Catálogos de ubicación operativa (Campo / Bloque / Taladro / Pozo). */
@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalogos`;

  bloques(): Observable<Bloque[]> {
    return this.http.get<Bloque[]>(`${this.base}/bloques`);
  }

  campos(): Observable<Campo[]> {
    return this.http.get<Campo[]>(`${this.base}/campos`);
  }

  taladros(): Observable<Taladro[]> {
    return this.http.get<Taladro[]>(`${this.base}/taladros`);
  }

  /** El pozo viene con su campo y su bloque anidados. Filtro opcional para las cascadas. */
  pozos(filtro?: { campoId?: number; bloqueId?: number }): Observable<Pozo[]> {
    let params = new HttpParams();
    if (filtro?.campoId) params = params.set('campoId', filtro.campoId);
    if (filtro?.bloqueId) params = params.set('bloqueId', filtro.bloqueId);
    return this.http.get<Pozo[]>(`${this.base}/pozos`, { params });
  }
}
