export type MaintenanceType = 'Mecánico' | 'Instrumental' | 'Operativo';

export type SubOrderStatus = 'Pendiente' | 'En Diagnóstico' | 'En Revisión de Cierre' | 'Cerrado' | 'Corrección Solicitada';

export type OrderStatus = 'Pendiente' | 'Requiere cambios' | 'Aceptado' | 'Rechazado';

export interface SubOrder {
  id: number;
  orderId: number;
  code: string;
  type: MaintenanceType;
  operatorName?: string;
  status: SubOrderStatus;
  diagnostico?: string;
  actividadesCorrectivas?: string;
}

export interface MaintenanceOrder {
  id: number;
  code: string;
  unidad: string;
  unitReportId: number;
  origin: string;
  createdAt: string;
}

export interface MaintenanceOrderWithSubOrders extends MaintenanceOrder {
  subOrders: SubOrder[];
}

/**
 * El estado de la orden padre se deriva de sus sub-órdenes, nunca se guarda
 * independiente — regla confirmada: cierra (Aceptado) solo si TODAS sus
 * sub-órdenes están Cerrado.
 */
export function computeOrderStatus(subOrders: SubOrder[]): OrderStatus {
  if (subOrders.length === 0) return 'Pendiente';
  if (subOrders.some(s => s.status === 'Corrección Solicitada')) return 'Requiere cambios';
  if (subOrders.every(s => s.status === 'Cerrado')) return 'Aceptado';
  return 'Pendiente';
}
