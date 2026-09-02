import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PumpingTicket, PumpingStep } from '../models/pumping.model';

@Injectable({ providedIn: 'root' })
export class PumpingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/operations/pumping';

  listTickets(): Observable<PumpingTicket[]> {
    return this.http.get<PumpingTicket[]>(`${this.baseUrl}/tickets`);
  }

  getTicket(id: number): Observable<PumpingTicket> {
    return this.http.get<PumpingTicket>(`${this.baseUrl}/tickets/${id}`);
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

  advanceStep(ticketId: number, step: PumpingStep): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/advance`,
      { step },
    );
  }
}
