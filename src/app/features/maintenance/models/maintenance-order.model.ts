export type MaintenanceType = 'Mecánico' | 'Instrumental' | 'Operativo';

export type SubOrderStatus =
  | 'Pendiente'
  | 'En Diagnóstico'
  | 'En Revisión de Cierre'
  | 'Cerrado'
  | 'Corrección Solicitada'
  | 'Derivado a Pumping';

export type OrderStatus = 'Pendiente' | 'Requiere cambios' | 'Aceptado' | 'Rechazado' | 'Cerrado';

export type UnitFinalState = 'Disponible' | 'Con restricciones';

export interface SubOrder {
  id: number;
  orderId: number;
  code: string;
  type: MaintenanceType;
  /** Solo aplica a tipos Mecánico/Instrumental — Operativo se deriva a Pumping, nunca se asigna. */
  assignedUserId?: number;
  assignedUserName?: string;
  /** Nombre del Jefe de Mantenimiento que hizo la asignación — para que el operador sepa quién se la mandó. */
  assignedByName?: string;
  status: SubOrderStatus;
  diagnostico?: string;
  actividadesCorrectivas?: string;
  /** Motivo que escribió el Jefe al rechazar el cierre — solo tiene sentido mientras está en Corrección Solicitada. */
  correctionNote?: string;
  /** Motivo de la derivación a Pumping — solo aplica a tipo Operativo. */
  deriveNote?: string;
}

export interface MaintenanceOrder {
  id: number;
  code: string;
  unidad: string;
  unitReportId: number;
  origin: string;
  createdAt: string;
  /** Fin Correctivo — se llena solo cuando la orden ya se devolvió a Operaciones. */
  returnedToOperation: boolean;
  finalUnitState?: UnitFinalState;
  finalObservaciones?: string;
  finalResponsable?: string;
}

export interface MaintenanceOrderWithSubOrders extends MaintenanceOrder {
  subOrders: SubOrder[];
}

/**
 * El estado de la orden padre se deriva de sus sub-órdenes, nunca se guarda
 * independiente — regla confirmada: cierra (Aceptado) solo si TODAS sus
 * sub-órdenes están Cerrado. "Cerrado" (el estado final, distinto del
 * "Cerrado" de una sub-orden) solo llega vía Fin Correctivo.
 */
export function computeOrderStatus(order: Pick<MaintenanceOrder, 'returnedToOperation'>, subOrders: SubOrder[]): OrderStatus {
  if (order.returnedToOperation) return 'Cerrado';
  if (subOrders.length === 0) return 'Pendiente';
  if (subOrders.some(s => s.status === 'Corrección Solicitada')) return 'Requiere cambios';
  if (subOrders.every(s => s.status === 'Cerrado' || s.status === 'Derivado a Pumping')) return 'Aceptado';
  return 'Pendiente';
}
