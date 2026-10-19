import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { DocumentosQhseTicket } from '../../pumping/services/pumping.service';
import { Observable } from 'rxjs';
import {
  FcrPhase,
  FcrTicket,
  type FcrToolDailyStatus,
  type FcrToolStatus,
} from '../models/fcr.model';
import { environment } from '@env';
import type {
  TipoCompletacion,
  TipoOperador,
  TipoPicker,
  TipoTrabajo,
} from '../models/fcr-catalogos.model';

/**
 * Los 6 campos de FCR con subida real de archivo (fcr-adjuntos-reales) —
 * nombres cortos, sin el sufijo "Uploaded" (mismo criterio que
 * `CAMPOS_DOCUMENTO_FCR` en el backend). `fcr.model.ts` no cambia: los 6
 * booleanos `...Uploaded` siguen viniendo del backend igual que siempre.
 */
export type CampoDocumentoFcr =
  | 'formularioInspeccionExterno'
  | 'formatoDimensionamientoServicio'
  | 'formatoDurezaServicio'
  | 'inspectionDocument'
  | 'registroDureza'
  | 'registroQaqc';

@Injectable({ providedIn: 'root' })
export class FcrService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/operations/fcr`;

  listTickets(): Observable<FcrTicket[]> {
    return this.http.get<FcrTicket[]>(`${this.baseUrl}/tickets`);
  }

  getTicket(id: number): Observable<FcrTicket> {
    return this.http.get<FcrTicket>(`${this.baseUrl}/tickets/${id}`);
  }

  advancePhase(
    ticketId: number,
    phase: FcrPhase,
    approvedBy: string,
    approvedByRole: string,
  ): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/advance`, {
      phase,
      approvedBy,
      approvedByRole,
    });
  }

  requestCorrection(ticketId: number, observations: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/request-correction`, {
      observations,
    });
  }

  /** Ingeniería de Ventas FCR devuelve el turno al Supervisor tras aplicar la corrección solicitada. */
  resolveCorrection(
    ticketId: number,
    resolvedBy: string,
    observation: string,
  ): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/resolve-correction`, {
      resolvedBy,
      observation,
    });
  }

  /**
   * Muta una sola herramienta por id, no el arreglo completo — si se
   * mandara el arreglo entero, una sesión con la página desactualizada
   * (ej. Bodega sin refrescar mientras el Supervisor agrega una
   * herramienta nueva) pisaría silenciosamente ese cambio ajeno al
   * guardar su propia copia obsoleta.
   */
  addTool(ticketId: number, articuloId: number): Observable<FcrTicket> {
    return this.http.post<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools`, { articuloId });
  }

  removeTool(ticketId: number, toolId: number): Observable<FcrTicket> {
    return this.http.delete<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools/${toolId}`);
  }

  /** Vuelve a precargar las herramientas de los kits del Pedido — conserva las manuales y las ya enviadas a Bodega (specs/fcr-precarga-herramientas). */
  recargarDesdePedido(ticketId: number): Observable<FcrTicket> {
    return this.http.post<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/recargar-desde-pedido`,
      {},
    );
  }

  /** Supervisor solicita a Bodega, herramienta por herramienta — botón embebido en la fila. */
  sendToolToBodega(ticketId: number, toolId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/send-to-bodega`,
      {},
    );
  }

  /** Bodega marca una herramienta preparada (o con novedad). */
  setBodegaCheck(ticketId: number, toolId: number, novedad?: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/bodega-check`,
      { novedad },
    );
  }

  /** Corrige (deshace) el check de Bodega de una sola herramienta — no afecta a las demás ni a envíos ya hechos de otros pasos. */
  clearBodegaCheck(ticketId: number, toolId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/bodega-check/clear`,
      {},
    );
  }

  /** Simétrico: Bodega envía formalmente al Supervisor una herramienta ya preparada. */
  sendToolToSupervisor(ticketId: number, toolId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/send-to-supervisor`,
      {},
    );
  }

  /** Supervisor recibe (o marca novedad en) una herramienta ya preparada por Bodega. */
  setRecepcionCheck(ticketId: number, toolId: number, novedad?: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/recepcion-check`,
      { novedad },
    );
  }

  /** Corrige (deshace) el check de Recepción de una sola herramienta. */
  clearRecepcionCheck(ticketId: number, toolId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/recepcion-check/clear`,
      {},
    );
  }

  /** Genérico — usado solo en Control de Retorno (`markToolReturned` → 'devuelta'), fuera de Preparación de Herramientas. */
  setToolStatus(ticketId: number, toolId: number, status: FcrToolStatus): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/status`,
      { status },
    );
  }

  /** Observación libre, agregable en cualquier fase — ver `ObservacionesTimelineDialog`. */
  addObservation(ticketId: number, message: string, role: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/observations`, {
      message,
      role,
    });
  }

  /** RN-FCR-005 / SP7: declara si quedan o no herramientas por agregar antes de habilitar el documento de inspección. */
  setToolListConfirmed(ticketId: number, confirmed: boolean): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools/confirm-list`, {
      confirmed,
    });
  }

  /**
   * Solo dispara el efecto colateral que sigue fuera del alcance de
   * fcr-adjuntos-reales: generar `movementGuideGenerated` /
   * `reviewGuideGenerated`. El archivo real del documento de inspección se
   * sube aparte con `subirDocumento(ticketId, 'inspectionDocument', file)`.
   */
  markInspectionUploaded(ticketId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/inspection-document`,
      {},
    );
  }

  assignOperator(ticketId: number, operatorName: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/assign-operator`, {
      operatorName,
    });
  }

  // ── Entrada SERVICIOS ──

  setTipoOperador(ticketId: number, tipoOperador: TipoOperador): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tipo-operador`, {
      tipoOperador,
    });
  }

  assignMechanicOperator(ticketId: number, operatorName: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/assign-mechanic-operator`,
      { operatorName },
    );
  }

  reviewInspeccion(
    ticketId: number,
    decision: 'approved' | 'rejected',
    observation?: string,
  ): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/review-inspeccion`, {
      decision,
      observation,
    });
  }

  confirmActa(ticketId: number, meetingDate: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/confirm-acta`, {
      meetingDate,
    });
  }

  submitReports(ticketId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/submit-reports`, {});
  }

  /** La duración se calcula en el servidor a partir de startTime/endTime — nunca se recibe capturada a mano. */
  addActivityLogEntry(
    ticketId: number,
    entry: { date: string; startTime: string; endTime: string; detail: string; author: string },
  ): Observable<FcrTicket> {
    return this.http.post<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/activity-log`, entry);
  }

  removeActivityLogEntry(ticketId: number, entryId: number): Observable<FcrTicket> {
    return this.http.delete<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/activity-log/${entryId}`,
    );
  }

  /** Envío diario: genera en el Pedido el Reporte Job de esa fecha (`fecha` = 'YYYY-MM-DD'). */
  enviarDiaBitacora(ticketId: number, fecha: string): Observable<FcrTicket> {
    return this.http.post<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/activity-log/dias/${fecha}/enviar`,
      {},
    );
  }

  /**
   * Corrección de un día: reemplaza todas sus actividades en la bitácora del ticket (fuente única).
   * La usan el Operador y Facturación; si el día ya fue enviado, el backend regenera su Reporte Job.
   */
  reemplazarDiaBitacora(
    ticketId: number,
    fecha: string,
    actividades: { startTime: string; endTime: string; detail: string }[],
  ): Observable<FcrTicket> {
    return this.http.put<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/activity-log/dias/${fecha}`,
      { actividades },
    );
  }

  /**
   * Registrar de nuevo (misma herramienta, misma fecha) reemplaza la fila de ese día en vez de duplicarla.
   * Los campos de completación/trabajo + picker + presión/peso/observación son "por herramienta" — van en
   * esta misma entrada, no en un campo general del ticket.
   */
  addToolUsageEntry(
    ticketId: number,
    entry: {
      toolId: number;
      date: string;
      status: FcrToolDailyStatus;
      tipoCompletacion?: TipoCompletacion;
      tipoTrabajo?: TipoTrabajo;
      tipoPicker?: TipoPicker;
      presion?: string;
      peso?: string;
      observacion?: string;
    },
  ): Observable<FcrTicket> {
    return this.http.post<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tool-usage`, entry);
  }

  removeToolUsageEntry(ticketId: number, entryId: number): Observable<FcrTicket> {
    return this.http.delete<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tool-usage/${entryId}`);
  }

  reviewReports(
    ticketId: number,
    decision: 'approved' | 'rejected',
    observation?: string,
  ): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/review-reports`, {
      decision,
      observation,
    });
  }

  confirmPickerUsageList(ticketId: number, confirmed: boolean): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/confirm-picker-usage-list`,
      { confirmed },
    );
  }

  registerMissingTool(ticketId: number, toolId: number, reason: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/missing`,
      { reason },
    );
  }

  generateBodegaExitGuide(ticketId: number, toolId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/bodega-exit-guide`,
      {},
    );
  }

  closeTicket(ticketId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/close`, {});
  }

  // ── Adjuntos reales (fcr-adjuntos-reales) ──

  /** Sube (o reemplaza) el archivo real de uno de los 6 campos de documento de FCR. Máx. 2MB — validado también en el backend. */
  subirDocumento(ticketId: number, campo: CampoDocumentoFcr, file: File): Observable<FcrTicket> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<FcrTicket>(
      `${this.baseUrl}/tickets/${ticketId}/documentos/${campo}`,
      formData,
    );
  }

  eliminarDocumento(ticketId: number, campo: CampoDocumentoFcr): Observable<FcrTicket> {
    return this.http.delete<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}`);
  }

  /**
   * Descarga el archivo real de uno de los 6 campos de documento de FCR.
   * `responseType: 'blob'` para que pase por `HttpClient` (y por lo tanto
   * por el `authInterceptor` que adjunta el Bearer) — un `<a href>` directo
   * al endpoint no llevaría el token y el backend respondería 401.
   */
  descargarDocumento(ticketId: number, campo: CampoDocumentoFcr): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}`, {
      responseType: 'blob',
    });
  }

  // ── Documentos QHSE del pedido del ticket (ART / PT los sube el Supervisor) ──

  documentosQhse(ticketId: number): Observable<DocumentosQhseTicket> {
    return this.http.get<DocumentosQhseTicket>(
      `${this.baseUrl}/tickets/${ticketId}/documentos-qhse`,
    );
  }

  subirArtQhse(ticketId: number, fechaEmision: string, archivo: File): Observable<unknown> {
    const form = new FormData();
    form.append('fechaEmision', fechaEmision);
    form.append('file', archivo);
    return this.http.post(`${this.baseUrl}/tickets/${ticketId}/documentos-qhse/art`, form);
  }

  subirPtQhse(ticketId: number, ptwCode: string, archivo: File): Observable<unknown> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post(
      `${this.baseUrl}/tickets/${ticketId}/documentos-qhse/pt/${encodeURIComponent(ptwCode)}`,
      form,
    );
  }

  subirEntregaQhse(ticketId: number, archivo: File): Observable<unknown> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post(`${this.baseUrl}/tickets/${ticketId}/documentos-qhse/entrega`, form);
  }

  descargarDocumentoQhse(ticketId: number, tipo: string, referencia: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/tickets/${ticketId}/documentos-qhse/${tipo}/${encodeURIComponent(referencia)}`,
      {
        responseType: 'blob',
      },
    );
  }
}
