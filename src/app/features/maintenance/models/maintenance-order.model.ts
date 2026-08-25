import { MaintenanceSourceModule } from './unit-report.model';

export type MaintenanceType = 'Mecánico' | 'Instrumental' | 'Operativo';

export type SubOrderStatus =
  | 'Pendiente'
  | 'En Diagnóstico'
  | 'En Ejecución'
  | 'En Revisión de Cierre'
  | 'Cerrado'
  | 'Corrección Solicitada'
  | 'Derivado a Pumping';

export type OrderStatus = 'Pendiente' | 'En Mantenimiento' | 'Requiere cambios' | 'Aceptado' | 'Rechazado' | 'Cerrado';

export type UnitFinalState = 'Disponible' | 'Con restricciones';

export interface Repuesto {
  numeroParte: string;
  cantidad: number;
  descripcion: string;
}

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
  horasTrabajo?: number;
  repuestos?: Repuesto[];
  /** Motivo que escribió el Jefe al rechazar el cierre — solo tiene sentido mientras está en Corrección Solicitada. */
  correctionNote?: string;
  /**
   * Problemas detectados durante la ejecución que exceden el alcance de
   * esta sub-orden (D3: se gestionan sobre la orden existente, no generan
   * una orden nueva). Alimenta el casillero "Trabajos adicionales por
   * atender" del Informe de Mantenimiento (DYN-MNT-RE-008).
   */
  trabajosAdicionales?: string;
  // ── Marcas de tiempo para KPIs (MAN-MASTER-001 / Fase 10) ──
  /** Cuándo se guardó el primer avance (Pendiente → En Ejecución) — inicio real del trabajo. */
  ejecucionIniciadaEn?: string;
  /** Cuándo se envió a revisión de cierre — fin del trabajo del operador. */
  ejecucionTerminadaEn?: string;
  /** Cuándo el Jefe aprobó el cierre de esta sub-orden. */
  cierreAprobadoEn?: string;
  /** Motivo de la derivación a Pumping — solo aplica a tipo Operativo. */
  deriveNote?: string;
}

export interface MaintenanceOrder {
  id: number;
  code: string;
  unidad: string;
  unitReportId: number;
  origin: string;
  sourceModule: MaintenanceSourceModule;
  createdAt: string;
  /** Fin Correctivo — se llena solo cuando la orden ya se devolvió a Operaciones. */
  returnedToOperation: boolean;
  finalUnitState?: UnitFinalState;
  finalObservaciones?: string;
  finalResponsable?: string;
  /** Fin Correctivo — cuándo se devolvió la unidad a Operaciones. Base para "tiempo fuera de servicio". */
  closedAt?: string;
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
  if (subOrders.some(s => s.status === 'En Diagnóstico' || s.status === 'En Ejecución' || s.status === 'En Revisión de Cierre')) return 'En Mantenimiento';
  return 'Pendiente';
}
