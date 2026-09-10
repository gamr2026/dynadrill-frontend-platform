export type TicketStatus = 'borrador' | 'en_revision' | 'aprobado' | 'en_ejecucion' | 'cerrado' | 'rechazado';

/** Estados de la Matriz IPERC — mismos valores que `IpercStatus` en el módulo QHSE. */
export type TicketIpercEstado = 'borrador' | 'en_evaluacion' | 'en_revision' | 'aprobada' | 'rechazada';

/**
 * Vínculo del ticket operativo (Pumping/FCR) con QHSE — HSE-PLAN-001. Lo
 * asigna el backend al crear el ticket: una Matriz IPERC por tipo de
 * actividad, reutilizada si ya hay una aprobada. `ipercEstado` llega
 * refrescado con el estado VIVO de la matriz — el gate de "pasar a
 * ejecución" y el panel del detalle lo leen.
 */
export interface TicketQhseVinculo {
  ipercMatrixId: number;
  ipercCode: string;
  ipercEstado: TicketIpercEstado;
  /** true si se reutilizó una matriz aprobada existente; false si se creó una solicitud nueva. */
  reutilizada?: boolean;
  origenOperativo?: { tipo: 'pumping' | 'fcr'; ticketCode: string; pedidoCode?: string };
}

export interface Ticket {
  id: number;
  code: string;
  status: TicketStatus;
  wellName: string;
  clientName: string;
  estimatedDate: string;
  assignedSupervisor: string;
  assignedOperator: string;
  unitCode: string;
  /** Matriz IPERC vinculada (HSE-PLAN-001). Ausente en tickets antiguos sin sembrar. */
  qhse?: TicketQhseVinculo;
}
