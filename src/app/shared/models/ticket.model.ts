export type TicketStatus = 'borrador' | 'en_revision' | 'aprobado' | 'en_ejecucion' | 'cerrado' | 'rechazado';

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
}
