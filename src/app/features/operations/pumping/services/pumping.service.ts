import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PumpingTicket, PumpingStep } from '../models/pumping.model';
import { environment } from '@env';

export interface PumpingDocumento {
  id: number;
  campo: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  uploadedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PumpingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/operations/pumping`;

  listTickets(): Observable<PumpingTicket[]> {
    return this.http.get<PumpingTicket[]>(`${this.baseUrl}/tickets`);
  }

  getTicket(id: number): Observable<PumpingTicket> {
    return this.http.get<PumpingTicket>(`${this.baseUrl}/tickets/${id}`);
  }

  /** PUT genérico del ticket — para guardar campos que no tienen su propia acción dedicada (ej. gerenciamientos de viaje ya completados). */
  updateTicket(id: number, patch: Partial<PumpingTicket>): Observable<PumpingTicket> {
    return this.http.put<PumpingTicket>(`${this.baseUrl}/tickets/${id}`, patch);
  }

  assignSupervisor(ticketId: number, supervisorId: number): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/assign-supervisor`,
      { supervisorId },
    );
  }

  assignResources(
    ticketId: number,
    payload: {
      operatorIds: number[];
      unitIds: number[];
      chemicals: { articuloId: number; name: string; unit: string; cantidad: number }[];
      chemicalMixtureDocument?: string;
    },
  ): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/assign-resources`,
      payload,
    );
  }

  /** Cierre de químicos (Ejecución operativa): registra el consumo real; el sobrante se calcula server-side. */
  registerChemicalConsumption(ticketId: number, chemicalId: number, quantityUsed: number): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/chemical-consumption`,
      { chemicalId, quantityUsed },
    );
  }

  saveUnitReport(ticketId: number, report: unknown): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/unit-report`,
      report,
    );
  }

  approveTicket(ticketId: number): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/approve`,
      {},
    );
  }

  rejectTicket(ticketId: number, reason: string): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/reject`,
      { reason },
    );
  }

  advanceStep(ticketId: number, step: PumpingStep): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/advance`,
      { step },
    );
  }

  // ── Documentos "monitoreo" del Reporte diario — un slot por (ticket, campo), campo = 'monitoreo-<fecha ISO>'. ──

  /** Metadata del documento del slot, sin descargar el archivo — el caller decide qué hacer con un 404 (no hay documento subido todavía). */
  metadataDocumento(ticketId: number, campo: string): Observable<PumpingDocumento> {
    return this.http.get<PumpingDocumento>(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}/meta`);
  }

  subirDocumento(ticketId: number, campo: string, archivo: File): Observable<PumpingDocumento> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post<PumpingDocumento>(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}`, form);
  }

  /** Blob autenticado (Bearer vía HttpClient) — un `<a href>` directo al endpoint no lo llevaría. */
  descargarDocumento(ticketId: number, campo: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}`, { responseType: 'blob' });
  }

  eliminarDocumento(ticketId: number, campo: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}`);
  }
}
