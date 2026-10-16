import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { AceptacionTerminosHistorial, FiltroAceptaciones } from '../models/aceptacion-terminos';

/** Consulta del historial de aceptaciones de términos y condiciones: lo guarda y lo entrega Pumping (contenedor operaciones). */
@Injectable({ providedIn: 'root' })
export class TerminosHistorialService {
  private readonly http = inject(HttpClient);

  historial(filtro: FiltroAceptaciones = {}): Observable<AceptacionTerminosHistorial[]> {
    let params = new HttpParams();
    if (filtro.cedula?.trim()) params = params.set('cedula', filtro.cedula.trim());
    if (filtro.nombre?.trim()) params = params.set('nombre', filtro.nombre.trim());
    return this.http.get<AceptacionTerminosHistorial[]>(`${environment.apiUrl}/operaciones/pumping/terminos/aceptaciones`, { params });
  }
}
