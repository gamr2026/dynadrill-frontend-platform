import { Ticket } from '../../../../shared/models/ticket.model';
import type { DynadrillInspectionItem } from '@digitec-it-projects/dynadrill-ui';

// ── Tipos de servicio ──

export type PumpingServiceType =
  | 'coiled_tubing'
  | 'fluidos_control'
  | 'cementacion_remedial'
  | 'estimulaciones'
  | 'servicios_nitrogeno';

export const PUMPING_SERVICE_TYPE_LABELS: Record<PumpingServiceType, string> = {
  coiled_tubing: 'Coiled Tubing',
  fluidos_control: 'Fluidos de Control de Pozos',
  cementacion_remedial: 'Cementación Remedial',
  estimulaciones: 'Estimulaciones',
  servicios_nitrogeno: 'Servicios de Nitrógeno',
};

// ── Roles ──

export type PumpingRole = 'jefe_base' | 'supervisor' | 'operador';

export const PUMPING_ROLE_LABELS: Record<PumpingRole, string> = {
  jefe_base: 'Jefe de Base',
  supervisor: 'Supervisor',
  operador: 'Operador',
};

// ── Estados del ticket en proceso ──

export type PumpingStep =
  | 'revision_propuesta'
  | 'asignacion'
  | 'en_ejecucion'
  | 'en_ejecucion_llegada'
  | 'en_revision';

export const PUMPING_STEP_LABELS: Record<PumpingStep, string> = {
  revision_propuesta: 'Revisión de propuesta',
  asignacion: 'Asignación',
  en_ejecucion: 'En ejecución (Salida)',
  en_ejecucion_llegada: 'En ejecución (Llegada)',
  en_revision: 'En revisión',
};

// ── Entidades del dominio ──

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

export interface PumpingOperator {
  id: number;
  name: string;
  role: string;
  unitCode: string;
}

// ── Reporte de Unidad (DYN-MNT-RE-012) ──

export interface HubodometroEntry {
  label: string;
  salida: number | null;
  llegada: number | null;
}

export interface TireEntry {
  axle: string;
  salida: string;
  llegada: string;
}

export interface UnitReportNovelties {
  mecanica: string;
  instrumentacion: string;
  operaciones: string;
}

export interface PumpingUnitReport {
  reportCode: string;
  unitCode: string;
  wellName: string;
  baseName: string;
  blockName: string;
  headerCode: string;
  clientName: string;
  departureDate: string;
  arrivalDate: string;
  fuelDeparture: number | null;
  fuelArrival: number | null;
  hubodometro: HubodometroEntry[];
  tires: TireEntry[];
  origin: string;
  destination: string;
  chassisInspection: DynadrillInspectionItem[];
  motorInspection: DynadrillInspectionItem[];
  arrivalEquipmentInspection: DynadrillInspectionItem[];
  instrumentationInspection: DynadrillInspectionItem[];
  novelties: UnitReportNovelties;
  unitReady: boolean | null;
  operationInterrupted: boolean | null;
  interruptionDetail: string;
  departureOperatorName: string;
  arrivalOperatorName: string;
}

export interface PumpingTicket extends Ticket {
  serviceType: PumpingServiceType;
  proposalOrigin: string;
  chemicals: PumpingChemical[];
  tools: PumpingTool[];
  operators: PumpingOperator[];
  unitReport: PumpingUnitReport | null;
  currentStep: PumpingStep;
}

// ── Templates de inspección (ítems del formulario físico DYN-MNT-RE-012) ──

export function createChassisInspectionItems(): DynadrillInspectionItem[] {
  return [
    { id: 'ch-01', label: 'Condición/nivel de refrigerante', salida: null, llegada: null },
    { id: 'ch-02', label: 'Correas', salida: null, llegada: null },
    { id: 'ch-03', label: 'Aceite del motor: nivel y presión normal', salida: null, llegada: null },
    { id: 'ch-04', label: 'Mangueras y abrazaderas del motor', salida: null, llegada: null },
    { id: 'ch-05', label: 'Filtros y sistema de combustible', salida: null, llegada: null },
    { id: 'ch-06', label: 'Instrumental de cabina', salida: null, llegada: null },
    { id: 'ch-07', label: 'Presión del sistema neumático', salida: null, llegada: null },
    { id: 'ch-08', label: 'Parabrisas / limpiaparabrisas', salida: null, llegada: null },
    { id: 'ch-09', label: 'Luces del vehículo', salida: null, llegada: null },
    { id: 'ch-10', label: 'Conexiones de tráiler / quinta rueda', salida: null, llegada: null },
    { id: 'ch-11', label: 'Neumáticos, condición / PSI', salida: null, llegada: null },
    { id: 'ch-12', label: 'Frenos regulados, pérdidas de aire', salida: null, llegada: null },
    { id: 'ch-13', label: 'Instrumentación / electrónica (test)', salida: null, llegada: null },
    { id: 'ch-14', label: 'Sistema de monitoreo de conducción', salida: null, llegada: null },
    { id: 'ch-15', label: 'Pruebas operativas previas', salida: null, llegada: null },
    { id: 'ch-16', label: 'Mecanismos y mandos operacionales', salida: null, llegada: null },
    { id: 'ch-17', label: 'Equipos aux. (generador, compresor, etc.)', salida: null, llegada: null },
    { id: 'ch-18', label: 'Documentos del vehículo', salida: null, llegada: null },
    { id: 'ch-19', label: 'Cinturones de seguridad', salida: null, llegada: null },
    { id: 'ch-20', label: 'Otros ítems que afecten la seguridad', salida: null, llegada: null },
  ];
}

export function createMotorInspectionItems(): DynadrillInspectionItem[] {
  return [
    { id: 'mt-01', label: 'Motor: rendimiento, ruidos, etc.', salida: null, llegada: null },
    { id: 'mt-02', label: 'Transmisión', salida: null, llegada: null },
    { id: 'mt-03', label: 'Diferenciales', salida: null, llegada: null },
    { id: 'mt-04', label: 'Dirección', salida: null, llegada: null },
    { id: 'mt-05', label: 'Frenos', salida: null, llegada: null },
    { id: 'mt-06', label: 'Embrague', salida: null, llegada: null },
    { id: 'mt-07', label: 'Radiadores', salida: null, llegada: null },
    { id: 'mt-08', label: 'Mangueras', salida: null, llegada: null },
    { id: 'mt-09', label: 'Cardanes', salida: null, llegada: null },
    { id: 'mt-10', label: 'Neumáticos', salida: null, llegada: null },
    { id: 'mt-11', label: 'Instrumental de cabina', salida: null, llegada: null },
    { id: 'mt-12', label: 'Luces, instalación eléctrica', salida: null, llegada: null },
    { id: 'mt-13', label: 'Suspensión', salida: null, llegada: null },
    { id: 'mt-14', label: 'Cables', salida: null, llegada: null },
    { id: 'mt-15', label: 'Sensores (presión, temp., etc.)', salida: null, llegada: null },
    { id: 'mt-16', label: 'Conexiones externas', salida: null, llegada: null },
    { id: 'mt-17', label: 'Estabilizadores', salida: null, llegada: null },
    { id: 'mt-18', label: 'Boom-tornamesa', salida: null, llegada: null },
    { id: 'mt-19', label: 'Poleas', salida: null, llegada: null },
    { id: 'mt-20', label: 'Otros', salida: null, llegada: null },
  ];
}

export function createArrivalEquipmentItems(): DynadrillInspectionItem[] {
  return [
    { id: 'eq-01', label: 'Motores/transmisiones', salida: null, llegada: null },
    { id: 'eq-02', label: 'Radiadores (niveles) y mangueras', salida: null, llegada: null },
    { id: 'eq-03', label: 'Aceites (contaminación y niveles)', salida: null, llegada: null },
    { id: 'eq-04', label: 'Filtros y sistema de diésel (combustible)', salida: null, llegada: null },
    { id: 'eq-05', label: 'Sistema hidráulico', salida: null, llegada: null },
    { id: 'eq-06', label: 'Sistema neumático', salida: null, llegada: null },
    { id: 'eq-07', label: 'Fluid End - Power End', salida: null, llegada: null },
    { id: 'eq-08', label: 'Cardanes y protecciones', salida: null, llegada: null },
    { id: 'eq-09', label: 'Centrífugas', salida: null, llegada: null },
    { id: 'eq-10', label: 'Equipos aux. (generador, compresor, etc.)', salida: null, llegada: null },
    { id: 'eq-11', label: 'Instalación eléctrica', salida: null, llegada: null },
    { id: 'eq-12', label: 'Instrumentos panel del operador', salida: null, llegada: null },
    { id: 'eq-13', label: 'Pare de emergencia', salida: null, llegada: null },
    { id: 'eq-14', label: 'Manifold y líneas de alta y baja presión', salida: null, llegada: null },
    { id: 'eq-15', label: 'Sistema de mezcla - recirculador', salida: null, llegada: null },
    { id: 'eq-16', label: 'Inyector - BOP - Reel - Cabina de control', salida: null, llegada: null },
  ];
}

export function createInstrumentationItems(): DynadrillInspectionItem[] {
  return [
    { id: 'in-01', label: 'Sistema de adquisición de datos (DAS)', salida: null, llegada: null },
    { id: 'in-02', label: 'Controladores', salida: null, llegada: null },
    { id: 'in-03', label: 'Monitores, indicadores, etc.', salida: null, llegada: null },
  ];
}
