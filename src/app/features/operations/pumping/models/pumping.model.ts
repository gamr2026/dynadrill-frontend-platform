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
  | 'revisar_reportes_salida'
  | 'ejecucion_operativa'
  | 'en_ejecucion_llegada'
  | 'mantenimiento'
  | 'revisar_reportes_llegada'
  | 'en_revision';

export const PUMPING_STEP_LABELS: Record<PumpingStep, string> = {
  revision_propuesta: 'Revisión de propuesta',
  asignacion: 'Asignación',
  en_ejecucion: 'En ejecución (Salida)',
  revisar_reportes_salida: 'Revisar reportes de salida',
  ejecucion_operativa: 'Ejecución operativa',
  en_ejecucion_llegada: 'En ejecución (Llegada)',
  mantenimiento: 'Mantenimiento',
  revisar_reportes_llegada: 'Revisar reportes de llegada',
  en_revision: 'En revisión',
};

/**
 * Mapeo de cada paso del ticket al rol responsable y su roleId.
 * Usado para cambiar automáticamente de rol en la demo al avanzar el paso.
 */
export const PUMPING_STEP_ROLE: Record<PumpingStep, { roleName: string; roleId: number }> = {
  revision_propuesta: { roleName: 'Jefe de Base', roleId: 4 },
  asignacion: { roleName: 'Supervisor', roleId: 1 },
  en_ejecucion: { roleName: 'Operador', roleId: 2 },
  revisar_reportes_salida: { roleName: 'Supervisor', roleId: 1 },
  ejecucion_operativa: { roleName: 'Supervisor', roleId: 1 },
  en_ejecucion_llegada: { roleName: 'Operador', roleId: 2 },
  mantenimiento: { roleName: 'Supervisor', roleId: 1 },
  revisar_reportes_llegada: { roleName: 'Supervisor', roleId: 1 },
  en_revision: { roleName: 'Supervisor', roleId: 1 },
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

/** Número de ejes varía por unidad — arranca con 2 (mínimo típico), se pueden agregar más. */
export function createDefaultHubodometro(): HubodometroEntry[] {
  return ['A', 'B'].map(label => ({ label, salida: null, llegada: null }));
}

/** Siguiente letra de eje disponible (A, B, C, ...) según cuántos ya existen. */
export function nextHubodometroAxleLabel(current: HubodometroEntry[]): string {
  return String.fromCharCode(65 + current.length);
}

export interface TireEntry {
  /** Posición física de la llanta — máximo 4 en total (delantera/trasera x izq/der) */
  position: string;
  salida: string;
  llegada: string;
}

const TIRE_POSITIONS = ['Delantera Izq.', 'Delantera Der.', 'Trasera Izq.', 'Trasera Der.'];

export function createDefaultTires(): TireEntry[] {
  return TIRE_POSITIONS.map(position => ({ position, salida: '', llegada: '' }));
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
  /** Lectura del hubodómetro por eje, tomada en el punto de Origen del trayecto */
  hubodometroOrigen: HubodometroEntry[];
  /** Lectura del hubodómetro por eje, tomada en el punto de Destino del trayecto */
  hubodometroDestino: HubodometroEntry[];
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
  departureApprovalDate: string;
  arrivalOperatorName: string;
  arrivalApprovalDate: string;
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

// ── Gerenciamiento de Viaje (DYN-SGI-RE-049) ──

export type TravelRiskLevel = 'ALTO' | 'MEDIO' | 'BAJO';

export type VehicleType = 'Liviano' | 'Pesado';

export interface TravelRiskQuestion {
  id: number;
  question: string;
  options: TravelRiskOption[];
  selectedValue: number | null;
}

export interface TravelRiskOption {
  label: string;
  value: number;
}

export interface TravelRouteInfo {
  location: string;
  arrivalTime: string;
  departureTime: string;
  overnightDetails: string;
}

export interface TravelCommunicationDetail {
  frequency: string;
  contactPerson: string;
  contactDetails: string;
}

export interface TravelManagement {
  fecha: string;
  motivoViaje: string;
  lineaServicio: string;
  origen: string;
  destino: string;
  gerenteSupervisor: string;
  ticketNo: string;
  conductores: string;
  vehicleType: VehicleType;
  placas: string;
  riskQuestions: TravelRiskQuestion[];
  totalPoints: number;
  riskLevel: TravelRiskLevel;
  passengers: string;
  canCombineTrips: boolean | null;
  routeInfo: TravelRouteInfo[];
  communication: TravelCommunicationDetail[];
  arrivalTime: string;
  departureTime: string;
  overnightData: string;
  conductorNames: string;
  approverName: string;
  conductorSignature: string;
  approverSignature: string;
  phoneApprovalBy: string;
  phoneApprovalTime: string;
}

export function createTravelRiskQuestions(): TravelRiskQuestion[] {
  return [
    {
      id: 1,
      question: '¿Realizó inspección Pre-viaje?',
      options: [
        { label: 'Sí: Continue', value: 0 },
        { label: 'NO: Deténgase', value: 999 },
      ],
      selectedValue: null,
    },
    {
      id: 2,
      question: '¿Es la primera vez que el conductor viajará por esta ruta?',
      options: [
        { label: 'NO = 0', value: 0 },
        { label: 'Sí = 15', value: 15 },
      ],
      selectedValue: null,
    },
    {
      id: 3,
      question: '¿Es un conductor nuevo?',
      options: [
        { label: 'NO = 0', value: 0 },
        { label: '4m - 8m = 15', value: 15 },
        { label: '0m - 3m = 40', value: 40 },
      ],
      selectedValue: null,
    },
    {
      id: 4,
      question: '¿Cuántas horas trabajó el conductor antes de iniciar el viaje?',
      options: [
        { label: '8 a 12 hs = 10', value: 10 },
        { label: '> 12 <16 hs = 30', value: 30 },
        { label: '> 16 hs', value: 999 },
      ],
      selectedValue: null,
    },
    {
      id: 5,
      question: '¿Cuántas horas de sueño (durmió) tuvo el conductor en las últimas 24 horas?',
      options: [
        { label: '< 4 hs = no conduce', value: 999 },
        { label: '> 4 < 6 hs = 5', value: 5 },
        { label: '> 6 hs = 0', value: 0 },
      ],
      selectedValue: null,
    },
    {
      id: 6,
      question: '¿Cuánto tiempo (horas) se estima que demandará el viaje?',
      options: [
        { label: '> 2 < 4 hs = 10', value: 10 },
        { label: '> 4 < 6 hs = 15', value: 15 },
        { label: '> 6 hs = 20', value: 20 },
      ],
      selectedValue: null,
    },
    {
      id: 7,
      question: '¿Hay un conductor de respaldo para los viajes de más de 10 horas?',
      options: [
        { label: 'NO = 5', value: 5 },
        { label: 'Sí = 0', value: 0 },
      ],
      selectedValue: null,
    },
    {
      id: 8,
      question: '¿Parte del viaje se desarrollará en condiciones de oscuridad?',
      options: [
        { label: '< 4 hs = 0', value: 0 },
        { label: '> 4 < 6 hs = 20', value: 20 },
        { label: '> 6 hs = 40', value: 40 },
      ],
      selectedValue: null,
    },
    {
      id: 9,
      question: '¿Cuáles son las condiciones meteorológicas y de visibilidad durante el viaje (lluvia, vientos fuertes, niebla, etc.)?',
      options: [
        { label: 'Bueno = 0', value: 0 },
        { label: 'Regular = 10', value: 10 },
        { label: 'Deficiente = 25', value: 25 },
      ],
      selectedValue: null,
    },
    {
      id: 10,
      question: '¿Cuál es la condición del camino y la topografía?',
      options: [
        { label: 'Bueno = 0', value: 0 },
        { label: 'Regular = 5', value: 5 },
        { label: 'Deficiente = 15', value: 15 },
      ],
      selectedValue: null,
    },
    {
      id: 11,
      question: '¿Existen cuestiones de seguridad a tener en cuenta (alto riesgo de rapto, secuestro, disturbios sociales, robo de material peligroso, etc.)?',
      options: [
        { label: 'NO = 0', value: 0 },
        { label: '**Sí, MITIGADO = 40', value: 40 },
        { label: 'Sí = 75 No viaja', value: 75 },
      ],
      selectedValue: null,
    },
    {
      id: 12,
      question: '¿Los Materiales Peligrosos y/o Controlados son enviados con la documentación necesaria, en vehículos apropiados y el conductor es certificado?',
      options: [
        { label: 'NO = 50 no viaja', value: 50 },
        { label: 'N/A = 0', value: 0 },
        { label: 'Sí = 0', value: 0 },
      ],
      selectedValue: null,
    },
  ];
}

export function calculateTravelRiskLevel(totalPoints: number): TravelRiskLevel {
  if (totalPoints > 75) return 'ALTO';
  if (totalPoints >= 31) return 'MEDIO';
  return 'BAJO';
}

export function getTravelRiskDescription(level: TravelRiskLevel): string {
  switch (level) {
    case 'ALTO': return 'Desde 23:00 pm hasta 05:00 am — Requiere aprobación de Director General (Quito)';
    case 'MEDIO': return 'Desde 18:00 pm hasta 23:00 am — Requiere aprobación de Jefe de Base';
    case 'BAJO': return 'Desde 05:00 pm hasta 18:00 am — Viajes de rutina con bajo riesgo: Supervisor directo/Jefe de Base';
  }
}

// ── Reporte diario de actividades de operaciones (DYN-SGI-RE-047) ──

export interface DailyActivityEntry {
  inicio: string;
  fin: string;
  horas: number | null;
  detalle: string;
}

export interface DailyActivityReport {
  fecha: string;
  numero: string;
  cliente: string;
  ordenContrato: string;
  pozo: string;
  representanteCliente: string;
  campoBloque: string;
  cargo: string;
  taladro: string;
  actividades: DailyActivityEntry[];
  tiempoProductivo: number | null;
  tiempoNoProductivo: number | null;
  tiempoTotal: number | null;
  observaciones: string;
  nombreSupervisor: string;
  nombreCliente: string;
  firmaSupervisor: string;
  firmaCliente: string;
  ciSupervisor: string;
  ciCliente: string;
  archivoAdjunto: string | null;
}
