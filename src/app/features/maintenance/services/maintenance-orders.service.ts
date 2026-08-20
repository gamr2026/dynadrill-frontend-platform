import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MaintenanceOrderWithSubOrders, MaintenanceType, SubOrder, UnitFinalState } from '../models/maintenance-order.model';

export interface ClassifyOrderInput {
  unitReportId: number;
  unidad: string;
  origin: string;
  types: MaintenanceType[];
}

export interface CloseOrderInput {
  estadoFinal: UnitFinalState;
  observaciones: string;
  responsable: string;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceOrdersService {
  private readonly http = inject(HttpClient);

  list(): Observable<MaintenanceOrderWithSubOrders[]> {
    return this.http.get<MaintenanceOrderWithSubOrders[]>('/api/maintenance-orders');
  }

  get(id: number): Observable<MaintenanceOrderWithSubOrders> {
    return this.http.get<MaintenanceOrderWithSubOrders>(`/api/maintenance-orders/${id}`);
  }

  /** MAN-001-A: crea la orden + una sub-orden por cada tipo seleccionado. */
  classify(input: ClassifyOrderInput): Observable<MaintenanceOrderWithSubOrders> {
    return this.http.post<MaintenanceOrderWithSubOrders>('/api/maintenance-orders', input);
  }

  /**
   * Edita los tipos de una orden ya clasificada — agrega sub-órdenes para
   * tipos nuevos, quita las que ya no aplican. Las sub-órdenes Cerradas se
   * conservan aunque su tipo se destilde (no se pierde trabajo ya
   * aprobado).
   */
  updateClassification(orderId: number, types: MaintenanceType[]): Observable<MaintenanceOrderWithSubOrders> {
    return this.http.post<MaintenanceOrderWithSubOrders>(`/api/maintenance-orders/${orderId}/classification`, { types });
  }

  /** MAN-001-B: guarda diagnóstico/actividades y envía la sub-orden a revisión. */
  updateSubOrder(id: number, input: Pick<SubOrder, 'diagnostico' | 'actividadesCorrectivas'>): Observable<SubOrder> {
    return this.http.put<SubOrder>(`/api/maintenance-suborders/${id}`, input);
  }

  /** MAN-001-C: aprueba (cierra) o rechaza (vuelve a "Corrección Solicitada") la sub-orden. */
  reviewSubOrder(id: number, decision: 'approved' | 'rejected'): Observable<SubOrder> {
    return this.http.post<SubOrder>(`/api/maintenance-suborders/${id}/review`, { decision });
  }

  /** Fin Correctivo: cierra la orden padre y la devuelve a Operaciones. */
  closeOrder(orderId: number, input: CloseOrderInput): Observable<MaintenanceOrderWithSubOrders> {
    return this.http.post<MaintenanceOrderWithSubOrders>(`/api/maintenance-orders/${orderId}/close`, input);
  }
}
