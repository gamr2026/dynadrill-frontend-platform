import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { TipoServicio, TIPO_SERVICIO_LABELS } from '../../../facturacion/models/pedido.model';

/**
 * Reexportados desde pedido.model.ts para no duplicar el esquema — la
 * cobertura IPERC se indexa por tipo de servicio (segundo select del
 * Pedido, 6 valores), no por la línea (que quedó reducida a FCR/Pumping).
 */
export type LineaServicio = TipoServicio;
export const LINEA_SERVICIO_LABELS = TIPO_SERVICIO_LABELS;

/** Mapa `{ tipoServicio: actividades[] }` — el backend siempre devuelve las 6 categorías. */
export type CoberturaMapa = Record<TipoServicio, string[]>;

/**
 * `qhse/iperc-cobertura` — qué actividades de la Matriz Maestra IPERC exige
 * cada tipo de servicio. El puente Facturación→QHSE lo lee al crear el
 * ticket; acá se administra. Editar una línea con una actividad nueva abre
 * la solicitud (matriz en borrador) para que HSE la evalúe y apruebe.
 */
@Injectable({ providedIn: 'root' })
export class IpercCoberturaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/iperc-cobertura`;

  getAll(): Observable<CoberturaMapa> {
    return this.http.get<CoberturaMapa>(this.baseUrl);
  }

  setLinea(linea: TipoServicio, actividades: string[]): Observable<CoberturaMapa> {
    return this.http.put<CoberturaMapa>(`${this.baseUrl}/${linea}`, { actividades });
  }
}
