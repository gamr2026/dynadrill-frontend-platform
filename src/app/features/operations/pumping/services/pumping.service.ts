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

  assignSupervisor(ticketId: number, supervisorIds: number[]): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(`${this.baseUrl}/tickets/${ticketId}/assign-supervisor`, { supervisorIds });
  }

  assignOperator(ticketId: number, payload: { operatorId: number; unitId: number }): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(`${this.baseUrl}/tickets/${ticketId}/assign-operator`, payload);
  }

  updateStep(ticketId: number, step: PumpingStep, data: unknown): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(`${this.baseUrl}/tickets/${ticketId}/steps/${step}`, data);
  }
}
