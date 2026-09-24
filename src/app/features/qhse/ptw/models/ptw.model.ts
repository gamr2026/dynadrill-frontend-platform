/**
 * Fases de HSE-SITIO-001 (Recibimiento de Sitio y Apertura de PTW):
 * Gabinete → Formalización → Gestión documental. Ya no pasa por un PTW
 * aprobado (ver `PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS.md`, Fase 1: la
 * Matriz IPERC es maestra/anual, no bloquea la apertura). `'ingreso'`,
 * `'verificaciones'` y `'ejecucion'` siguen siendo valores válidos del tipo
 * (compatibilidad con PTWs sembrados antes de este cambio) pero ya no
 * aparecen en `PTW_FASE_ORDER`/`PTW_FASE_STEPS`: "Ingreso a locación" +
 * "Verificaciones de seguridad" pasaron a ser propiedad de Pumping
 * (`ChecklistIngresoPumping`, ver ticket-detail-page de Pumping); "Ejecución
 * y devolución" (registro diario + cierre de campo) se retiró del todo a
 * pedido del negocio — el PTW pasa directo de Formalización a Gestión
 * documental.
 */
export type PtwFase = 'gabinete' | 'ingreso' | 'verificaciones' | 'formalizacion' | 'ejecucion' | 'gestion_documental';

export const PTW_FASE_ORDER: PtwFase[] = ['gabinete', 'formalizacion', 'gestion_documental'];

export const PTW_FASE_STEPS = ['Gabinete', 'Formalización', 'Gest. doc.'];

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

/** "Una línea": usuario + fecha, sin captura de firma manuscrita (decisiones del plan de desarrollo del módulo QHSE). */
export interface PtwFirma {
  nombre: string;
  firmadoAt: string;
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

  // "Ingreso a locación" + "Verificaciones de seguridad" ya no viven acá —
  // ver `ChecklistIngresoPumping` en el ticket de Pumping (Fase 2 del plan).

  // Fase 2: Formalización
  ptwFirmadoSitio?: PtwFirma;
  actaRecibimientoFirmada?: PtwFirma;
  barricadasInstaladas: boolean;

  // Fase 3: Gestión documental final
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
