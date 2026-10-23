/**
 * Investigación de incidentes y casi accidentes (DYN-SGI-RE-034, HSE-TRIAGE-002) del contenedor `qhse` (`/api/v2/qhse/investigaciones`). El formato
 * se llena por secciones (trabajador, información del incidente, equipo, testigos, entorno, 5 Porqués, Ishikawa, causas, acciones) mientras la
 * investigación está abierta o en investigación; el Gerente HSE revisa el informe y la cierra. 5 Porqués, causas y acciones son FILAS. Los plazos
 * (inicio y informe final) los calcula el backend con el catálogo de resultados. Los ids son UUID (texto).
 */

export const PERMISO_INVESTIGACIONES_VER = 'qhse.investigaciones.ver';
export const PERMISO_INVESTIGACIONES_GESTIONAR = 'qhse.investigaciones.gestionar';
/** Aprobar el informe y cerrar (o devolverlo): solo el Gerente HSE. */
export const PERMISO_INVESTIGACIONES_APROBAR = 'qhse.investigaciones.aprobar';

export type EstadoInvestigacion = 'abierta' | 'en_investigacion' | 'en_revision' | 'cerrada';
export const ESTADO_INVESTIGACION_ETIQUETA: Record<EstadoInvestigacion, string> = {
  abierta: 'Sin iniciar',
  en_investigacion: 'En investigación',
  en_revision: 'En revisión',
  cerrada: 'Cerrada',
};
export const ESTADOS_INVESTIGACION: EstadoInvestigacion[] = [
  'abierta',
  'en_investigacion',
  'en_revision',
  'cerrada',
];

export type TonoInvestigacion = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';
export const ESTADO_INVESTIGACION_TONO: Record<EstadoInvestigacion, TonoInvestigacion> = {
  abierta: 'warning',
  en_investigacion: 'brand',
  en_revision: 'info',
  cerrada: 'success',
};

export interface ResultadoIncidente {
  id: string;
  codigo: string;
  nombre: string;
  inicioHoras: number;
  preliminarHoras: number | null;
  finalDias: number;
  /** El documento no tabula el plazo de este resultado: se usa el de «leve». */
  plazoSupuesto: boolean;
  involucraLesionado: boolean;
  sugiereNotificacionLegal: boolean;
}

export interface CategoriaIshikawa {
  id: string;
  codigo: string;
  nombre: string;
}

export interface PlazosInvestigacion {
  inicioLimite: string;
  inicioVencido: boolean;
  preliminarLimite: string | null;
  finalLimite: string;
  finalVencido: boolean;
}

export interface InvestigacionResumen {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoInvestigacion;
  resultado: {
    id: string;
    codigo: string;
    nombre: string;
    involucraLesionado: boolean;
    sugiereNotificacionLegal: boolean;
    plazoSupuesto: boolean;
  };
  fechaIncidente: string;
  ubicacion: string;
  lider: { id: string; nombre: string } | null;
  escenaAseguradaAt: string | null;
  plazos: PlazosInvestigacion;
}

/** Una fila de la bandeja: el resumen más las acciones que siguen pendientes. */
export interface InvestigacionFila extends InvestigacionResumen {
  accionesPendientes: number;
}

export interface BandejaInvestigaciones {
  items: InvestigacionFila[];
  kpi: { total: number; abiertas: number; conPlazoVencido: number; accionesPendientes: number };
}

export type Sexo = 'masculino' | 'femenino';
export type JornadaSuceso = 'ordinaria' | 'extra' | 'suplementaria';
export type ZonaIncidente = 'rural' | 'urbana';

export interface TrabajadorInvolucrado {
  usuarioId: string | null;
  apellidosNombres: string | null;
  cedula: string | null;
  cargo: string | null;
  direccion: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  sexo: Sexo | null;
  fechaIngreso: string | null;
  tipoVinculacion: string | null;
  oficioDesempenaba: string | null;
  jornadaHabitual: string | null;
  tiempoExperienciaMeses: number | null;
}

/** «Información sobre el incidente o accidente»: la fecha y la hora de ocurrencia son las del incidente. */
export interface InformacionIncidente {
  jornadaSuceso: JornadaSuceso | null;
  empresaDondeOcurrio: string | null;
  direccionOcurrencia: string | null;
  zona: ZonaIncidente | null;
  oficioEraPropioDelCargo: boolean | null;
  /** Hora como la guarda el backend (ISO con fecha ficticia); se muestra como HH:mm. */
  horaInicioJornada: string | null;
  tiempoLaboradoPrevioHoras: string | number | null;
  seInformoOportunamente: boolean | null;
  tiempoAtencionMedica: string | null;
  centroMedico: string | null;
  causoMuerte: boolean;
  fechaMuerte: string | null;
  parteCuerpoAfectada: string | null;
  tipoLesionSufrida: string | null;
  factorQueOrigino: string | null;
  totalDiasIncapacidad: number | null;
  continuaIncapacitado: boolean | null;
  sucesosSimilaresPrevios: boolean | null;
  sucesosSimilaresDetalle: string | null;
  danosMateriales: string | null;
  totalPerdidasEconomicas: string | number | null;
  danosMedioAmbiente: string | null;
}

export interface MiembroEquipo {
  id: string;
  usuarioId: string | null;
  nombre: string | null;
}
export interface Testigo {
  orden: number;
  nombresApellidos: string;
  cedula: string | null;
  version: string;
}
export interface FactorEntorno {
  orden: number;
  tipo: string;
  fuente: string;
  existeControl: boolean;
  contribuyoAlSuceso: boolean;
}
export interface Porque {
  orden: number;
  pregunta: string;
  respuesta: string;
}
export interface CausaIshikawa {
  orden: number;
  categoriaId: string;
  categoria: string;
  descripcion: string;
}

export type TipoCausa =
  'acto_inseguro' | 'condicion_insegura' | 'factor_personal' | 'factor_trabajo' | 'fuente_gestion';
export const TIPO_CAUSA_ETIQUETA: Record<TipoCausa, string> = {
  acto_inseguro: 'Actos inseguros',
  condicion_insegura: 'Condiciones inseguras',
  factor_personal: 'Factores personales',
  factor_trabajo: 'Factores de trabajo',
  fuente_gestion: 'Causas fuente o de gestión',
};
export const TIPOS_CAUSA: TipoCausa[] = [
  'acto_inseguro',
  'condicion_insegura',
  'factor_personal',
  'factor_trabajo',
  'fuente_gestion',
];
export interface CausaFormato {
  tipo: TipoCausa;
  orden: number;
  descripcion: string;
}

export type TipoAccion = 'correctiva' | 'preventiva';
export const TIPO_ACCION_ETIQUETA: Record<TipoAccion, string> = {
  correctiva: 'Correctiva — elimina la causa raíz específica',
  preventiva: 'Preventiva — evita que ocurra en otros contextos similares',
};
export type EstadoAccion = 'pendiente' | 'implementada' | 'verificada' | 'cancelada';
export const ESTADO_ACCION_ETIQUETA: Record<EstadoAccion, string> = {
  pendiente: 'Pendiente',
  implementada: 'Implementada',
  verificada: 'Verificada',
  cancelada: 'Cancelada',
};
/** P/D · F · M · T del formato: a qué nivel de la jerarquía de control aplica la medida. */
export type NivelControl = 'planeacion_diseno' | 'fuente' | 'medio' | 'trabajador';
export const NIVEL_CONTROL_ETIQUETA: Record<NivelControl, string> = {
  planeacion_diseno: 'P/D',
  fuente: 'Fuente',
  medio: 'Medio',
  trabajador: 'Trabajador',
};
export const NIVELES_CONTROL: NivelControl[] = [
  'planeacion_diseno',
  'fuente',
  'medio',
  'trabajador',
];

export interface AccionInvestigacion {
  id: string;
  orden: number;
  descripcion: string;
  tipo: TipoAccion;
  estado: EstadoAccion;
  responsable: { id: string; nombre: string | null };
  plazo: string;
  /** Pendiente con el plazo cumplido. */
  vencida: boolean;
  controles: NivelControl[];
  implementadaAt: string | null;
  /** El formato indica verificar la eficacia tres meses después de implementar (informativo). */
  verificableDesde: string | null;
  fueEficaz: boolean | null;
  verificacionObservacion: string | null;
  verificadaAt: string | null;
  canceladaAt: string | null;
  cancelacionMotivo: string | null;
}

export type Conclusion = 'incidente' | 'accidente';
export const CONCLUSION_ETIQUETA: Record<Conclusion, string> = {
  incidente: 'Incidente — finaliza investigación, seguimiento de planes de acción',
  accidente: 'Accidente — continuar con el reporte al IESS',
};

export interface NotificacionLegal {
  sugerida: boolean;
  requerida: boolean;
  ministerioTrabajoNotificadoAt: string | null;
  iessNotificadoAt: string | null;
}

export interface HistorialInvestigacion {
  id: string;
  estadoAnterior: EstadoInvestigacion | null;
  estadoNuevo: EstadoInvestigacion;
  observacion: string | null;
  actor: string;
  at: string;
}

export interface InvestigacionDetalle extends InvestigacionResumen {
  descripcionEvento: string;
  origenEmergenciaId: string | null;
  creadoPor: string | null;
  createdAt: string;
  conclusion: Conclusion | null;
  leccionesAprendidas: string | null;
  /** Lección aprendida: solo el vínculo con la actividad de la matriz IPERC (no cambia el estado de la matriz). */
  ipercActividad: { id: string; nombre: string } | null;
  notificacionLegal: NotificacionLegal;
  revisionEnviadaAt: string | null;
  revisionEnviadaPor: string | null;
  cerradaAt: string | null;
  cerradaPor: string | null;
  /** Lo que falta para avanzar, ya explicado por el backend. */
  cierre: { pendientesParaRevision: string[]; pendientesParaCierre: string[] };
  evidenciasRecopiladas: string | null;
  testimoniosResumen: string | null;
  trabajador: TrabajadorInvolucrado | null;
  incidente: InformacionIncidente | null;
  equipo: MiembroEquipo[];
  testigos: Testigo[];
  entorno: FactorEntorno[];
  porques: Porque[];
  ishikawa: CausaIshikawa[];
  causas: CausaFormato[];
  acciones: AccionInvestigacion[];
  historial: HistorialInvestigacion[];
}

export interface AbrirInvestigacion {
  resultadoId: string;
  descripcionEvento: string;
  /** ISO */
  fechaIncidente: string;
  ubicacion: string;
  origenEmergenciaId?: string;
}

/** La investigación todavía se puede llenar (el backend y la base lo exigen también). */
export function esEditable(estado: EstadoInvestigacion): boolean {
  return estado === 'abierta' || estado === 'en_investigacion';
}

/** Hora «HH:mm» de la hora que guarda el backend (`1970-01-01T06:30:00.000Z`), o vacío. */
export function horaDeBackend(hora: string | null | undefined): string {
  return hora && hora.length >= 16 ? hora.slice(11, 16) : '';
}

/** Día «AAAA-MM-DD» de una fecha ISO, o vacío. */
export function diaDeIso(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

/** Número guardado como texto o número (los decimales llegan como texto), o vacío. */
export function numeroATexto(n: string | number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n);
}

/** Texto a número entero no negativo, `undefined` si está vacío y `null` si no es válido. */
export function enteroNoNegativo(texto: string): number | undefined | null {
  const t = texto.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Texto a decimal no negativo, `undefined` si está vacío y `null` si no es válido. */
export function decimalNoNegativo(texto: string): number | undefined | null {
  const t = texto.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Causas de un tipo, en su orden. */
export function causasDe(causas: CausaFormato[], tipo: TipoCausa): CausaFormato[] {
  return causas.filter((c) => c.tipo === tipo).sort((a, b) => a.orden - b.orden);
}

/** Días restantes hasta el informe final (0 si ya venció); `null` si la investigación ya está cerrada. */
export function diasParaInformeFinal(
  i: Pick<InvestigacionResumen, 'estado' | 'plazos'>,
  ahora: Date = new Date(),
): number | null {
  if (i.estado === 'cerrada') return null;
  const ms = new Date(i.plazos.finalLimite).getTime() - ahora.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** Texto del plazo de una tarjeta de la bandeja. */
export function textoDePlazo(
  i: Pick<InvestigacionResumen, 'estado' | 'plazos'>,
  ahora: Date = new Date(),
): string {
  if (i.estado === 'cerrada') return 'Cerrada';
  if (i.plazos.finalVencido || (i.estado === 'abierta' && i.plazos.inicioVencido))
    return 'Plazo vencido';
  return `${diasParaInformeFinal(i, ahora)} días restantes`;
}

/** Una investigación con algún plazo vencido y sin cerrar. */
export function conPlazoVencido(i: Pick<InvestigacionResumen, 'estado' | 'plazos'>): boolean {
  return (
    i.estado !== 'cerrada' &&
    (i.plazos.finalVencido || (i.estado === 'abierta' && i.plazos.inicioVencido))
  );
}
