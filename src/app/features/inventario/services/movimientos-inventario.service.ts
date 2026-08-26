import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateMovimientoInput, MovimientoInventario } from '../models/articulo.model';

@Injectable({ providedIn: 'root' })
export class MovimientosInventarioService {
  private readonly http = inject(HttpClient);

  list(articuloId: number): Observable<MovimientoInventario[]> {
    return this.http.get<MovimientoInventario[]>('/api/movimientos-inventario', {
      params: new HttpParams().set('articuloId', articuloId),
    });
  }

  /** El backend calcula saldoResultante y rechaza una salida que deje el stock en negativo. */
  registrar(input: CreateMovimientoInput): Observable<MovimientoInventario> {
    return this.http.post<MovimientoInventario>('/api/movimientos-inventario', input);
  }
}
