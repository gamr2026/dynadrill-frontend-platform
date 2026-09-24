/**
 * Gerenciamiento de Viaje (DYN-SGI-RE-049) solicitado directamente por el
 * Conductor — antes solo lo abría el Supervisor desde dentro de un ticket
 * Pumping (ver `TravelManagement` en pumping.model.ts, del que este modelo
 * se duplica a propósito: mismo cuestionario de riesgo, distinto dominio,
 * sin cruzar Operaciones y Mantenimiento por un import). BAJO se
 * autoaprueba; MEDIO/ALTO queda pendiente del Jefe de Base.
 */
export type TravelRiskLevel = 'ALTO' | 'MEDIO' | 'BAJO';

export type VehicleType = 'Liviano' | 'Pesado';

export interface TravelRiskOption {
  label: string;
  value: number;
}

export interface TravelRiskQuestion {
  id: number;
  question: string;
  options: TravelRiskOption[];
  selectedValue: number | null;
  /** Varias opciones de una misma pregunta pueden compartir `value` (ej. "N/A = 0" y "Sí = 0") — se rastrea por etiqueta. */
  selectedLabel: string | null;
}

export function createTravelRiskQuestions(): TravelRiskQuestion[] {
  return [
    { id: 1, question: '¿Realizó inspección Pre-viaje?', options: [{ label: 'Sí: Continue', value: 0 }, { label: 'NO: Deténgase', value: 999 }], selectedValue: null, selectedLabel: null },
    { id: 2, question: '¿Es la primera vez que el conductor viajará por esta ruta?', options: [{ label: 'NO = 0', value: 0 }, { label: 'Sí = 15', value: 15 }], selectedValue: null, selectedLabel: null },
    { id: 3, question: '¿Es un conductor nuevo?', options: [{ label: 'NO = 0', value: 0 }, { label: '4m - 8m = 15', value: 15 }, { label: '0m - 3m = 40', value: 40 }], selectedValue: null, selectedLabel: null },
    { id: 4, question: '¿Cuántas horas trabajó el conductor antes de iniciar el viaje?', options: [{ label: '8 a 12 hs = 10', value: 10 }, { label: '> 12 <16 hs = 30', value: 30 }, { label: '> 16 hs', value: 999 }], selectedValue: null, selectedLabel: null },
    { id: 5, question: '¿Cuántas horas de sueño (durmió) tuvo el conductor en las últimas 24 horas?', options: [{ label: '< 4 hs = no conduce', value: 999 }, { label: '> 4 < 6 hs = 5', value: 5 }, { label: '> 6 hs = 0', value: 0 }], selectedValue: null, selectedLabel: null },
    { id: 6, question: '¿Cuánto tiempo (horas) se estima que demandará el viaje?', options: [{ label: '> 2 < 4 hs = 10', value: 10 }, { label: '> 4 < 6 hs = 15', value: 15 }, { label: '> 6 hs = 20', value: 20 }], selectedValue: null, selectedLabel: null },
    { id: 7, question: '¿Hay un conductor de respaldo para los viajes de más de 10 horas?', options: [{ label: 'NO = 5', value: 5 }, { label: 'Sí = 0', value: 0 }], selectedValue: null, selectedLabel: null },
    { id: 8, question: '¿Parte del viaje se desarrollará en condiciones de oscuridad?', options: [{ label: '< 4 hs = 0', value: 0 }, { label: '> 4 < 6 hs = 20', value: 20 }, { label: '> 6 hs = 40', value: 40 }], selectedValue: null, selectedLabel: null },
    { id: 9, question: '¿Cuáles son las condiciones meteorológicas y de visibilidad durante el viaje (lluvia, vientos fuertes, niebla, etc.)?', options: [{ label: 'Bueno = 0', value: 0 }, { label: 'Regular = 10', value: 10 }, { label: 'Deficiente = 25', value: 25 }], selectedValue: null, selectedLabel: null },
    { id: 10, question: '¿Cuál es la condición del camino y la topografía?', options: [{ label: 'Bueno = 0', value: 0 }, { label: 'Regular = 5', value: 5 }, { label: 'Deficiente = 15', value: 15 }], selectedValue: null, selectedLabel: null },
    { id: 11, question: '¿Existen cuestiones de seguridad a tener en cuenta (alto riesgo de rapto, secuestro, disturbios sociales, robo de material peligroso, etc.)?', options: [{ label: 'NO = 0', value: 0 }, { label: '**Sí, MITIGADO = 40', value: 40 }, { label: 'Sí = 75 No viaja', value: 75 }], selectedValue: null, selectedLabel: null },
    { id: 12, question: '¿Los Materiales Peligrosos y/o Controlados son enviados con la documentación necesaria, en vehículos apropiados y el conductor es certificado?', options: [{ label: 'NO = 50 no viaja', value: 50 }, { label: 'N/A = 0', value: 0 }, { label: 'Sí = 0', value: 0 }], selectedValue: null, selectedLabel: null },
  ];
}

export function calculateTravelRiskLevel(totalPoints: number): TravelRiskLevel {
  if (totalPoints > 75) return 'ALTO';
  if (totalPoints >= 31) return 'MEDIO';
  return 'BAJO';
}

export function getTravelRiskDescription(level: TravelRiskLevel): string {
  switch (level) {
    case 'ALTO':
      return 'Requiere además la aprobación del Director General (Quito), fuera del alcance del sistema.';
    case 'MEDIO':
      return 'Requiere la autorización del Jefe de Base antes de viajar.';
    case 'BAJO':
      return 'Viaje de rutina con bajo riesgo — se aprueba automáticamente.';
  }
}

export type GerenciamientoViajeEstado = 'pendiente' | 'aprobado' | 'rechazado';

export const GERENCIAMIENTO_VIAJE_ESTADO_LABELS: Record<GerenciamientoViajeEstado, string> = {
  pendiente: 'Pendiente de autorización',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export interface GerenciamientoViaje {
  id: number;
  code: string;
  estado: GerenciamientoViajeEstado;
  riskLevel: TravelRiskLevel;
  solicitanteUserId: number;

  fecha: string;
  motivoViaje: string;
  origen: string;
  destino: string;
  vehicleType: VehicleType;
  placas: string;
  ticketCode?: string;
  passengers?: string;
  departureTime?: string;
  arrivalTime?: string;
  overnightData?: string;
  riskQuestions: TravelRiskQuestion[];
  totalPoints: number;

  aprobadoPor?: string;
  aprobadoAt?: string;
  motivoRechazo?: string;
  rechazadoPor?: string;
  rechazadoAt?: string;

  createdAt: string;
}

export interface CreateGerenciamientoViajeInput {
  riskLevel: TravelRiskLevel;
  payload: Omit<GerenciamientoViaje, 'id' | 'code' | 'estado' | 'riskLevel' | 'solicitanteUserId' | 'createdAt' | 'aprobadoPor' | 'aprobadoAt' | 'motivoRechazo' | 'rechazadoPor' | 'rechazadoAt'>;
}
