import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
import { CreatePedidoInput, EstadoPedido, Pedido, PedidoDocumentoAdjunto } from '../models/pedido.model';
import { CreateListaPreciosInput, ListaPrecios, ListaPreciosItemDraft } from '../models/lista-precios.model';
import { AvanceDocumental, DocumentoOperativo, PushDocumentoOperativoInput } from '../models/documento-operativo.model';
import { Prefactura } from '../models/prefactura.model';
import { CreateGuiaRemisionInput, GuiaRemision } from '../models/guia-remision.model';
import { Aot } from '../models/aot.model';
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

  actualizarCabecera(
    id: number,
    patch: Partial<Pick<ListaPrecios, 'cliente' | 'numeroContrato' | 'vigenteDesde' | 'activa'>>,
  ): Observable<ListaPrecios> {
    return this.http.patch<ListaPrecios>(`${this.base}/${id}`, patch);
  }

  /** Reemplaza la lista completa de ítems (mismo patrón que `actualizarItems` de la OTQ anterior). */
  reemplazarItems(id: number, items: ListaPreciosItemDraft[]): Observable<ListaPrecios> {
    return this.http.put<ListaPrecios>(`${this.base}/${id}/items`, items);
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
