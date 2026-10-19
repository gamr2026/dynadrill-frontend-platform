import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '@env';
import { ArchivosService } from '../../../facturacion/pedidos-comercial/services/archivos.service';
import {
  MODULO_ARCHIVO_ACTA,
  MODULO_ARCHIVO_DOCUMENTO,
  type ActaDelTicket,
  type CargarDocumento,
  type DocumentoPedido,
  type PedidoDocumental,
  type TipoDocumentoPedido,
} from '../models/documento-pedido';

/** Documentos por pedido y Acta de Entrega del contenedor `qhse`. La autoridad de reglas y permisos es el backend. */
@Injectable({ providedIn: 'root' })
export class DocumentosPedidoService {
  private readonly http = inject(HttpClient);
  private readonly archivos = inject(ArchivosService);
  private readonly base = `${environment.apiUrl}/v2/qhse`;

  /** Bandeja: qué tiene y qué le falta a cada pedido que QHSE conoce. */
  pedidos(q = ''): Observable<PedidoDocumental[]> {
    return this.http.get<PedidoDocumental[]>(`${this.base}/documentos/pedidos`, {
      params: q.trim() ? new HttpParams().set('q', q.trim()) : undefined,
    });
  }

  /** Qué documentos tiene el pedido de un ticket y cuáles faltan (lo ve el equipo de Pumping desde el ticket). */
  deTicket(ticketId: string): Observable<PedidoDocumental> {
    return this.http.get<PedidoDocumental>(`${this.base}/documentos/ticket/${ticketId}`);
  }

  listar(filtro: {
    pedidoId?: string;
    tipo?: TipoDocumentoPedido;
    incluirAnulados?: boolean;
  }): Observable<DocumentoPedido[]> {
    let params = new HttpParams();
    if (filtro.pedidoId) params = params.set('pedidoId', filtro.pedidoId);
    if (filtro.tipo) params = params.set('tipo', filtro.tipo);
    if (filtro.incluirAnulados) params = params.set('incluirAnulados', 'true');
    return this.http.get<DocumentoPedido[]>(`${this.base}/documentos`, { params });
  }

  /** Sube el archivo al servicio de archivos (módulo de QHSE) y enlaza el documento al pedido, en dos pasos. */
  cargar(archivo: File, cuerpo: Omit<CargarDocumento, 'archivoId'>): Observable<DocumentoPedido> {
    return this.archivos.subir(archivo, MODULO_ARCHIVO_DOCUMENTO).pipe(
      switchMap((a) =>
        this.http.post<DocumentoPedido>(`${this.base}/documentos`, {
          ...cuerpo,
          archivoId: a.id,
        }),
      ),
    );
  }

  anular(id: string, motivo: string): Observable<DocumentoPedido> {
    return this.http.post<DocumentoPedido>(`${this.base}/documentos/${id}/anular`, { motivo });
  }

  /** El Acta vigente del ticket y las anuladas (historial). */
  actaDelTicket(ticketId: string): Observable<ActaDelTicket> {
    return this.http.get<ActaDelTicket>(`${this.base}/tickets/${ticketId}/acta-entrega`);
  }

  /** El Supervisor sube el Acta al finalizar el ticket (una vigente por pedido); otra persona debe dar el `motivoSuplencia`. */
  cargarActa(
    ticketId: string,
    archivo: File,
    opciones: { referencia?: string; motivoSuplencia?: string } = {},
  ): Observable<DocumentoPedido> {
    return this.archivos.subir(archivo, MODULO_ARCHIVO_ACTA).pipe(
      switchMap((a) =>
        this.http.post<DocumentoPedido>(`${this.base}/tickets/${ticketId}/acta-entrega`, {
          archivoId: a.id,
          ...(opciones.referencia?.trim() ? { referencia: opciones.referencia.trim() } : {}),
          ...(opciones.motivoSuplencia?.trim()
            ? { motivoSuplencia: opciones.motivoSuplencia.trim() }
            : {}),
        }),
      ),
    );
  }

  /** Abre el archivo en otra pestaña (el contenido exige el token: se baja como blob). */
  abrir(archivoId: string): Observable<Blob> {
    return this.archivos.contenido(archivoId);
  }
}
