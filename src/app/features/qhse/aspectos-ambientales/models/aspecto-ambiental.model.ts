/**
 * Matriz de Aspectos e Impactos Ambientales (MATRIZ DE ASPECTOS AMBIENTALES Rev00) del contenedor `qhse` (`/api/v2/qhse/aspectos-ambientales`): un
 * registro por aspecto o actividad evaluada, misma lógica que el IPERC (actividad → aspecto/impacto → valoración de riesgo → control →
 * seguimiento) pero para impacto ambiental y con probabilidad × consecuencia directo en vez de GTC-45. El nivel de riesgo lo calcula el
 * backend. Los ids son UUID (texto).
 */

export const PERMISO_ASPECTOS_VER = 'qhse.aspectos_ambientales.ver';
export const PERMISO_ASPECTOS_GESTIONAR = 'qhse.aspectos_ambientales.gestionar';

export type Clasificacion = 'bajo' | 'moderado' | 'alto';
export const CLASIFICACION_LABELS: Record<Clasificacion, string> = {
  bajo: 'Bajo',
  moderado: 'Moderado',
  alto: 'Alto',
};

export type CondicionOperacion = 'normal' | 'anormal' | 'emergencia';
export const CONDICION_OPERACION_LABELS: Record<CondicionOperacion, string> = {
  normal: 'Normal',
  anormal: 'Anormal',
  emergencia: 'Emergencia',
};

export type TipoResponsabilidad = 'directa' | 'indirecta';
export const TIPO_RESPONSABILIDAD_LABELS: Record<TipoResponsabilidad, string> = {
  directa: 'Directa',
  indirecta: 'Indirecta',
};

export type TipoImpacto = 'positivo' | 'negativo';
export const TIPO_IMPACTO_LABELS: Record<TipoImpacto, string> = {
  positivo: 'Positivo',
  negativo: 'Negativo',
};

export type EstadoControl = 'pendiente' | 'en_ejecucion' | 'implementado';
export const ESTADO_CONTROL_LABELS: Record<EstadoControl, string> = {
  pendiente: 'Pendiente',
  en_ejecucion: 'En ejecución',
  implementado: 'Implementado',
};

export type EstadoAspecto = 'vigente' | 'dado_de_baja';

export interface ItemCatalogo {
  id: string;
  codigo: string;
  nombre: string;
}

export interface CatalogosAspectos {
  etapas: ItemCatalogo[];
  factores: ItemCatalogo[];
  frecuencias: ItemCatalogo[];
  /** Procesos del catálogo del IPERC. */
  procesos: ItemCatalogo[];
  clasificaciones: Clasificacion[];
  condicionesOperacion: CondicionOperacion[];
  tiposResponsabilidad: TipoResponsabilidad[];
  tiposImpacto: TipoImpacto[];
  estadosControl: EstadoControl[];
}

export interface AspectoResumen {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoAspecto;
  fecha: string;
  etapa: { id: string; nombre: string };
  proceso: { id: string; nombre: string | null };
  actividad: string;
  aspecto: string;
  impacto: string;
  factor: { id: string; nombre: string } | null;
  probabilidad: number;
  consecuencia: number;
  /** Probabilidad × consecuencia, calculado por el backend. */
  nivelRiesgo: number;
  clasificacion: Clasificacion;
  estadoControl: EstadoControl;
  plazo: string | null;
  /** Control sin implementar con el plazo cumplido. */
  controlVencido: boolean;
}

export interface BandejaAspectos {
  items: AspectoResumen[];
  kpi: { total: number; bajo: number; moderado: number; alto: number; controlVencido: number };
}

export interface PersonaRef {
  id: string;
  nombre: string | null;
}

export interface RegistroSeguimientoAspecto {
  id: string;
  fecha: string;
  eficaz: boolean;
  observacion: string;
  registradoPor: string | null;
  registradoAt: string;
}

export interface AspectoDetalle extends AspectoResumen {
  produccionDelAspecto: string | null;
  riesgoGestion: string | null;
  condicionOperacion: CondicionOperacion | null;
  tipoResponsabilidad: TipoResponsabilidad | null;
  tipoImpacto: TipoImpacto | null;
  fechaValoracion: string | null;
  control: {
    ncar: string | null;
    planAccionExistente: string | null;
    planTratamiento: string | null;
    responsable: PersonaRef | null;
    presupuesto: number | null;
    plazo: string | null;
    estadoControl: EstadoControl;
  };
  seguimiento: {
    indicador: string | null;
    responsable: PersonaRef | null;
    frecuencia: { id: string; nombre: string } | null;
    registros: RegistroSeguimientoAspecto[];
    ultimaEficacia: boolean | null;
  };
  baja: { at: string; por: string | null; motivo: string | null } | null;
  creadoPor: string | null;
  createdAt: string;
}

export interface CrearAspecto {
  /** AAAA-MM-DD */
  fecha?: string;
  etapaId: string;
  procesoId: string;
  actividad: string;
  produccionDelAspecto?: string;
  riesgoGestion?: string;
  aspecto: string;
  impacto: string;
  factorId?: string;
  condicionOperacion?: CondicionOperacion;
  tipoResponsabilidad?: TipoResponsabilidad;
  tipoImpacto?: TipoImpacto;
  fechaValoracion?: string;
  probabilidad: number;
  consecuencia: number;
  clasificacion: Clasificacion;
  ncar?: string;
  planAccionExistente?: string;
  planTratamiento?: string;
  responsableId?: string;
  presupuesto?: number;
  plazo?: string;
  estadoControl?: EstadoControl;
  seguimientoIndicador?: string;
  seguimientoResponsableId?: string;
  seguimientoFrecuenciaId?: string;
}

/** Nivel de riesgo ambiental (probabilidad × consecuencia) para la vista previa del formulario; el backend lo calcula igual. */
export function nivelRiesgo(probabilidad: number, consecuencia: number): number {
  return probabilidad * consecuencia;
}

/** Entero de 1 a 5, o `null` si el texto no lo es (probabilidad y consecuencia). */
export function escala1a5(texto: string): number | null {
  const n = Number(texto);
  return texto.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Presupuesto en dólares: número no negativo con hasta 2 decimales, o `undefined` si está vacío; `null` si no es válido. */
export function presupuestoDeTexto(texto: string): number | undefined | null {
  const t = texto.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && Math.round(n * 100) === n * 100 ? n : null;
}
