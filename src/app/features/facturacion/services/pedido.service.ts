import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { CreatePedidoInput, EstadoPedido, Pedido, PedidoDocumentoAdjunto } from '../models/pedido.model';
import { CreateListaPreciosInput, ListaPrecios } from '../models/lista-precios.model';
import { AvanceDocumental, DocumentoOperativo, PushDocumentoOperativoInput } from '../models/documento-operativo.model';
import { Prefactura } from '../models/prefactura.model';
import { CreateGuiaRemisionInput, GuiaRemision } from '../models/guia-remision.model';
import { Aot } from '../models/aot.model';
import { CreateSolicitudDespachoInput, EstadoSolicitudDespacho, SolicitudDespachoBodega } from '../models/solicitud-despacho-bodega.model';
import { environment } from '@env';

/**
 * Fase 0 — Servicios de la reescritura del módulo de Facturación.
 *
 * `PedidoService` habla con el gateway AS2 simulado (bidireccional). El día
 * que exista la API real de AS2 solo cambia el origen del dato, no las
 * pantallas.
 */
@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/facturacion/pedidos`;

  list(): Observable<Pedido[]> {
    return this.http.get<Pedido[]>(this.base);
  }

  get(id: number): Observable<Pedido> {
    return this.http.get<Pedido>(`${this.base}/${id}`);
  }

  /** Alta desde el Portal — se refleja también en AS2 (mock). */
  create(input: CreatePedidoInput): Observable<Pedido> {
    return this.http.post<Pedido>(this.base, input);
  }

  /** Edición de un pedido ya creado — Ventas y Facturación (ver ModuleRoles.pedidos en el backend). */
  update(id: number, input: Partial<CreatePedidoInput>): Observable<Pedido> {
    return this.http.put<Pedido>(`${this.base}/${id}`, input);
  }

  cambiarEstado(id: number, estado: EstadoPedido, usuario: string, motivo?: string): Observable<Pedido> {
    return this.http.patch<Pedido>(`${this.base}/${id}/estado`, { estado, usuario, motivo });
  }

  /** Facturación rechaza el pedido de vuelta a Ventas para que lo corrija — solo antes de generar la prefactura. */
  rechazar(id: number, usuario: string, motivo: string): Observable<Pedido> {
    return this.http.post<Pedido>(`${this.base}/${id}/rechazar`, { usuario, motivo });
  }

  /** Cierre definitivo del pedido (ej. el cliente canceló el servicio) — a diferencia de `rechazar`, aplica en cualquier estado salvo uno ya cerrado (ver `ESTADOS_NO_ANULABLES`). */
  anular(id: number, usuario: string, motivo: string): Observable<Pedido> {
    return this.http.post<Pedido>(`${this.base}/${id}/anular`, { usuario, motivo });
  }

  // ── Solicitud de Despacho a Bodega (correlación con "Orden Salida Material" de AS2) ──

  /** Vigente, o la última ya resuelta — `null` si el pedido nunca tuvo una. */
  solicitudDespacho(id: number): Observable<SolicitudDespachoBodega | null> {
    return this.http.get<SolicitudDespachoBodega | null>(`${this.base}/${id}/solicitud-despacho`);
  }

  /** Solo con la prefactura ya generada — el pedido queda `por_despachar_bodega` hasta que Bodega la resuelva. */
  solicitarDespacho(id: number, usuario: string, input: CreateSolicitudDespachoInput): Observable<Pedido> {
    return this.http.post<Pedido>(`${this.base}/${id}/solicitud-despacho`, { usuario, ...input });
  }

  // ── Documentos adjuntos reales (ej. ficha de mezcla de químicos) ──

  listarDocumentosAdjuntos(pedidoId: number): Observable<PedidoDocumentoAdjunto[]> {
    return this.http.get<PedidoDocumentoAdjunto[]>(`${this.base}/${pedidoId}/documentos-adjuntos`);
  }

  subirDocumentoAdjunto(pedidoId: number, descripcion: string, archivo: File): Observable<PedidoDocumentoAdjunto> {
    const form = new FormData();
    form.append('file', archivo);
    form.append('descripcion', descripcion);
    return this.http.post<PedidoDocumentoAdjunto>(`${this.base}/${pedidoId}/documentos-adjuntos`, form);
  }

  /** Blob autenticado (Bearer vía HttpClient) — un `<a href>` directo al endpoint no lo llevaría. */
  descargarDocumentoAdjunto(pedidoId: number, docId: number): Observable<Blob> {
    return this.http.get(`${this.base}/${pedidoId}/documentos-adjuntos/${docId}`, { responseType: 'blob' });
  }

  eliminarDocumentoAdjunto(pedidoId: number, docId: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${pedidoId}/documentos-adjuntos/${docId}`);
  }

  // ── Documentos firmados (RN: monitoreo/mezcla deben ir firmados al cliente antes de "Enviar al cliente") ──

  /** Solo Facturación (ver `ModuleRoles.facturacion` en el backend). */
  subirDocumentoFirmado(pedidoId: number, tipo: string, referencia: string, archivo: File): Observable<unknown> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post(`${this.base}/${pedidoId}/documentos-firmados/${tipo}/${encodeURIComponent(referencia)}`, form);
  }

  /** Blob autenticado — mismo criterio que `descargarDocumentoAdjunto`. */
  descargarDocumentoFirmado(pedidoId: number, tipo: string, referencia: string): Observable<Blob> {
    return this.http.get(`${this.base}/${pedidoId}/documentos-firmados/${tipo}/${encodeURIComponent(referencia)}`, { responseType: 'blob' });
  }

  /** Trae los cambios que AS2 haya empujado desde el otro lado (mock). */
  sincronizarConAs2(): Observable<{ pedidos: Pedido[]; nuevos: number }> {
    return this.http.post<{ pedidos: Pedido[]; nuevos: number }>(`${this.base}/sync-as2`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class ListaPreciosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/facturacion/listas-precios`;

  list(): Observable<ListaPrecios[]> {
    return this.http.get<ListaPrecios[]>(this.base);
  }

  get(id: number): Observable<ListaPrecios> {
    return this.http.get<ListaPrecios>(`${this.base}/${id}`);
  }

  create(input: CreateListaPreciosInput): Observable<ListaPrecios> {
    return this.http.post<ListaPrecios>(this.base, input);
  }
}

/**
 * Documentos operativos (Reporte Job / Reporte de Herramientas) recibidos
 * desde FCR y Pumping, vinculados al Pedido.
 */
@Injectable({ providedIn: 'root' })
export class DocumentoOperativoService {
  private readonly http = inject(HttpClient);

  listTodos(): Observable<DocumentoOperativo[]> {
    return this.http.get<DocumentoOperativo[]>(`${environment.apiUrl}/facturacion/documentos-operativos`);
  }

  listDePedido(pedidoId: number): Observable<DocumentoOperativo[]> {
    return this.http.get<DocumentoOperativo[]>(`${environment.apiUrl}/facturacion/pedidos/${pedidoId}/documentos`);
  }

  avance(pedidoId: number): Observable<AvanceDocumental> {
    return this.http.get<AvanceDocumental>(`${environment.apiUrl}/facturacion/pedidos/${pedidoId}/avance`);
  }

  /** Lo llaman FCR / Pumping cuando el operador firma un documento (mock). */
  push(input: PushDocumentoOperativoInput): Observable<DocumentoOperativo> {
    return this.http.post<DocumentoOperativo>(`${environment.apiUrl}/facturacion/documentos-operativos`, input);
  }
}

/** Prefactura (= Ticket de Facturación) — se arma desde el Reporte de Htas × Lista de Precios. */
@Injectable({ providedIn: 'root' })
export class PrefacturaService {
  private readonly http = inject(HttpClient);

  list(): Observable<Prefactura[]> {
    return this.http.get<Prefactura[]>(`${environment.apiUrl}/facturacion/prefacturas`);
  }

  get(id: number): Observable<Prefactura> {
    return this.http.get<Prefactura>(`${environment.apiUrl}/facturacion/prefacturas/${id}`);
  }

  dePedido(pedidoId: number): Observable<Prefactura | null> {
    return this.http.get<Prefactura>(`${environment.apiUrl}/facturacion/pedidos/${pedidoId}/prefactura`).pipe(
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err))),
    );
  }

  generar(pedidoId: number, usuario: string): Observable<Prefactura> {
    return this.http.post<Prefactura>(`${environment.apiUrl}/facturacion/pedidos/${pedidoId}/prefactura`, { usuario });
  }

  /** FACT-004 — envío del paquete al cliente. */
  enviarAlCliente(id: number, medio: string, adjuntos: string[], usuario: string): Observable<Prefactura> {
    return this.http.patch<Prefactura>(`${environment.apiUrl}/facturacion/prefacturas/${id}/enviar`, { medio, adjuntos, usuario });
  }

  registrarFirma(id: number, nombre: string, cargo: string, usuario: string): Observable<Prefactura> {
    return this.http.patch<Prefactura>(`${environment.apiUrl}/facturacion/prefacturas/${id}/firmar`, { nombre, cargo, usuario });
  }

  registrarRechazo(
    id: number,
    payload: { motivo: string; razonRetraso?: string; devueltoA: string; itemsObservados?: string[] },
    usuario: string,
  ): Observable<Prefactura> {
    return this.http.patch<Prefactura>(`${environment.apiUrl}/facturacion/prefacturas/${id}/rechazar`, { ...payload, usuario });
  }
}

/** Guía de Remisión — solo cuando la prefactura tiene ítems tipo Material. */
@Injectable({ providedIn: 'root' })
export class GuiaRemisionService {
  private readonly http = inject(HttpClient);

  /** Todas las guías (todos los pedidos) — para la vista consolidada de Reportería, sin un GET por pedido. */
  list(): Observable<GuiaRemision[]> {
    return this.http.get<GuiaRemision[]>(`${environment.apiUrl}/facturacion/guias-remision`);
  }

  dePedido(pedidoId: number): Observable<GuiaRemision | null> {
    return this.http.get<GuiaRemision>(`${environment.apiUrl}/facturacion/pedidos/${pedidoId}/guia-remision`).pipe(
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err))),
    );
  }

  /** Requisito previo a generar la prefactura (FACT-002/004) — se registra contra el Pedido, no la prefactura. */
  generar(pedidoId: number, input: CreateGuiaRemisionInput): Observable<GuiaRemision> {
    return this.http.post<GuiaRemision>(`${environment.apiUrl}/facturacion/pedidos/${pedidoId}/guia-remision`, input);
  }
}

/** AOT — "ORDEN DE TRABAJO / RESUMEN DE COSTOS", documento oficial final (FACT-004). */
@Injectable({ providedIn: 'root' })
export class AotService {
  private readonly http = inject(HttpClient);

  list(): Observable<Aot[]> {
    return this.http.get<Aot[]>(`${environment.apiUrl}/facturacion/aots`);
  }

  get(id: number): Observable<Aot> {
    return this.http.get<Aot>(`${environment.apiUrl}/facturacion/aots/${id}`);
  }

  dePedido(pedidoId: number): Observable<Aot | null> {
    return this.http.get<Aot | null>(`${environment.apiUrl}/facturacion/pedidos/${pedidoId}/aot`);
  }

  generar(
    prefacturaId: number,
    datos: { ciudad: string; descripcionRequerimiento: string; representanteCliente: { nombre: string; cargo: string } },
    usuario: string,
  ): Observable<Aot> {
    return this.http.post<Aot>(`${environment.apiUrl}/facturacion/prefacturas/${prefacturaId}/aot`, { ...datos, usuario });
  }

  marcarFirmada(id: number, usuario: string): Observable<Aot> {
    return this.http.patch<Aot>(`${environment.apiUrl}/facturacion/aots/${id}/firmar`, { usuario });
  }
}

/** Bandeja de Bodega — resuelve las Solicitudes de Despacho que Facturación emite (ver `PedidoService.solicitarDespacho`). */
@Injectable({ providedIn: 'root' })
export class SolicitudesDespachoBodegaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/facturacion/solicitudes-despacho`;

  /** Sin `estado`, trae todas (Bodega puede querer ver el historial, no solo lo pendiente). */
  listar(estado?: EstadoSolicitudDespacho): Observable<SolicitudDespachoBodega[]> {
    const params = estado ? { params: { estado } } : {};
    return this.http.get<SolicitudDespachoBodega[]>(this.base, params);
  }

  /** Adjunta el documento de respaldo y marca la solicitud como despachada — el pedido vuelve a `prefactura_generada`. */
  despachar(id: number, usuario: string, archivo: File, extra: { notaBodega?: string; referenciaAs2?: string }): Observable<SolicitudDespachoBodega> {
    const form = new FormData();
    form.append('file', archivo);
    form.append('usuario', usuario);
    if (extra.notaBodega) form.append('notaBodega', extra.notaBodega);
    if (extra.referenciaAs2) form.append('referenciaAs2', extra.referenciaAs2);
    return this.http.post<SolicitudDespachoBodega>(`${this.base}/${id}/despachar`, form);
  }

  /** Rechaza la solicitud (ej. sin stock) — el pedido vuelve a `prefactura_generada` para que Facturación la corrija. */
  rechazar(id: number, usuario: string, motivo: string): Observable<SolicitudDespachoBodega> {
    return this.http.post<SolicitudDespachoBodega>(`${this.base}/${id}/rechazar`, { usuario, motivo });
  }
}
