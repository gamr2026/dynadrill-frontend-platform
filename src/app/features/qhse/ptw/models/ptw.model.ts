/**
 * Fases de HSE-SITIO-001 (Recibimiento de Sitio y Apertura de PTW):
 * Gabinete → Ingreso → Verificaciones → Formalización → Ejecución →
 * Gestión documental. Un PTW solo puede abrirse desde un HSE-PLAN-001
 * (IPERC) ya aprobado — HSE-MASTER-001 lo marca como integración
 * automática ("sin IPERC aprobado, el sistema bloquea la apertura del
 * PTW"); esa validación vive en el mock/servicio de creación, no acá.
 */
export type PtwFase = 'gabinete' | 'ingreso' | 'verificaciones' | 'formalizacion' | 'ejecucion' | 'gestion_documental';

export const PTW_FASE_ORDER: PtwFase[] = [
  'gabinete',
  'ingreso',
  'verificaciones',
  'formalizacion',
  'ejecucion',
  'gestion_documental',
];

export const PTW_FASE_STEPS = ['Gabinete', 'Ingreso', 'Verificaciones', 'Formalización', 'Ejecución', 'Gest. doc.'];

export const PTW_FASE_LABELS: Record<PtwFase, string> = {
  gabinete: 'Preparación en gabinete',
  ingreso: 'Ingreso a locación',
  verificaciones: 'Verificaciones de seguridad',
  formalizacion: 'Formalización del recibimiento',
  ejecucion: 'Ejecución y devolución',
  gestion_documental: 'Gestión documental final',
};

/**
 * Los 4 formatos de HSE-SITIO-001 pertenecen al cliente o son estándares
 * externos (MSP) — el sistema únicamente los carga, valida y archiva, no
 * los construye como formulario propio (a diferencia de la Matriz IPERC).
 */
export type PtwDocumentoTipo = 'formato_recepcion' | 'art' | 'ptw_prellenado' | 'carnet_vacunas' | 'sfi';

export const PTW_DOCUMENTOS_REQUERIDOS: { tipo: PtwDocumentoTipo; label: string }[] = [
  { tipo: 'formato_recepcion', label: 'Formato de Recepción de la Locación' },
  { tipo: 'art', label: 'Análisis de Riesgo en el Trabajo (ART)' },
  // Antes "Permiso de Trabajo (PTW) pre-llenado" — D3: mismo documento
  // (`tipo` sin cambios), solo cambia el label pedido por el negocio.
  { tipo: 'ptw_prellenado', label: 'Permiso de Trabajo (PT)' },
  { tipo: 'carnet_vacunas', label: 'Carnet o Registro de Vacunas' },
  // Nuevo (Fase 2, punto 6): lo elabora QHSE, el Supervisor se lo entrega a PE.
  { tipo: 'sfi', label: 'Formato de Seguridad de Ingreso (SFI)' },
];

export interface PtwDocumento {
  tipo: PtwDocumentoTipo;
  label: string;
  cargado: boolean;
  fileName?: string;
  cargadoAt?: string;
}

export type PtwGas = 'H2S' | 'LEL' | 'O2' | 'CO';

/**
 * Límites de HSE-SITIO-001 ("Puntos Críticos de Seguridad · Monitoreo de
 * Gases"). O2 es el único de rango doble (déficit o exceso de oxígeno son
 * ambos inseguros); el resto es límite superior.
 */
export const PTW_GAS_LIMITES: Record<PtwGas, { label: string; unidad: string; min?: number; max: number }> = {
  H2S: { label: 'H2S (Ácido Sulfhídrico)', unidad: 'ppm', max: 10 },
  LEL: { label: 'LEL (Límite Explosivo Inferior)', unidad: '%', max: 10 },
  O2: { label: 'O2 (Oxígeno)', unidad: '%', min: 19.5, max: 23.5 },
  CO: { label: 'CO (Monóxido de Carbono)', unidad: 'ppm', max: 25 },
};

export function ptwGasLimiteLabel(gas: PtwGas): string {
  const l = PTW_GAS_LIMITES[gas];
  return l.min != null ? `${l.min}% - ${l.max}%` : `< ${l.max} ${l.unidad}`;
}

export function ptwGasEsSeguro(gas: PtwGas, lectura: number): boolean {
  const l = PTW_GAS_LIMITES[gas];
  if (l.min != null) return lectura >= l.min && lectura <= l.max;
  return lectura < l.max;
}

export interface PtwGasReading {
  gas: PtwGas;
  lectura: number;
  seguro: boolean;
  medidoAt: string;
}

/** "Una línea": usuario + fecha, sin captura de firma manuscrita (decisiones del plan de desarrollo del módulo QHSE). */
export interface PtwFirma {
  nombre: string;
  firmadoAt: string;
}

/**
 * HSE-SITIO-001 describe el monitoreo de gases y el Toolbox Talk como
 * control continuo, no un trámite único al abrir el PTW — un trabajo que
 * dura varios días necesita su propio control cada día. Fase 3
 * (Verificaciones) sigue siendo la verificación inicial que habilita
 * avanzar a Formalización; este registro es el control del día a día
 * durante Fase 5 (Ejecución), donde vive el trabajo real de campo.
 */
export interface PtwDailyLog {
  id: number;
  fecha: string;
  registradoPorNombre: string;
  toolboxTalkRealizado: boolean;
  lotoVerificado: boolean;
  gasReadings: PtwGasReading[];
  observaciones?: string;
}

export function ptwDailyLogSeguro(log: Pick<PtwDailyLog, 'gasReadings'>): boolean {
  return log.gasReadings.every(r => r.seguro);
}

/** true si hoy (fecha local) todavía no tiene un registro de control diario — para avisar que falta el de hoy, no para bloquear nada. */
export function ptwControlDeHoyPendiente(logs: PtwDailyLog[], ahora = new Date()): boolean {
  const hoy = ahora.toDateString();
  return !logs.some(l => new Date(l.fecha).toDateString() === hoy);
}

/** DYN-SGI-RE-087 no aplica acá — HSE-SITIO-001 no tiene formato propio generado por el sistema (ver tabla de formatos del proceso). */
export interface PtwMatrix {
  id: number;
  code: string;
  fase: PtwFase;

  ordenTrabajo: string;
  actividad: string;
  ubicacion: string;

  /** A qué ticket operativo (Pumping/FCR) y pedido de Ventas corresponde este PTW — visible para que el usuario confirme la vinculación. */
  ticketTipo?: 'pumping' | 'fcr';
  ticketCode?: string;
  pedidoId?: number;
  pedidoCode?: string;

  /** Vínculo obligatorio con la Matriz IPERC aprobada que originó este PTW (HSE-PLAN-001 → HSE-SITIO-001). */
  ipercMatrixId: number;
  ipercCode: string;

  // Fase 1: Gabinete
  documentos: PtwDocumento[];

  // Fase 2: Ingreso
  toolboxTalkRealizado: boolean;
  walkaroundCompletado: boolean;
  lineaBaseAmbientalDocumentada: boolean;
  rutasEmergenciaVerificadas: boolean;
  simopsConfirmado: boolean;

  // Fase 3: Verificaciones
  gasReadings: PtwGasReading[];
  lotoChecklist: { label: string; checked: boolean }[];
  /**
   * HSE-SITIO-001, "Funcionalidades Requeridas": "Notificación al cliente
   * cuando se completa LOTO". Se dispara sola apenas el checklist queda
   * 100% marcado — no hay integración real de envío, así que esto solo
   * deja constancia de que la notificación (simulada) se disparó.
   */
  lotoNotificadoClienteAt?: string;

  // Fase 4: Formalización
  ptwFirmadoSitio?: PtwFirma;
  actaRecibimientoFirmada?: PtwFirma;
  barricadasInstaladas: boolean;

  // Fase 5: Ejecución y devolución
  limpiezaCompletada: boolean;
  inspeccionFinalConforme: boolean;
  /** Control diario mientras el trabajo dura varios días — ver PtwDailyLog. */
  dailyLogs: PtwDailyLog[];

  // Fase 6: Gestión documental final
  ptwCerrado?: PtwFirma;
  actaDevolucionFirmada?: PtwFirma;
  /**
   * HSE-SITIO-001: "Envío automático de respaldos a stakeholders" — ya no
   * es un botón manual. Se dispara solo apenas quedan las dos firmas de
   * cierre (ptwCerrado + actaDevolucionFirmada), simulando el envío a HSE
   * Base + Operaciones + Facturación.
   */
  respaldosEnviados: boolean;

  createdAt: string;
  updatedAt: string;
}

/**
 * "Servicio" del PTW — de dónde viene el trabajo (Pumping/FCR), no la
 * actividad IPERC anclada (que es genérica de toda la línea, ver
 * `qhse-domain.service.ts#asegurarPtwDeServicio`): el detalle real de qué
 * se va a usar en el trabajo lo da el Pedido de Ventas vinculado (ver
 * `VerPedidoDialog` desde `ptw-list-page`).
 */
export const PTW_TICKET_TIPO_LABELS: Record<'pumping' | 'fcr', string> = {
  pumping: 'Pumping',
  fcr: 'FCR',
};

export function ptwCerrado(p: PtwMatrix): boolean {
  return !!(p.ptwCerrado && p.actaDevolucionFirmada && p.respaldosEnviados);
}

export const DEFAULT_LOTO_CHECKLIST = [
  { label: 'Válvulas bloqueadas con candado', checked: false },
  { label: 'Etiquetas "NO OPERAR" visibles', checked: false },
  { label: 'Líneas despresorizadas', checked: false },
  { label: 'Prueba de cero energía realizada', checked: false },
];
