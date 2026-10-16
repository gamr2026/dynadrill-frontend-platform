import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { As2PedidoResumen, As2PedidosFiltro, As2PedidosPagina, As2Resumen } from '../models/pedido-comercial.model';
import { construirParametros } from './pedidos-comercial.service';

/** Lectura de los pedidos de cliente de AS2 (año en curso, solo lectura; el portal no guarda nada de AS2). */
@Injectable({ providedIn: 'root' })
export class As2PedidosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/as2/pedidos`;

  listar(filtro: As2PedidosFiltro = {}): Observable<As2PedidosPagina> {
    const params = construirParametros({
      page: filtro.page,
      limit: filtro.limit,
      estado: filtro.estado,
      lineas: filtro.lineas,
      q: filtro.q,
    });
    return this.http.get<As2PedidosPagina>(this.base, { params });
  }

  resumen(): Observable<As2Resumen> {
    return this.http.get<As2Resumen>(`${this.base}/resumen`);
  }

  /** Un pedido de AS2 con sus líneas. */
  detalle(idPedidoCliente: number): Observable<As2PedidoResumen> {
    return this.http.get<As2PedidoResumen>(`${this.base}/${idPedidoCliente}`);
  }
}
