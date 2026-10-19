/**
 * Matriz IPERC maestra (DYN-SGI-RE-087, GTC 45) del contenedor `qhse` (`/api/v2/qhse/iperc`). No es una matriz por pedido: cada ACTIVIDAD
 * tiene la suya, que se aprueba cada año (vigencia de 12 meses); editar una aprobada crea una versión nueva que debe aprobarse otra vez
 * mientras sigue valiendo la anterior. El PTW de un pedido exige las matrices aprobadas y vigentes de las actividades que cubren sus tipos
 * de servicio (la «cobertura»). Los ids son UUID (texto).
 */

export const PERMISO_IPERC_VER = 'qhse.iperc.ver';
export const PERMISO_IPERC_GESTIONAR = 'qhse.iperc.gestionar';
export const PERMISO_IPERC_APROBAR = 'qhse.iperc.aprobar';

/** Módulo del servicio de archivos por el que se suben el procedimiento y el ATS base. */
export const MODULO_ARCHIVO_IPERC = 'qhse_iperc_documento';

export type EstadoIperc =
  'borrador' | 'en_evaluacion' | 'en_revision' | 'aprobada' | 'rechazada' | 'reemplazada';

export const ESTADO_IPERC_ETIQUETA: Record<EstadoIperc, string> = {
  borrador: 'Borrador',
  en_evaluacion: 'En evaluación',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  reemplazada: 'Reemplazada',
};

export type TonoIperc = 'success' | 'warning' | 'error' | 'neutral' | 'brand';

export const ESTADO_IPERC_TONO: Record<EstadoIperc, TonoIperc> = {
  borrador: 'neutral',
  en_evaluacion: 'warning',
  en_revision: 'brand',
  aprobada: 'success',
  rechazada: 'error',
  reemplazada: 'neutral',
};

export type TipoControl = 'eliminacion' | 'sustitucion' | 'ingenieria' | 'administrativo' | 'epp';
export type MomentoControl = 'propuesto' | 'residual';

export const TIPO_CONTROL_ETIQUETA: Record<TipoControl, string> = {
  eliminacion: 'Eliminación',
  sustitucion: 'Sustitución',
  ingenieria: 'Control de ingeniería',
  administrativo: 'Señalización, advertencias, controles administrativos',
  epp: 'Equipos / elementos de protección personal',
};
export const TIPOS_CONTROL: TipoControl[] = [
  'eliminacion',
  'sustitucion',
  'ingenieria',
  'administrativo',
  'epp',
];

export const MOMENTO_CONTROL_ETIQUETA: Record<MomentoControl, string> = {
  propuesto: 'Medida de intervención',
  residual: 'Control con el que queda el riesgo residual',
};

// ----------------------------------------------------------------------------------------------------- GTC 45

export interface OpcionGtc {
  valor: number;
  label: string;
  descripcion: string;
}

/** Niveles oficiales de la norma (los mismos valores que acepta la base de datos). */
export const ND_OPCIONES: OpcionGtc[] = [
  {
    valor: 10,
    label: 'Muy alto',
    descripcion:
      'Peligros que hacen posible incidentes o consecuencias muy significativas, o medidas preventivas nulas o inexistentes.',
  },
  {
    valor: 6,
    label: 'Alto',
    descripcion:
      'Peligros que pueden dar lugar a consecuencias significativas, o medidas preventivas de baja eficacia.',
  },
  {
    valor: 2,
    label: 'Medio',
    descripcion:
      'Peligros con consecuencias poco significativas, o medidas preventivas de eficacia moderada.',
  },
  {
    valor: 0,
    label: 'Bajo — riesgo controlado',
    descripcion:
      'Sin consecuencia detectada o medidas preventivas de alta eficacia: el riesgo está controlado.',
  },
];
export const NE_OPCIONES: OpcionGtc[] = [
  {
    valor: 4,
    label: 'Continua',
    descripcion: 'Sin interrupción, o varias veces y por tiempo prolongado durante la jornada.',
  },
  {
    valor: 3,
    label: 'Frecuente',
    descripcion: 'Varias veces durante la jornada, por tiempos cortos.',
  },
  {
    valor: 2,
    label: 'Ocasional',
    descripcion: 'Alguna vez durante la jornada y por un tiempo corto.',
  },
  { valor: 1, label: 'Esporádica', descripcion: 'De manera eventual.' },
];
export const NC_OPCIONES: OpcionGtc[] = [
  { valor: 100, label: 'Mortal / catastrófico', descripcion: 'Muerte(s).' },
  {
    valor: 60,
    label: 'Muy grave',
    descripcion:
      'Lesiones o enfermedades graves irreparables (incapacidad permanente parcial o invalidez).',
  },
  {
    valor: 25,
    label: 'Grave',
    descripcion: 'Lesiones o enfermedades con incapacidad laboral temporal.',
  },
  {
    valor: 10,
    label: 'Leve',
    descripcion: 'Lesiones o enfermedades que no requieren incapacidad.',
  },
];

export type NivelRiesgo = 'I' | 'II' | 'III' | 'IV';
export type NivelProbabilidad = 'bajo' | 'medio' | 'alto' | 'muy_alto';

export interface ValoracionCalculada {
  nd: number;
  ne: number;
  nc: number;
  np: number;
  probabilidad: NivelProbabilidad;
  nr: number;
  nivel: NivelRiesgo;
  aceptabilidad: string;
}

/** Los tres ejes elegidos en pantalla; `null` mientras falte alguno. */
export interface Ejes {
  nd: number | null;
  ne: number | null;
  nc: number | null;
}

/** Misma cuenta que el servidor (NP = ND×NE y NR = NP×NC); sirve para la vista previa mientras se evalúa. */
export function valorar(e: Ejes): ValoracionCalculada | null {
  if (e.nd === null || e.ne === null || e.nc === null) return null;
  const np = e.nd * e.ne;
  const nr = np * e.nc;
  const probabilidad: NivelProbabilidad =
    np >= 24 ? 'muy_alto' : np >= 10 ? 'alto' : np >= 6 ? 'medio' : 'bajo';
  const riesgo: { nivel: NivelRiesgo; aceptabilidad: string } =
    nr >= 600
      ? { nivel: 'I', aceptabilidad: 'No aceptable' }
      : nr >= 150
        ? { nivel: 'II', aceptabilidad: 'No aceptable o aceptable con control específico' }
        : nr >= 40
          ? { nivel: 'III', aceptabilidad: 'Mejorable' }
          : { nivel: 'IV', aceptabilidad: 'Aceptable' };
  return { nd: e.nd, ne: e.ne, nc: e.nc, np, probabilidad, nr, ...riesgo };
}

export const NIVEL_RIESGO_TONO: Record<NivelRiesgo, TonoIperc> = {
  I: 'error',
  II: 'error',
  III: 'warning',
  IV: 'success',
};

// ------------------------------------------------------------------------------------------- respuesta del servidor

export interface ElementoCatalogo {
  id: string;
  codigo?: string;
  nombre: string;
}

export interface CatalogosIperc {
  procesos: ElementoCatalogo[];
  zonas: ElementoCatalogo[];
  clasificaciones: ElementoCatalogo[];
  generadoEn: ElementoCatalogo[];
  cargos: ElementoCatalogo[];
}
export type TipoCatalogo = 'proceso' | 'zona' | 'clasificacion' | 'generado_en' | 'cargo';

export interface ActividadResumen {
  id: string;
  nombre: string;
  activo: boolean;
  proceso: ElementoCatalogo;
  zona: ElementoCatalogo;
  tiposServicio: string[];
  aprobada: {
    matrizId: string;
    codigo: string;
    version: number;
    aprobadaEl: string | null;
    vigenteHasta: string | null;
    venceEnDias: number | null;
    vencida: boolean;
    porVencer: boolean;
  } | null;
  enTrabajo: { matrizId: string; codigo: string; version: number; estado: EstadoIperc } | null;
}

export interface ControlMatriz {
  id: string;
  momento: MomentoControl;
  tipo: TipoControl;
  descripcion: string;
}

export interface PeligroMatriz {
  id: string;
  orden: number;
  descripcion: string;
  clasificacion: ElementoCatalogo;
  fuenteRiesgo: string | null;
  generadoEn: ElementoCatalogo | null;
  efectosPosibles: string | null;
  controlExistenteFuente: string | null;
  controlExistenteMedio: string | null;
  controlExistenteIndividuo: string | null;
  numeroExpuestos: number | null;
  peorConsecuencia: string | null;
  requisitoLegal: boolean;
  seguimiento: string | null;
  seguimientoResidual: string | null;
  inicial: ValoracionCalculada | null;
  residual: ValoracionCalculada | null;
  controles: ControlMatriz[];
}

export interface TareaMatriz {
  id: string;
  orden: number;
  descripcion: string;
  rutinaria: boolean;
  areaPuesto: string | null;
  cargos: ElementoCatalogo[];
  peligros: PeligroMatriz[];
}

export interface MatrizDetalle {
  id: string;
  numero: number;
  codigo: string;
  version: number;
  estado: EstadoIperc;
  actividad: { id: string; nombre: string; proceso: ElementoCatalogo; zona: ElementoCatalogo };
  equipoEvaluador: ElementoCatalogo[];
  procedimientoArchivoId: string | null;
  atsArchivoId: string | null;
  aprobadaPor: string | null;
  aprobadaAt: string | null;
  aprobadaEl: string | null;
  vigenteHasta: string | null;
  venceEnDias: number | null;
  vencida: boolean;
  porVencer: boolean;
  rechazadaPor: string | null;
  rechazadaAt: string | null;
  motivoRechazo: string | null;
  creadaPor: string;
  tareas: TareaMatriz[];
  historial: {
    estadoAnterior: EstadoIperc | null;
    estadoNuevo: EstadoIperc;
    motivo: string | null;
    actor: string;
    at: string;
  }[];
}

export type MapaCobertura = Record<string, { id: string; nombre: string }[]>;

// ------------------------------------------------------------------------------- borrador editable (lo que se guarda)

export interface ControlBorrador {
  momento: MomentoControl;
  tipo: TipoControl;
  descripcion: string;
}

export interface PeligroBorrador {
  descripcion: string;
  clasificacionId: string;
  generadoEnId: string;
  fuenteRiesgo: string;
  efectosPosibles: string;
  controlExistenteFuente: string;
  controlExistenteMedio: string;
  controlExistenteIndividuo: string;
  numeroExpuestos: number | null;
  peorConsecuencia: string;
  requisitoLegal: boolean;
  seguimiento: string;
  seguimientoResidual: string;
  inicial: Ejes;
  residual: Ejes;
  controles: ControlBorrador[];
}

export interface TareaBorrador {
  descripcion: string;
  rutinaria: boolean;
  areaPuesto: string;
  cargoIds: string[];
  peligros: PeligroBorrador[];
}

export interface ContenidoBorrador {
  tareas: TareaBorrador[];
  evaluadorIds: string[];
}

const ejes = (v: ValoracionCalculada | null): Ejes => ({
  nd: v?.nd ?? null,
  ne: v?.ne ?? null,
  nc: v?.nc ?? null,
});

export const EJES_VACIOS: Ejes = { nd: null, ne: null, nc: null };

export function peligroVacio(clasificacionId = ''): PeligroBorrador {
  return {
    descripcion: '',
    clasificacionId,
    generadoEnId: '',
    fuenteRiesgo: '',
    efectosPosibles: '',
    controlExistenteFuente: '',
    controlExistenteMedio: '',
    controlExistenteIndividuo: '',
    numeroExpuestos: null,
    peorConsecuencia: '',
    requisitoLegal: false,
    seguimiento: '',
    seguimientoResidual: '',
    inicial: { ...EJES_VACIOS },
    residual: { ...EJES_VACIOS },
    controles: [],
  };
}

export function tareaVacia(clasificacionId = ''): TareaBorrador {
  return {
    descripcion: '',
    rutinaria: true,
    areaPuesto: '',
    cargoIds: [],
    peligros: [peligroVacio(clasificacionId)],
  };
}

/** La matriz del servidor convertida en algo que se puede editar campo por campo. */
export function aBorrador(m: MatrizDetalle): ContenidoBorrador {
  return {
    evaluadorIds: m.equipoEvaluador.map((e) => e.id),
    tareas: m.tareas.map((t) => ({
      descripcion: t.descripcion,
      rutinaria: t.rutinaria,
      areaPuesto: t.areaPuesto ?? '',
      cargoIds: t.cargos.map((c) => c.id),
      peligros: t.peligros.map((p) => ({
        descripcion: p.descripcion,
        clasificacionId: p.clasificacion.id,
        generadoEnId: p.generadoEn?.id ?? '',
        fuenteRiesgo: p.fuenteRiesgo ?? '',
        efectosPosibles: p.efectosPosibles ?? '',
        controlExistenteFuente: p.controlExistenteFuente ?? '',
        controlExistenteMedio: p.controlExistenteMedio ?? '',
        controlExistenteIndividuo: p.controlExistenteIndividuo ?? '',
        numeroExpuestos: p.numeroExpuestos,
        peorConsecuencia: p.peorConsecuencia ?? '',
        requisitoLegal: p.requisitoLegal,
        seguimiento: p.seguimiento ?? '',
        seguimientoResidual: p.seguimientoResidual ?? '',
        inicial: ejes(p.inicial),
        residual: ejes(p.residual),
        controles: p.controles.map((c) => ({
          momento: c.momento,
          tipo: c.tipo,
          descripcion: c.descripcion,
        })),
      })),
    })),
  };
}

const opcional = (t: string): string | undefined => (t.trim() ? t.trim() : undefined);
const completa = (e: Ejes): { nd: number; ne: number; nc: number } | undefined =>
  e.nd !== null && e.ne !== null && e.nc !== null ? { nd: e.nd, ne: e.ne, nc: e.nc } : undefined;

/** El cuerpo de `PUT matrices/:id/contenido`: los textos vacíos no se envían y una valoración a medias se descarta. */
export function aContenidoDto(b: ContenidoBorrador): Record<string, unknown> {
  return {
    evaluadorIds: b.evaluadorIds,
    tareas: b.tareas.map((t) => ({
      descripcion: t.descripcion.trim(),
      rutinaria: t.rutinaria,
      areaPuesto: opcional(t.areaPuesto),
      cargoIds: t.cargoIds,
      peligros: t.peligros.map((p) => ({
        descripcion: p.descripcion.trim(),
        clasificacionId: p.clasificacionId,
        generadoEnId: p.generadoEnId || undefined,
        fuenteRiesgo: opcional(p.fuenteRiesgo),
        efectosPosibles: opcional(p.efectosPosibles),
        controlExistenteFuente: opcional(p.controlExistenteFuente),
        controlExistenteMedio: opcional(p.controlExistenteMedio),
        controlExistenteIndividuo: opcional(p.controlExistenteIndividuo),
        numeroExpuestos: p.numeroExpuestos ?? undefined,
        peorConsecuencia: opcional(p.peorConsecuencia),
        requisitoLegal: p.requisitoLegal,
        seguimiento: opcional(p.seguimiento),
        seguimientoResidual: opcional(p.seguimientoResidual),
        inicial: completa(p.inicial),
        residual: completa(p.residual),
        controles: p.controles
          .filter((c) => c.descripcion.trim())
          .map((c) => ({ ...c, descripcion: c.descripcion.trim() })),
      })),
    })),
  };
}

/** Lo que falta para poder guardar (la base y el servidor lo exigen igual); vacío = se puede guardar. */
export function pendientesDeGuardado(b: ContenidoBorrador): string[] {
  const falta: string[] = [];
  b.tareas.forEach((t, i) => {
    if (!t.descripcion.trim()) falta.push(`describir la tarea ${i + 1}`);
    t.peligros.forEach((p, j) => {
      if (!p.descripcion.trim()) falta.push(`describir el peligro ${j + 1} de la tarea ${i + 1}`);
      if (!p.clasificacionId) falta.push(`clasificar el peligro ${j + 1} de la tarea ${i + 1}`);
    });
  });
  return falta;
}

/** Lo que falta para enviar a revisión: tareas, peligros y la valoración inicial y residual completas. */
export function pendientesDeRevision(b: ContenidoBorrador): string[] {
  const falta: string[] = [];
  if (!b.tareas.length) return ['la matriz no tiene tareas'];
  b.tareas.forEach((t, i) => {
    if (!t.peligros.length) falta.push(`la tarea ${i + 1} no tiene peligros`);
    t.peligros.forEach((p, j) => {
      if (!valorar(p.inicial))
        falta.push(`valorar el riesgo inicial del peligro ${j + 1} de la tarea ${i + 1}`);
      if (!valorar(p.residual))
        falta.push(`valorar el riesgo residual del peligro ${j + 1} de la tarea ${i + 1}`);
    });
  });
  return falta;
}

/** Solo se edita el contenido con la matriz en borrador o en evaluación. */
export function esEditable(estado: EstadoIperc): boolean {
  return estado === 'borrador' || estado === 'en_evaluacion';
}

// ------------------------------------------------------------------------------------------------------ insignias

export interface InsigniaIperc {
  text: string;
  tone: TonoIperc;
}

/** Vigencia de la matriz aprobada de una actividad: sin matriz, vencida, por vencer (30 días antes) o vigente. */
export function insigniaVigencia(a: Pick<ActividadResumen, 'aprobada'>): InsigniaIperc {
  const ap = a.aprobada;
  if (!ap) return { text: 'Sin matriz aprobada', tone: 'warning' };
  if (ap.vencida) return { text: 'Vencida', tone: 'error' };
  if (ap.porVencer)
    return {
      text: `Vence en ${ap.venceEnDias} ${ap.venceEnDias === 1 ? 'día' : 'días'}`,
      tone: 'warning',
    };
  return { text: `Vigente (v${ap.version})`, tone: 'success' };
}

/** Nombre legible de un código de tipo de servicio cuando no se puede leer el catálogo de comercial. */
export function nombreDeCodigo(codigo: string): string {
  return codigo
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
