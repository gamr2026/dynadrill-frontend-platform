/**
 * Emergencias / MEDEVAC (HSE-TRIAGE-001) del contenedor `qhse` (`/api/v2/qhse/emergencias`). Cualquier trabajador la activa (directa, o por
 * escalada desde una SWA o un derrame mayor); el equipo HSE declara el nivel, cuenta al personal, notifica en cascada, atiende a los heridos
 * (triage y MEDEVAC), emite el Reporte Flash, la marca como controlada y la cierra. Los ids son UUID (texto). La autoridad de las reglas es el
 * backend (y la base de datos): aquí solo se muestran y se piden.
 */

export const PERMISO_EMERGENCIAS_VER = 'qhse.emergencias.ver';
export const PERMISO_EMERGENCIAS_GESTIONAR = 'qhse.emergencias.gestionar';
/** Activar una emergencia es de cualquier trabajador (lo tienen todos los roles). */
export const PERMISO_QHSE_REPORTAR = 'qhse.eventos.reportar';

export type EstadoEmergencia = 'activa' | 'controlada' | 'cerrada';
export const ESTADOS_EMERGENCIA: EstadoEmergencia[] = ['activa', 'controlada', 'cerrada'];
export const ESTADO_EMERGENCIA_ETIQUETA: Record<EstadoEmergencia, string> = {
  activa: 'Emergencia activa',
  controlada: 'Controlada',
  cerrada: 'Cerrada',
};

export type NivelEmergencia = 1 | 2 | 3;
export const NIVELES_EMERGENCIA: NivelEmergencia[] = [1, 2, 3];
export const NIVEL_EMERGENCIA_ETIQUETA: Record<NivelEmergencia, string> = {
  1: 'Nivel 1 — Menor (controlable en sitio)',
  2: 'Nivel 2 — Moderada (requiere apoyo externo)',
  3: 'Nivel 3 — Mayor (amenaza vidas y operación)',
};

export type TriageColor = 'rojo' | 'amarillo' | 'verde' | 'negro';
export const TRIAGES: TriageColor[] = ['rojo', 'amarillo', 'verde', 'negro'];
export const TRIAGE_ETIQUETA: Record<TriageColor, string> = {
  rojo: 'Rojo — Inmediato (shock, hemorragia severa, inconsciente)',
  amarillo: 'Amarillo — Urgente (fracturas, quemaduras 2°)',
  verde: 'Verde — Menor (cortes, contusiones)',
  negro: 'Negro — Fallecido',
};

export type MedioTransporte = 'ambulancia' | 'lancha' | 'helicoptero';
export const MEDIOS_TRANSPORTE: MedioTransporte[] = ['ambulancia', 'lancha', 'helicoptero'];
export const MEDIO_TRANSPORTE_ETIQUETA: Record<MedioTransporte, string> = {
  ambulancia: 'Ambulancia terrestre (1-3 h)',
  lancha: 'Lancha (zonas fluviales)',
  helicoptero: 'Helicóptero (30-60 min a Quito)',
};

export type NivelConsciencia = 'alerta' | 'voz' | 'dolor' | 'inconsciente';
export const NIVELES_CONSCIENCIA: NivelConsciencia[] = ['alerta', 'voz', 'dolor', 'inconsciente'];
export const CONSCIENCIA_ETIQUETA: Record<NivelConsciencia, string> = {
  alerta: 'Alerta',
  voz: 'Responde a la voz',
  dolor: 'Responde al dolor',
  inconsciente: 'Inconsciente',
};

export type EtapaMedevac =
  'activado' | 'listo_para_notificar' | 'hospital_notificado' | 'transferido';
export const ETAPA_MEDEVAC_ETIQUETA: Record<EtapaMedevac, string> = {
  activado: 'MEDEVAC activado',
  listo_para_notificar: 'Listo para notificar al hospital',
  hospital_notificado: 'Hospital notificado',
  transferido: 'Transferido a cuidado médico',
};

/** Lo que el backend trae para los formularios (tipos de emergencia y servicios que se pueden ligar). */
export interface TipoEmergencia {
  id: string;
  codigo: string;
  nombre: string;
}

export interface TicketLigable {
  ticketId: string;
  ticketNumero: number | null;
  pedidoCodigo: string;
  cliente: string | null;
  pozo: string | null;
}

export interface CatalogosEmergencia {
  tipos: TipoEmergencia[];
  tickets: TicketLigable[];
}

export interface Hospital {
  id: string;
  nombre: string;
  ciudad: string;
  telefono: string | null;
}

export interface EmergenciaResumen {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoEmergencia;
  tipo: { codigo: string; nombre: string };
  descripcion: string;
  ubicacion: string | null;
  origen: 'swa' | 'derrame' | null;
  /** Nivel declarado por Base HSE; nulo hasta declararlo. */
  nivel: NivelEmergencia | null;
  reporteFlashEmitido: boolean;
  /** Sin emitir y con el plazo de 2 horas ya vencido (solo mientras la emergencia siga abierta). */
  reporteFlashVencido: boolean;
  ticketId: string | null;
  ticketNumero: number | null;
  pedidoCodigo: string | null;
  activadoAt: string;
}

export interface OrigenEmergencia {
  tipo: 'swa' | 'derrame';
  id: string;
  codigo: string;
  estado: string;
}

export interface LineaCronometro {
  at: string;
  /** Minutos desde la activación. */
  minutos: number;
  texto: string;
  automatica: boolean;
  actor: string | null;
}

export interface NivelDeclarado {
  valor: NivelEmergencia;
  declaradoPor: string | null;
  declaradoAt: string | null;
}

export interface ConteoPersonal {
  totalEnLocacion: number;
  evacuados: number;
  faltantes: number;
  por: string | null;
  at: string | null;
}

export interface PasoCascada {
  pasoId: string;
  orden: number;
  desde: string;
  hacia: string;
  plazoMinutos: number;
  notificadoAt: string | null;
  notificadoPor: string | null;
  minutos: number | null;
  enPlazo: boolean | null;
  vencido: boolean;
}

export interface SignosVitales {
  registradoAt: string;
  registradoPor: string | null;
  pulso: number | null;
  presionSistolica: number | null;
  presionDiastolica: number | null;
  respiracion: number | null;
  consciencia: NivelConsciencia | null;
}

export interface Medevac {
  activadoAt: string;
  activadoPor: string | null;
  medioTransporte: MedioTransporte | null;
  hospital: Hospital | null;
  etaMinutos: number | null;
  hospitalNotificadoAt: string | null;
  hospitalNotificadoPor: string | null;
  transferidoAt: string | null;
  transferidoPor: string | null;
  etapa: EtapaMedevac;
}

export interface Herido {
  id: string;
  nombreCompleto: string;
  cedula: string | null;
  triage: TriageColor;
  mecanismoLesion: string;
  lesiones: string | null;
  tratamientoCampo: string | null;
  registradoPor: string | null;
  triajes: { triage: TriageColor; actor: string | null; at: string }[];
  signosVitales: SignosVitales[];
  medevac: Medevac | null;
}

export interface ReporteFlash {
  resumenEjecutivo: string;
  personalAfectado: string;
  accionesTomadas: string;
  estadoActual: string;
  proximosPasos: string;
  emitidoAt: string;
  emitidoPor: string | null;
  minutos: number | null;
  fueraDePlazo: boolean;
}

export interface EmergenciaDetalle {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoEmergencia;
  tipo: { codigo: string; nombre: string };
  descripcion: string;
  ubicacion: string | null;
  origen: OrigenEmergencia | null;
  ticketId: string | null;
  ticketNumero: number | null;
  pedidoCodigo: string | null;
  cliente: string | null;
  campo: string | null;
  pozo: string | null;
  activadoPor: string | null;
  activadoAt: string;
  reporteFlash: ReporteFlash | null;
  plazoReporteFlashMinutos: number;
  reporteFlashVencido: boolean;
  controladaAt: string | null;
  controladaPor: string | null;
  cerradaAt: string | null;
  cerradaPor: string | null;
  requiereInvestigacion: boolean;
  /** Nulo si no aplica (nivel 1 o sin declarar); verdadero también si el módulo de investigaciones no está instalado. */
  investigacionAbierta: boolean | null;
  puedeControlar: boolean;
  puedeCerrar: boolean;
  triage: Record<TriageColor, number>;
  medevacEnCurso: number;
  heridos: Herido[];
  nivel: NivelDeclarado | null;
  niveles: { nivel: NivelEmergencia; actor: string | null; at: string }[];
  conteo: ConteoPersonal | null;
  conteos: (ConteoPersonal & { actor: string | null })[];
  cascada: PasoCascada[];
  notificacionCompleta: boolean;
  cronometro: LineaCronometro[];
  historial: { estado: EstadoEmergencia; actor: string | null; at: string }[];
}

export interface TableroEmergencias {
  anio: number;
  total: number;
  porEstado: Record<EstadoEmergencia, number>;
  porNivel: { sinDeclarar: number; nivel1: number; nivel2: number; nivel3: number };
  heridosPorTriage: Record<TriageColor, number>;
  medevacActivados: number;
  medevacTransferidos: number;
  reporteFlashPendientes: number;
  reporteFlashFueraDePlazo: number;
  plazoReporteFlashMinutos: number;
}

export interface ActivarEmergencia {
  tipoId: string;
  descripcion: string;
  ubicacion?: string;
  ticketId?: string;
  origenSwaId?: string;
  origenDerrameId?: string;
}

export interface NuevoHerido {
  nombreCompleto: string;
  cedula?: string;
  triage: TriageColor;
  mecanismoLesion: string;
  lesiones?: string;
}

export interface NuevosSignos {
  pulso?: number;
  presionSistolica?: number;
  presionDiastolica?: number;
  respiracion?: number;
  consciencia?: NivelConsciencia;
}

export interface DatosMedevac {
  medioTransporte?: MedioTransporte;
  hospitalId?: string;
  etaMinutos?: number;
}

export interface NuevoReporteFlash {
  resumenEjecutivo: string;
  personalAfectado: string;
  accionesTomadas: string;
  estadoActual: string;
  proximosPasos: string;
}

/** Datos con los que se abre el diálogo «Activar emergencia» (desde «Reportar», la SWA o el derrame). */
export interface EmergenciaActivarDialogData {
  /** SWA de la que escala (se hereda su servicio). */
  origenSwaId?: string;
  /** Derrame mayor o en cuerpo de agua del que escala (se hereda su servicio). */
  origenDerrameId?: string;
  /** Servicio ya ligado al origen: se hereda sin pedirlo otra vez. */
  ticketId?: string;
  /** Código estable del tipo sugerido (p. ej. `derrame_mayor`). */
  tipoSugerido?: string;
  descripcionSugerida?: string;
}

/** Personas que faltan por confirmar: en la locación menos evacuados (nunca negativo). */
export function faltantes(c: Pick<ConteoPersonal, 'totalEnLocacion' | 'evacuados'>): number {
  return Math.max(0, c.totalEnLocacion - c.evacuados);
}

/** Pasos de la cascada que aún no se notifican. */
export function pasosPendientes(e: Pick<EmergenciaDetalle, 'cascada'>): PasoCascada[] {
  return e.cascada.filter((p) => !p.notificadoAt);
}

/** Qué falta para poder cerrar la emergencia (en el orden en que se resuelve); vacío si ya se puede. */
export function pendientesDeCierre(
  e: Pick<
    EmergenciaDetalle,
    'estado' | 'reporteFlash' | 'nivel' | 'requiereInvestigacion' | 'investigacionAbierta'
  >,
): string[] {
  const falta: string[] = [];
  if (e.estado === 'activa') falta.push('Marcar la emergencia como controlada');
  if (!e.reporteFlash) falta.push('Emitir el Reporte Flash');
  if (!e.nivel) falta.push('Declarar el nivel de la emergencia');
  if (e.requiereInvestigacion && e.investigacionAbierta === false)
    falta.push('Abrir la investigación de incidentes (HSE-TRIAGE-002)');
  return falta;
}

/** Texto de la medición de signos vitales de una toma: «Pulso 90 · Presión 120/80 · Resp. 18 · Alerta». */
export function resumenSignos(s: SignosVitales): string {
  const partes: string[] = [];
  if (s.pulso !== null) partes.push(`Pulso ${s.pulso}`);
  if (s.presionSistolica !== null && s.presionDiastolica !== null)
    partes.push(`Presión ${s.presionSistolica}/${s.presionDiastolica}`);
  if (s.respiracion !== null) partes.push(`Resp. ${s.respiracion}`);
  if (s.consciencia !== null) partes.push(CONSCIENCIA_ETIQUETA[s.consciencia]);
  return partes.join(' · ');
}

/** Etiqueta del hospital para los selectores: «Hospital Metropolitano · Quito». */
export function etiquetaHospital(h: Pick<Hospital, 'nombre' | 'ciudad'>): string {
  return `${h.nombre} · ${h.ciudad}`;
}

/** Mensaje de un paso de la cascada para la pantalla: cuánto tardó y si cumplió el plazo, o si ya venció. */
export function estadoPasoCascada(p: PasoCascada): {
  texto: string;
  tono: 'success' | 'warning' | 'error' | 'neutral';
} {
  if (p.notificadoAt)
    return p.enPlazo
      ? { texto: `En plazo (${p.minutos} min)`, tono: 'success' }
      : { texto: `Fuera de plazo (${p.minutos} min)`, tono: 'warning' };
  if (p.vencido) return { texto: 'Plazo vencido', tono: 'error' };
  return { texto: `Plazo ${p.plazoMinutos} min`, tono: 'neutral' };
}

/** Un número entero de un campo de texto, o `undefined` si está vacío o no es un entero. */
export function enteroDeTexto(valor: string): number | undefined {
  const t = valor.trim();
  if (!/^-?\d+$/.test(t)) return undefined;
  return Number(t);
}
