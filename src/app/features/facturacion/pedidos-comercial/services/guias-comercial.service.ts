import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { EmitirGuiaRequest, Guia, ItemGuia, LugarDespacho, SolicitarDespachoRequest } from '../models/guia-comercial';

/** Guías de remisión y despacho a Bodega del contenedor `comercial`. */
@Injectable({ providedIn: 'root' })
export class GuiasComercialService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/comercial`;

  delPedido(pedidoId: string): Observable<Guia[]> {
    return this.http.get<Guia[]>(`${this.base}/pedidos/${pedidoId}/guias`);
  }

  /** Herramientas reportadas y materiales del pedido: la propuesta que se edita antes de emitir. */
  itemsSugeridos(pedidoId: string): Observable<ItemGuia[]> {
    return this.http.get<ItemGuia[]>(`${this.base}/pedidos/${pedidoId}/guias/items-sugeridos`);
  }

  emitir(pedidoId: string, cuerpo: EmitirGuiaRequest): Observable<Guia> {
    return this.http.post<Guia>(`${this.base}/pedidos/${pedidoId}/guias`, cuerpo);
  }

  lugares(): Observable<LugarDespacho[]> {
    return this.http.get<LugarDespacho[]>(`${this.base}/guias/lugares-despacho`);
  }

  crearLugar(nombre: string): Observable<LugarDespacho> {
    return this.http.post<LugarDespacho>(`${this.base}/guias/lugares-despacho`, { nombre });
  }

  reasignarNumero(id: string, numero: number, motivo: string): Observable<Guia> {
    return this.http.post<Guia>(`${this.base}/guias/${id}/reasignar-numero`, { numero, motivo: motivo.trim() });
  }

  anular(id: string, motivo: string): Observable<Guia> {
    return this.http.post<Guia>(`${this.base}/guias/${id}/anular`, { motivo: motivo.trim() });
  }

  /** El PDF firmado se sube antes a `/api/archivos` con `modulo = guia_documento`. */
  registrarFirmada(id: string, archivoId: string): Observable<Guia> {
    return this.http.post<Guia>(`${this.base}/guias/${id}/firmada`, { archivoId });
  }

  /** Vuelve a validar las firmas digitales del PDF firmado (ayuda para revisar). */
  verificarFirmaElectronica(id: string): Observable<Guia> {
    return this.http.post<Guia>(`${this.base}/guias/${id}/verificar-firma-electronica`, {});
  }

  /**
   * Pide el despacho a Bodega. El pedido pasa a «por despachar»; Bodega lo resuelve en Inventario
   * (`GET /api/operaciones/inventario/despachos?pedidoId=` para ver cómo va) y el pedido vuelve a la prefactura.
   */
  solicitarDespacho(pedidoId: string, body: SolicitarDespachoRequest): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/pedidos/${pedidoId}/despacho/solicitar`, body);
  }
}
