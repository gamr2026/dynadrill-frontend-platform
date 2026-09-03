import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FcrPhase, FcrTicket, type FcrToolDailyStatus, type FcrToolStatus } from '../models/fcr.model';

@Injectable({ providedIn: 'root' })
export class FcrService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/operations/fcr';

  listTickets(): Observable<FcrTicket[]> {
    return this.http.get<FcrTicket[]>(`${this.baseUrl}/tickets`);
  }

  getTicket(id: number): Observable<FcrTicket> {
    return this.http.get<FcrTicket>(`${this.baseUrl}/tickets/${id}`);
  }

  advancePhase(ticketId: number, phase: FcrPhase, approvedBy: string, approvedByRole: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/advance`, { phase, approvedBy, approvedByRole });
  }

  requestCorrection(ticketId: number, observations: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/request-correction`, { observations });
  }

  /** Ingeniería de Ventas devuelve el turno al Supervisor tras aplicar la corrección solicitada. */
  resolveCorrection(ticketId: number, resolvedBy: string, observation: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/resolve-correction`, { resolvedBy, observation });
  }

  /**
   * Muta una sola herramienta por id, no el arreglo completo — si se
   * mandara el arreglo entero, una sesión con la página desactualizada
   * (ej. Bodega sin refrescar mientras el Supervisor agrega una
   * herramienta nueva) pisaría silenciosamente ese cambio ajeno al
   * guardar su propia copia obsoleta.
   */
  addTool(ticketId: number, name: string): Observable<FcrTicket> {
    return this.http.post<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools`, { name });
  }

  removeTool(ticketId: number, toolId: number): Observable<FcrTicket> {
    return this.http.delete<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools/${toolId}`);
  }

  setToolStatus(ticketId: number, toolId: number, status: FcrToolStatus): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/status`, { status });
  }

  /**
   * Envío formal a Bodega de todas las herramientas "Seleccionada" aún no
   * enviadas — marca cada una individualmente (`sentToBodega: true`), sin
   * afectar herramientas nuevas que se agreguen después. Es de un solo
   * sentido: no hay "deshacer envío", solo el botón puntual de "Corregir"
   * sobre una herramienta ya preparada.
   */
  sendToolsToBodega(ticketId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools/send-to-bodega`, {});
  }

  /** Simétrico: Bodega envía formalmente al Supervisor las herramientas "En preparación" ya listas. */
  sendToolsToSupervisor(ticketId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools/send-to-supervisor`, {});
  }

  /** RN-FCR-005 / SP7: declara si quedan o no herramientas por agregar antes de habilitar el documento de inspección. */
  setToolListConfirmed(ticketId: number, confirmed: boolean): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools/confirm-list`, { confirmed });
  }

  markInspectionUploaded(ticketId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/inspection-document`, {});
  }

  assignOperator(ticketId: number, operatorName: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/assign-operator`, { operatorName });
  }

  confirmActa(ticketId: number, meetingDate: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/confirm-acta`, { meetingDate });
  }

  submitReports(ticketId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/submit-reports`, {});
  }

  /** La duración se calcula en el servidor a partir de startTime/endTime — nunca se recibe capturada a mano. */
  addActivityLogEntry(ticketId: number, entry: { date: string; startTime: string; endTime: string; detail: string; author: string }): Observable<FcrTicket> {
    return this.http.post<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/activity-log`, entry);
  }

  removeActivityLogEntry(ticketId: number, entryId: number): Observable<FcrTicket> {
    return this.http.delete<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/activity-log/${entryId}`);
  }

  /** Registrar de nuevo (misma herramienta, misma fecha) reemplaza el estado de ese día en vez de duplicarlo. */
  addToolUsageEntry(ticketId: number, entry: { toolId: number; date: string; status: FcrToolDailyStatus }): Observable<FcrTicket> {
    return this.http.post<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tool-usage`, entry);
  }

  removeToolUsageEntry(ticketId: number, entryId: number): Observable<FcrTicket> {
    return this.http.delete<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tool-usage/${entryId}`);
  }

  reviewReports(ticketId: number, decision: 'approved' | 'rejected', observation?: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/review-reports`, { decision, observation });
  }

  registerMissingTool(ticketId: number, toolId: number, reason: string): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/missing`, { reason });
  }

  generateBodegaExitGuide(ticketId: number, toolId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/tools/${toolId}/bodega-exit-guide`, {});
  }

  closeTicket(ticketId: number): Observable<FcrTicket> {
    return this.http.patch<FcrTicket>(`${this.baseUrl}/tickets/${ticketId}/close`, {});
  }
}
