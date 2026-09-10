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

/** Fases de HSE-SITIO-001 — mismos valores que `PtwFase` en el módulo QHSE. */
export type TicketPtwFase =
  | 'gabinete'
  | 'ingreso'
  | 'verificaciones'
  | 'formalizacion'
  | 'ejecucion'
  | 'gestion_documental';

/**
 * Estado del PTW/Recibimiento de Sitio del servicio (HSE-SITIO-001). El
 * backend lo adjunta al ticket; `null` mientras no se haya abierto (la
 * cobertura IPERC tiene que estar completa primero).
 */
export interface TicketQhsePtw {
  id: number;
  code: string;
  fase: TicketPtwFase;
  /** Fase 4 — firmado en sitio por el Company Man. Habilita la ejecución en campo. */
  firmadoSitio: boolean;
  /** Fase 6 — PTW cerrado + Acta de Devolución. Habilita la prefactura. */
  cerrado: boolean;
}

/**
 * Vínculo del ticket operativo (Pumping/FCR) con QHSE — HSE-PLAN-001. El
 * backend verifica que la Matriz Maestra IPERC (DYN-SGI-RE-087) cubra
 * —aprobadas— todas las actividades que implica la línea de servicio.
 * `cobertura === 'ok'` sólo cuando todas están aprobadas; el gate del
 * detalle (asignar supervisor, pasar a ejecución) lo lee. `ptw` es el
 * segundo gate (HSE-SITIO-001): ejecución en campo y prefactura.
 */
export interface TicketQhseVinculo {
  matrizMaestra: string;
  cobertura: 'ok' | 'incompleta';
  actividades: TicketQhseActividad[];
  ptw?: TicketQhsePtw | null;
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
