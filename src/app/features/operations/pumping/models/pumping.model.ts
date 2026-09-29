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
  | 'revision_inicial'
  | 'asignacion'
  | 'traslado_salida'
  | 'revision_reportes_salida'
  | 'ejecucion_operativa'
  | 'control_retorno'
  | 'traslado_llegada'
  | 'mantenimiento'
  | 'revision_reportes_llegada'
  | 'revision_final'
  | 'cierre';

export const PUMPING_STEP_LABELS: Record<PumpingStep, string> = {
  revision_inicial: 'Revisión Inicial',
  asignacion: 'Asignación',
  traslado_salida: 'Traslado de Salida',
  revision_reportes_salida: 'Revisión de Reportes de Salida',
  ejecucion_operativa: 'Ejecución Operativa',
  control_retorno: 'Control de Retorno',
  traslado_llegada: 'Traslado de Llegada',
  mantenimiento: 'Mantenimiento',
  revision_reportes_llegada: 'Revisión de Reportes de Llegada',
  revision_final: 'Revisión Final',
  cierre: 'Cierre',
};

/**
 * Mapeo de cada paso del ticket al rol responsable y su roleId.
 * Usado para cambiar automáticamente de rol en la demo al avanzar el paso.
 */
export const PUMPING_STEP_ROLE: Record<PumpingStep, { roleName: string; roleId: number }> = {
  revision_inicial: { roleName: 'Jefe de Base', roleId: 4 },
  // Antes 'Supervisor' — el negocio pasó toda la asignación (Supervisor,
  // operadores, unidades y químicos) al Jefe de Base — ver
  // PLAN-QHSE-PUMPING-NOTIFICACIONES, Fase 1, D1. Solo Pumping (D2).
  asignacion: { roleName: 'Jefe de Base', roleId: 4 },
  traslado_salida: { roleName: 'Operador', roleId: 2 },
  revision_reportes_salida: { roleName: 'Supervisor', roleId: 1 },
  // El Reporte Diario de Actividades (DYN-SGI-RE-047) lo llena el Operador,
  // no el Supervisor — confirmado en el vault (conceptos/Reporte-Job.md) y
  // en la documentación de Facturación (FACT-002, PASOS DEL PROCESO).
  ejecucion_operativa: { roleName: 'Operador', roleId: 2 },
  control_retorno: { roleName: 'Supervisor', roleId: 1 },
  traslado_llegada: { roleName: 'Operador', roleId: 2 },
  mantenimiento: { roleName: 'Supervisor', roleId: 1 },
  revision_reportes_llegada: { roleName: 'Supervisor', roleId: 1 },
  revision_final: { roleName: 'Supervisor', roleId: 1 },
  cierre: { roleName: 'Supervisor', roleId: 1 },
};

/**
 * "Supervisor Pumping" cumple las mismas acciones que "Supervisor" pero
 * acotado a Pumping (ver sidebar.ts) — cualquier chequeo de "es el rol
 * responsable de este paso" debe aceptar ambos nombres de rol.
 */
export function esRolResponsablePumping(expectedRoleName: string | undefined, currentRoleName: string): boolean {
  if (!expectedRoleName) return false;
  if (expectedRoleName === currentRoleName) return true;
  return expectedRoleName === 'Supervisor' && currentRoleName === 'Supervisor Pumping';
}

// ── Entidades del dominio ──

export interface PumpingChemical {
  id: number;
  /** Id del Articulo real en el módulo Inventario — la salida/devolución de bodega se registra contra este id. */
  articuloId: number;
  name: string;
  quantityAssigned: number;
  quantityUsed: number;
  quantityReturned: number;
  unit: string;
  /** true una vez que el Supervisor registró el consumo real de cierre (aunque el sobrante sea 0). */
  consumptionRegistered: boolean;
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
  /** Nombre del documento de mezcla de químicos adjuntado al asignar químicos (DYN-PMP, sin código de formato asignado aún). */
  chemicalMixtureDocument?: string;
  tools: PumpingTool[];
  operators: PumpingOperator[];
  unitReport: PumpingUnitReport | null;
  currentStep: PumpingStep;
  /** Id del Pedido de Facturación asociado — link para el puente Pumping → Facturación (ver solicitud-cambio-items.model.ts). */
  pedidoId?: number;
  /** Código del Pedido de Facturación asociado — link para el puente Pumping → Facturación. */
  pedidoCode?: string;
  /** Nº de contrato/OT — heredado del Pedido, prellena el Reporte Diario. */
  numeroContrato?: string;
  /** Taladro/Rig — heredado del Pedido, prellena el selector de ubicación del Reporte Diario. */
  taladroRig?: string;
  taladroId?: number;
  /**
   * Fase 3, PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS: "Formalización de
   * ejecución" — el Supervisor confirma en el sistema la aprobación (hoy de
   * palabra) del Company Man para iniciar el trabajo en una zona. Vive acá
   * (no en el PTW); QHSE solo lo consulta desde "Documentos por pedido".
   */
  companyManAprobo?: boolean;
  companyManAprobadoPor?: string;
  companyManAprobadoAt?: string;
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

// Gerenciamiento de Viaje (DYN-SGI-RE-049) se retiró de este dominio — ya no
// lo genera el Supervisor desde el ticket, lo solicita el Conductor desde su
// propio portal (ver features/conductor/models/gerenciamiento-viaje.model.ts).
// El ticket solo consulta su estado (GerenciamientoViaje[] vía PumpingService.gerenciamientosViaje).

// ── Reporte diario de actividades de operaciones (DYN-SGI-RE-047) ──

export interface DailyActivityEntry {
  inicio: string;
  fin: string;
  horas: number | null;
  detalle: string;
}

export interface DailyActivityReport {
  fecha: string;
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
