import { Ticket } from '../../../../shared/models/ticket.model';

export type PumpingServiceType = 'pumping' | 'fcr';

export type PumpingStep =
  | 'revision_propuesta'
  | 'asignar_supervisor'
  | 'asignar_operador_unidad'
  | 'preparacion_documental'
  | 'ejecucion'
  | 'cierre_documental'
  | 'validacion_final';

export interface PumpingChemical {
  id: number;
  name: string;
  quantityAssigned: number;
  quantityUsed: number;
  quantityReturned: number;
  unit: string;
}

export interface PumpingTool {
  id: number;
  name: string;
  serialCode: string;
  status: 'seleccionada' | 'instalada' | 'devuelta';
}

export interface PumpingTicket extends Ticket {
  serviceType: PumpingServiceType;
  proposalOrigin: string;
  chemicals: PumpingChemical[];
  tools: PumpingTool[];
  currentStep: PumpingStep;
}
