import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateMovimientoInput, MovimientoInventario } from '../models/articulo.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class MovimientosInventarioService {
  private readonly http = inject(HttpClient);

  list(articuloId: number): Observable<MovimientoInventario[]> {
    return this.http.get<MovimientoInventario[]>(`${environment.apiUrl}/movimientos-inventario`, {
      params: new HttpParams().set('articuloId', articuloId),
    });
  }

  /** El backend calcula saldoResultante y rechaza una salida que deje el stock en negativo. */
  registrar(input: CreateMovimientoInput): Observable<MovimientoInventario> {
    return this.http.post<MovimientoInventario>(`${environment.apiUrl}/movimientos-inventario`, input);
  }
}
