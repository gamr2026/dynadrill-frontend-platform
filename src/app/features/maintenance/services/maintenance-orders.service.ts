import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MaintenanceOrderWithSubOrders, MaintenanceType, SubOrder, UnitFinalState } from '../models/maintenance-order.model';
import { MaintenanceSourceModule } from '../models/unit-report.model';
import { environment } from '@env';

export interface ClassifyTypeAssignment {
  type: MaintenanceType;
  /** Solo Mecánico/Instrumental. */
  userId?: number;
  userName?: string;
  /** Solo Operativo — true (default) = Atendido, se deriva de inmediato; false = queda Pendiente para derivar después desde el panel. */
  operativoAttended?: boolean;
}

export interface ClassifyOrderInput {
  unitReportId: number;
  unidad: string;
  origin: string;
  sourceModule: MaintenanceSourceModule;
  assignments: ClassifyTypeAssignment[];
  assignedByName: string;
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
    return this.http.get<MaintenanceOrderWithSubOrders[]>(`${environment.apiUrl}/maintenance-orders`);
  }

  get(id: number): Observable<MaintenanceOrderWithSubOrders> {
    return this.http.get<MaintenanceOrderWithSubOrders>(`/api/maintenance-orders/${id}`);
  }

  /** MAN-001-A: crea la orden + una sub-orden por cada tipo seleccionado. */
  classify(input: ClassifyOrderInput): Observable<MaintenanceOrderWithSubOrders> {
    return this.http.post<MaintenanceOrderWithSubOrders>(`${environment.apiUrl}/maintenance-orders`, input);
  }

  /**
   * Edita los tipos de una orden ya clasificada — agrega sub-órdenes para
   * tipos nuevos, quita las que ya no aplican, y puede reasignar el
   * operador/estado Operativo de una sub-orden ya existente. Las
   * sub-órdenes Cerradas se conservan intactas aunque su tipo se destilde
   * (no se pierde trabajo ya aprobado).
   */
  updateClassification(
    orderId: number,
    assignments: ClassifyTypeAssignment[],
    assignedByName: string,
  ): Observable<MaintenanceOrderWithSubOrders> {
    return this.http.post<MaintenanceOrderWithSubOrders>(`/api/maintenance-orders/${orderId}/classification`, {
      assignments,
      assignedByName,
    });
  }

  /** MAN-001-B paso 1: guarda diagnóstico, actividades, horas, repuestos y trabajos adicionales. Sub-orden pasa a "En Ejecución". */
  updateSubOrder(id: number, input: Pick<SubOrder, 'diagnostico' | 'actividadesCorrectivas' | 'horasTrabajo' | 'repuestos' | 'trabajosAdicionales'>): Observable<SubOrder> {
    return this.http.put<SubOrder>(`/api/maintenance-suborders/${id}`, input);
  }

  /** MAN-001-B paso 2: operador declara la ejecución terminada — sub-orden pasa a "En Revisión de Cierre". */
  submitSubOrderForReview(id: number): Observable<SubOrder> {
    return this.http.post<SubOrder>(`/api/maintenance-suborders/${id}/submit`, {});
  }

  /** MAN-001-C: aprueba (cierra) o rechaza (vuelve a "Corrección Solicitada", con motivo) la sub-orden. */
  reviewSubOrder(id: number, decision: 'approved' | 'rejected', correctionNote?: string): Observable<SubOrder> {
    return this.http.post<SubOrder>(`/api/maintenance-suborders/${id}/review`, { decision, correctionNote });
  }

  /** Fin Correctivo: cierra la orden padre y la devuelve a Operaciones. */
  closeOrder(orderId: number, input: CloseOrderInput): Observable<MaintenanceOrderWithSubOrders> {
    return this.http.post<MaintenanceOrderWithSubOrders>(`/api/maintenance-orders/${orderId}/close`, input);
  }

  /** El Jefe deriva una sub-orden Operativo a Pumping — sale del flujo de Mantenimiento. */
  deriveToOperations(subOrderId: number, note: string): Observable<SubOrder> {
    return this.http.post<SubOrder>(`/api/maintenance-suborders/${subOrderId}/derive`, { note });
  }

  /** Reasigna el operador de una sub-orden sin cambiar su tipo ni estado. */
  reassignOperator(subOrderId: number, userId: number, userName: string, assignedByName: string): Observable<SubOrder> {
    return this.http.patch<SubOrder>(`/api/maintenance-suborders/${subOrderId}/operator`, { userId, userName, assignedByName });
  }
}
