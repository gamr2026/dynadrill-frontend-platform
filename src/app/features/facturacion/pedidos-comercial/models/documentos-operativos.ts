/** Documentos operativos del pedido (`/api/comercial/pedidos/:id/documentos-operativos`). Los envía Operaciones. */

export const PERMISOS_DOCUMENTOS_OPERATIVOS = {
  ver: 'comercial.documentos_operativos.ver',
  eliminar: 'comercial.documentos_operativos.eliminar',
  corregir: 'comercial.documentos_operativos.corregir',
} as const;

export type TipoDocumentoOperativo = 'reporte_job' | 'reporte_herramientas';
export type OrigenDocumentoOperativo = 'fcr' | 'pumping';
export type EstadoUsoHerramienta = 'operacion' | 'stand_by' | 'daily_charge' | 'venta';

export interface PersonaRef {
  id: string;
  nombre: string;
}

export interface ActividadOperativa {
  orden: number;
  fecha: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  duracionHoras: number | null;
  detalle: string | null;
  autor: string | null;
  tablas?: { titulo: string | null; columnas: string[]; filas: string[][] }[];
}

export interface UsoHerramienta {
  fecha: string;
  estado: EstadoUsoHerramienta;
}

export interface HerramientaOperativa {
  orden: number;
  nombre: string;
  serie: string | null;
  codigo: string | null;
  usos: UsoHerramienta[];
}

export interface DocumentoOperativo {
  id: string;
  tipo: TipoDocumentoOperativo;
  origen: OrigenDocumentoOperativo;
  ticketRef: string | null;
  fecha: string | null;
  firmadoPor: string | null;
  firmadoAt: string | null;
  supervisor: PersonaRef | null;
  operador: PersonaRef | null;
  recibidoAt: string;
  actividades: ActividadOperativa[];
  herramientas: HerramientaOperativa[];
}

/** Una actividad del día que se corrige (`PUT documentos-operativos/dia`). */
export interface ActividadCorreccion {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  duracionHoras: number;
  detalle: string;
  autor?: string;
  tablas?: { titulo?: string; columnas: string[]; filas: string[][] }[];
}

export interface CorregirDiaEntrada {
  origen: OrigenDocumentoOperativo;
  fecha: string;
  /** Lista vacía = quitar el día. */
  actividades: ActividadCorreccion[];
}

export interface AvanceDocumental {
  completo: boolean;
  diasEsperados: number;
  diasConReporteJob: number;
  reporteHerramientasRequerido: boolean;
  reporteHerramientasRecibido: boolean;
  usoVenta: boolean;
  guiaRequerida: boolean;
  guiaRegistrada: boolean;
  /** Ya viene en español: se muestra tal cual. */
  pendientes: string[];
}

export const ESTADO_USO_LABELS: Record<EstadoUsoHerramienta, string> = {
  operacion: 'Operación',
  stand_by: 'Stand by',
  daily_charge: 'Cargo diario',
  venta: 'Venta',
};

export const ORIGEN_DOCUMENTO_LABELS: Record<OrigenDocumentoOperativo, string> = {
  fcr: 'FCR',
  pumping: 'Pumping',
};

export const etiquetaUso = (estado: string): string =>
  (ESTADO_USO_LABELS as Record<string, string>)[estado] ?? estado;

export const etiquetaOrigen = (origen: string): string =>
  (ORIGEN_DOCUMENTO_LABELS as Record<string, string>)[origen] ?? origen.toUpperCase();

/** Horas totales de las actividades (suma de `duracionHoras`, a dos decimales). */
export function horasTotales(
  actividades: readonly Pick<ActividadOperativa, 'duracionHoras'>[],
): number {
  return Math.round(actividades.reduce((a, x) => a + (x.duracionHoras ?? 0), 0) * 100) / 100;
}

/** "8,5 h" (coma decimal). */
export function formatoHoras(horas: number): string {
  return `${String(horas).replace('.', ',')} h`;
}

/** Herramientas sin código: no se facturarán. */
export function herramientasSinCodigo(
  herramientas: readonly Pick<HerramientaOperativa, 'codigo'>[],
): number {
  return herramientas.filter((h) => !h.codigo?.trim()).length;
}

/** Porcentaje (0-100) de días con Reporte Job sobre los esperados. */
export function porcentajeReporteJob(
  avance: Pick<AvanceDocumental, 'diasConReporteJob' | 'diasEsperados'>,
): number {
  if (avance.diasEsperados <= 0) return avance.diasConReporteJob > 0 ? 100 : 0;
  return Math.min(100, Math.round((avance.diasConReporteJob / avance.diasEsperados) * 100));
}

export interface PuntoChequeo {
  texto: string;
  /** `ok` cumplido, `pendiente` falta, `na` no aplica. */
  estado: 'ok' | 'pendiente' | 'na';
}

/** Lista de chequeo del avance documental. */
export function listaDeChequeo(a: AvanceDocumental): PuntoChequeo[] {
  const job: PuntoChequeo = {
    texto: `Reporte Job: ${a.diasConReporteJob} de ${a.diasEsperados} día(s)`,
    estado: a.diasEsperados > 0 && a.diasConReporteJob >= a.diasEsperados ? 'ok' : 'pendiente',
  };
  const htas: PuntoChequeo = !a.reporteHerramientasRequerido
    ? { texto: 'Reporte de Herramientas: no se requiere', estado: 'na' }
    : {
        texto: a.reporteHerramientasRecibido
          ? 'Reporte de Herramientas: recibido'
          : 'Reporte de Herramientas: pendiente',
        estado: a.reporteHerramientasRecibido ? 'ok' : 'pendiente',
      };
  const lista = [job, htas];
  if (a.guiaRequerida) {
    lista.push({
      texto: a.guiaRegistrada ? 'Guía de remisión: registrada' : 'Guía de remisión: pendiente',
      estado: a.guiaRegistrada ? 'ok' : 'pendiente',
    });
  }
  return lista;
}

/** Ordena los Reportes Job por fecha (los sin fecha al final). */
export function reportesJobOrdenados(docs: readonly DocumentoOperativo[]): DocumentoOperativo[] {
  return docs
    .filter((d) => d.tipo === 'reporte_job')
    .sort((a, b) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999'));
}

export function reportesHerramientas(docs: readonly DocumentoOperativo[]): DocumentoOperativo[] {
  return docs.filter((d) => d.tipo === 'reporte_herramientas');
}
