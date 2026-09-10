import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** Las 4 líneas de servicio que arma Facturación (mismo orden que el backend). */
export type LineaServicio = 'pumping' | 'ctu' | 'fishing' | 'completion';

export const LINEA_SERVICIO_LABELS: Record<LineaServicio, string> = {
  pumping: 'Pumping',
  ctu: 'CTU (Coiled Tubing)',
  fishing: 'Fishing (Pesca)',
  completion: 'Completion',
};

/** Mapa `{ linea: actividades[] }` — el backend siempre devuelve las 4 líneas. */
export type CoberturaMapa = Record<LineaServicio, string[]>;

/**
 * `qhse/iperc-cobertura` — qué actividades de la Matriz Maestra IPERC exige
 * cada línea de servicio. El puente Facturación→QHSE lo lee al crear el
 * ticket; acá se administra. Editar una línea con una actividad nueva abre
 * la solicitud (matriz en borrador) para que HSE la evalúe y apruebe.
 */
@Injectable({ providedIn: 'root' })
export class IpercCoberturaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/qhse/iperc-cobertura';

  getAll(): Observable<CoberturaMapa> {
    return this.http.get<CoberturaMapa>(this.baseUrl);
  }

  setLinea(linea: LineaServicio, actividades: string[]): Observable<CoberturaMapa> {
    return this.http.put<CoberturaMapa>(`${this.baseUrl}/${linea}`, { actividades });
  }
}
