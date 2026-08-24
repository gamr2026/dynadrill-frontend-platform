/**
 * Modelo del formulario físico "Reporte de Unidad" (DYN-MNT-RE-012) — es el
 * disparador del flujo correctivo cuando trae problemas reportados.
 */
export interface ChecklistDualItem {
  label: string;
  salida: 'ok' | 'x' | null;
  llegada: 'ok' | 'x' | null;
}

export type MaintenanceSourceModule = 'Pumping' | 'FCR' | 'Vehículos';

export interface UnitReport {
  id: number;
  reportNo: string;
  sourceModule: MaintenanceSourceModule;
  pozo: string;
  bloque: string;
  cliente: string;
  base: string;
  /** FK a Unidad — de acá se lee horómetro/km acumulado para el casillero de horas. */
  unidadId: number;
  /** Denormalizado para mostrar sin resolver la unidad (code o nombre corto). */
  unidad: string;
  /** Cuando este reporte se generó desde una falla detectada en Inspección de Vehículos (DYN-SGI-RE-068). */
  originVehicleInspectionId?: number;
  /** Cuando este reporte se generó automáticamente desde el Reporte de Unidad de un ticket de Pumping. */
  originTicketId?: number;
  fechaSalida: string;
  fechaLlegada: string;
  horometroSalida?: number;
  horometroLlegada?: number;
  odometroSalida?: number;
  odometroLlegada?: number;
  origen?: string;
  destino?: string;
  inspeccionChasis: ChecklistDualItem[];
  inspeccionPlataforma: ChecklistDualItem[];
  inspeccionInstrumentacion: ChecklistDualItem[];
  problemasMecanica: string;
  problemasInstrumentacion: string;
  problemasOperaciones: string;
  interrumpioOperacion: boolean;
  detalleInterrupcion?: string;
  listaParaSiguienteOperacion: boolean;
  operadorSalida: string;
  supervisorSalida: string;
  operadorLlegada?: string;
  supervisorLlegada?: string;
  /** true = el Jefe de Mantenimiento revisó el reporte y decidió que NO requiere mantenimiento (MAN-001-A). */
  dismissed: boolean;
  /**
   * Motivo del descarte — obligatorio al marcar "No requiere mantenimiento".
   * Sin esto, si Operaciones pregunta después por qué se rechazó un caso,
   * Mantenimiento no tendría cómo justificarlo (el registro seguiría
   * visible en la Bandeja, pero sin explicación).
   */
  dismissReason?: string;
  createdAt: string;
}

export type CreateUnitReportInput = Omit<UnitReport, 'id' | 'createdAt' | 'dismissed' | 'dismissReason'>;

/** ¿El reporte trae alguna novedad que amerite disparar una orden de mantenimiento? */
export function unitReportHasNovedades(report: Pick<UnitReport, 'problemasMecanica' | 'problemasInstrumentacion' | 'problemasOperaciones'>): boolean {
  return !!(report.problemasMecanica.trim() || report.problemasInstrumentacion.trim() || report.problemasOperaciones.trim());
}

/** Código legible del Reporte de Unidad — mismo formato en toda la pantalla donde se muestre. */
export function unitReportCode(reportNo: string): string {
  return `R${reportNo}`;
}

/** Ítems fijos del formulario físico — no son datos configurables. */
export const CHASIS_CHECKLIST_LABELS: string[] = [
  'Condiciones/Nivel de refrigerante',
  'Correas',
  'Aceite del motor: nivel y presión normal',
  'Mangueras y abrazaderas del motor',
  'Filtros y sistema de combustible',
  'Instrumental de cabina',
  'Presión del sistema neumático',
  'Mangueras (uso normal)',
  'Luces del vehículo',
  'Conexiones de tráiler / quinta rueda',
  'Neumáticos, condición',
  'Frenos regulados, pérdidas de aire',
  'Instrumentación / eléctrico (test)',
  'Sistema de monitoreo de conducción',
  'Documentos del vehículo',
  'Cinturones de seguridad',
  'Elementos de seguridad',
  'Otros ítems que afecten a seguridad',
];

export const PLATAFORMA_CHECKLIST_LABELS: string[] = [
  'Motores / transmisiones',
  'Radiadores (niveles / mangueras)',
  'Ventiladores',
  'Sistema hidráulico',
  'Fluid end / Power end',
  'Camarones / protecciones',
  'Equipo auxiliar (gen/comp)',
  'Instalación eléctrica',
  'Instrumentos panel del gobierno',
  'Panel de emergencia',
  'Manifold válvulas de alta y baja presión',
];

export const INSTRUMENTACION_CHECKLIST_LABELS: string[] = [
  'Sistema de adquisición de datos (DAS)',
  'Controladores',
  'Monitores / indicadores',
];
