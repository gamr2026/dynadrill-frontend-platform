/**
 * Modelo del formulario físico "Inspección de Vehículos" (DYN-SGI-RE-068) —
 * checklist previo a la salida para camionetas/camiones/cabezales (Plan de
 * Mantenimiento 2026, sección 5.4). Es la fuente del kilometraje de los
 * vehículos de apoyo: alimenta Unidad.kmActual (MAN-002), y si algún ítem
 * queda "No cumple" dispara el Reporte de Unidad correspondiente.
 */
export type ChecklistEstado = 'C' | 'NC' | 'NA' | null;

export interface VehicleChecklistItem {
  label: string;
  estado: ChecklistEstado;
}

/** Ítems fijos del formulario físico, agrupados por sección — no son datos configurables. */
export const VEHICLE_CHECKLIST_VEHICULO: string[] = [
  'Vidrios — buenas condiciones, no rotos, limpios, sin obstrucciones',
  'Alarma de retroceso — trabajando apropiadamente',
  'Suspensión — volante alineado, terminales, amortiguadores y paquetes',
  'Linterna — operativa y baterías de respaldo',
  'Espejo retrovisor — adecuado, ajustado para clara visión',
  'Limpiador de parabrisas y lavadores',
  'Corneta / pito — sonido alto y claro',
  'Faros delanteros — trabajando, alineados para evitar encandilar',
  'Luces traseras — stop, direccionales, luz de reversa',
  'Luces interiores — techo, puertas, instrumentos, señales',
  'Frenos — ajustados, el emergente sostiene el vehículo en desnivel',
  'Llantas — presión de aire, buen dibujo, libre de burbujas, de emergencia/repuesto',
  'Fugas — ausencia de fugas o liqueos',
  'Motor — no ruidos inusuales, buen entonamiento, no sobrecalienta',
  'Batería — soportes, nivel de agua, protectores de bornes',
  'Cinturones de seguridad — operativos para todos los asientos',
  'Instrumentos — trabajando bien, leen normalmente',
  'Sistema de escape — bien soportado, silencioso, atrapa chispas (para campo)',
  'Aire acondicionado — trabajando apropiadamente',
  'Transmisión — sin fugas, ni ruidos',
  'Fluidos — nivel de aceite, agua de batería, agua radiador, hidráulico',
  'Carrocería — no tiene daños, en buen estado',
  'Monitor de velocidad — instalado y funcionando',
  'Mantenimiento preventivo — alineación y balanceo, cambio de aceite, frenos',
];

export const VEHICLE_CHECKLIST_EQUIPO: string[] = [
  'Contactos — teléfonos / plan de emergencia actualizados',
  'Material de arrastre — cabo/soga (5m, 1/2" diámetro mínimo) u otro',
  'Herramientas — llaves, destornilladores, pinzas, cables batería, gata, llave de ruedas',
  'Botiquín — guantes quirúrgicos, alcohol/agua oxigenada, vendajes, gasas',
  'Extintor tipo ABC, polvo químico',
  'Kit de contingencia ambiental — fajas/cadenas, carpa/protección',
];

export interface VehicleInspection {
  id: number;
  unidadId: number;
  unidadCode: string;

  fecha: string;
  puntoPartida: string;
  destino: string;
  inspeccionadoPor: string;
  /** Se llena cuando el conductor genera un Reporte de Unidad por un ítem "No cumple" — permite seguirle el rastro hasta que se resuelva. */
  unitReportId?: number;

  // Descripción del vehículo
  marca: string;
  tipo: string;
  modelo: string;
  anioFabricacion: string;
  placa: string;

  // Documentos del vehículo
  fechaMatricula?: string;
  caducidadMatricula?: string;
  caducidadPoliza?: string;
  vigenciaOtroDocumento?: string;

  // Kilometraje
  kmInicial: number;
  kmFinal: number;
  proximoMantenimiento?: string;

  checklistVehiculo: VehicleChecklistItem[];
  checklistEquipo: VehicleChecklistItem[];

  // Documentos del conductor
  licenciaVigente: boolean;
  manejoDefensivoVigente: boolean;
  examenMedicoVigente: boolean;
  examenPsicosensometrico: boolean;
  documentosClientes: boolean;
  vacunasCertificado: boolean;
  reuneCondicionesParaTrabajar: boolean;
  observacionesConductor?: string;

  supervisorNombre?: string;

  createdAt: string;
}

export type CreateVehicleInspectionInput = Omit<VehicleInspection, 'id' | 'createdAt'>;

/** ¿Algún ítem quedó "No cumple"? — dispara la oferta de generar Reporte de Unidad (Plan 2026, 5.4). */
export function vehicleInspectionHasNoCumple(insp: Pick<VehicleInspection, 'checklistVehiculo' | 'checklistEquipo'>): boolean {
  return [...insp.checklistVehiculo, ...insp.checklistEquipo].some(item => item.estado === 'NC');
}
