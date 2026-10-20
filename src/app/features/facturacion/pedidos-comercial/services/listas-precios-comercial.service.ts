import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  FiltroItemsLista,
  ItemLista,
  ItemListaCliente,
  ListaPreciosResumen,
  Pagina,
} from '../models/pedido-comercial.model';
import { construirParametros } from './pedidos-comercial.service';

/** Listas de precios del contenedor `comercial`: de aquí salen siempre los ítems de un pedido. */
@Injectable({ providedIn: 'root' })
export class ListasPreciosComercialService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/comercial/listas-precios`;

  listar(
    filtro: { clienteId?: string | null; activa?: boolean } = {},
  ): Observable<ListaPreciosResumen[]> {
    const params = construirParametros({
      clienteId: filtro.clienteId,
      activa: filtro.activa === undefined ? null : String(filtro.activa),
    });
    return this.http.get<ListaPreciosResumen[]>(this.base, { params });
  }

  detalle(listaId: string): Observable<ListaPreciosResumen> {
    return this.http.get<ListaPreciosResumen>(`${this.base}/${listaId}`);
  }

  /** Ítems elegibles para un pedido del cliente (listas activas; un código solo una vez). */
  itemsDeCliente(
    clienteId: string,
    filtro: FiltroItemsLista = {},
  ): Observable<Pagina<ItemListaCliente>> {
    const params = construirParametros({
      clienteId,
      q: filtro.q,
      tipo: filtro.tipo,
      page: filtro.page,
      limit: filtro.limit,
    });
    return this.http.get<Pagina<ItemListaCliente>>(`${this.base}/items`, { params });
  }

  items(listaId: string, filtro: FiltroItemsLista = {}): Observable<Pagina<ItemLista>> {
    const params = construirParametros({
      q: filtro.q,
      tipo: filtro.tipo,
      page: filtro.page,
      limit: filtro.limit,
    });
    return this.http.get<Pagina<ItemLista>>(`${this.base}/${listaId}/items`, { params });
  }
}
