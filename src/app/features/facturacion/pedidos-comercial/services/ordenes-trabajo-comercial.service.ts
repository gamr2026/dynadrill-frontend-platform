import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { CiudadOt, EmitirOrdenRequest, EstadoCierre, ExportacionAs2, OrdenDelPedido, OrdenTrabajo } from '../models/orden-trabajo';

/** Orden de trabajo, cierre del pedido y exportación a AS2 del contenedor `comercial`. */
@Injectable({ providedIn: 'root' })
export class OrdenesTrabajoComercialService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/comercial`;

  delPedido(pedidoId: string): Observable<OrdenDelPedido> {
    return this.http.get<OrdenDelPedido>(`${this.base}/pedidos/${pedidoId}/orden-trabajo`);
  }

  ciudades(): Observable<CiudadOt[]> {
    return this.http.get<CiudadOt[]>(`${this.base}/ordenes-trabajo/ciudades`);
  }

  emitir(pedidoId: string, cuerpo: EmitirOrdenRequest): Observable<OrdenTrabajo> {
    return this.http.post<OrdenTrabajo>(`${this.base}/pedidos/${pedidoId}/orden-trabajo`, cuerpo);
  }

  /** La firma es física; el archivo escaneado es opcional y se sube antes a `/api/archivos` (`orden_trabajo_documento`). */
  marcarFirmada(id: string, archivoId?: string): Observable<OrdenTrabajo> {
    return this.http.post<OrdenTrabajo>(`${this.base}/ordenes-trabajo/${id}/firmada`, archivoId ? { archivoId } : {});
  }

  cierre(pedidoId: string): Observable<EstadoCierre> {
    return this.http.get<EstadoCierre>(`${this.base}/pedidos/${pedidoId}/cierre`);
  }

  enviarControlCostos(pedidoId: string): Observable<EstadoCierre> {
    return this.http.post<EstadoCierre>(`${this.base}/pedidos/${pedidoId}/cierre/control-costos`, {});
  }

  listoParaFacturar(pedidoId: string): Observable<EstadoCierre> {
    return this.http.post<EstadoCierre>(`${this.base}/pedidos/${pedidoId}/cierre/listo-para-facturar`, {});
  }

  facturado(pedidoId: string, numeroFactura: string): Observable<EstadoCierre> {
    return this.http.post<EstadoCierre>(`${this.base}/pedidos/${pedidoId}/cierre/facturado`, { numeroFactura: numeroFactura.trim() });
  }

  exportacionAs2(prefacturaId: string): Observable<ExportacionAs2> {
    return this.http.get<ExportacionAs2>(`${this.base}/prefacturas/${prefacturaId}/exportacion-as2`);
  }
}
