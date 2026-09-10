export type TicketStatus = 'borrador' | 'en_revision' | 'aprobado' | 'en_ejecucion' | 'cerrado' | 'rechazado';

/** Estados de la Matriz IPERC — mismos valores que `IpercStatus` en el módulo QHSE. */
export type TicketIpercEstado = 'borrador' | 'en_evaluacion' | 'en_revision' | 'aprobada' | 'rechazada';

/** Una actividad de la Matriz Maestra IPERC que implica el trabajo del ticket. */
export interface TicketQhseActividad {
  nombre: string;
  ipercMatrixId: number;
  /** Estado VIVO de la evaluación de esa actividad (lo refresca el backend al leer el ticket). */
  estado: TicketIpercEstado;
}

/**
 * Vínculo del ticket operativo (Pumping/FCR) con QHSE — HSE-PLAN-001. El
 * backend verifica que la Matriz Maestra IPERC (DYN-SGI-RE-087) cubra
 * —aprobadas— todas las actividades que implica la línea de servicio.
 * `cobertura === 'ok'` sólo cuando todas están aprobadas; el gate del
 * detalle (asignar supervisor, pasar a ejecución) lo lee.
 */
export interface TicketQhseVinculo {
  matrizMaestra: string;
  cobertura: 'ok' | 'incompleta';
  actividades: TicketQhseActividad[];
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
