/**
 * Tickets de Pumping del contenedor `operaciones` (`/api/operaciones/pumping/tickets`). El ticket nace cuando Ventas abre un
 * pedido de la línea Pumping y lo lleva el Jefe de Base, el Supervisor y el Operador por los pasos del servicio.
 */

export const PERMISO_PUMPING_OPERAR = 'pumping.tickets.operar';

export type MacroPaso = 'pendiente' | 'en_proceso' | 'esperando_aprobacion' | 'aprobado' | 'rechazado';

export interface PasoTicket {
  codigo: string;
  nombre: string;
  macro: MacroPaso;
  /** Códigos de rol que atienden el paso. */
  roles: string[];
}

/** El ticket no tiene numeración propia: es la prefactura, y su número es el que `comercial` reservó al abrir el pedido (el mismo que tendrá la prefactura). */
export interface TicketPumpingResumen {
  id: string;
  /** Número de ticket (el de la prefactura que vendrá); `null` en pedidos abiertos antes de esta regla. */
  ticketNumero: number | null;
  pedidoId: string;
  pedidoCodigo: string;
  paso: PasoTicket;
  cliente: string | null;
  campo: string | null;
  pozo: string | null;
  taladro: string | null;
  tiposServicio: string[];
  fechaInicioServicio: string | null;
  createdAt: string;
}

export interface SiguientePaso {
  codigo: string;
  nombre: string;
  requiereMotivo: boolean;
}

export interface HistorialTicket {
  pasoAnterior: string | null;
  pasoNuevo: string;
  motivo: string | null;
  actor: { nombre: string; rol: string | null } | null;
  origen: 'manual' | 'sistema';
  at: string;
}

export interface TicketPumping extends TicketPumpingResumen {
  tipoOt: string | null;
  numeroContrato: string | null;
  as2Numero: string | null;
  clienteRuc: string | null;
  bloque: string | null;
  version: number;
  /** Quien consulta es de un rol que atiende el paso actual. */
  puedeActuar: boolean;
  siguientes: SiguientePaso[];
  /** Lo que asignó el Jefe de Base (vacío mientras no asigne). */
  asignacion: AsignacionTicket;
  /** Requisitos de los pasos del traslado de salida, con su estado. */
  requisitos: RequisitoTicket[];
  historial: HistorialTicket[];
}

export interface PersonaAsignadaTicket {
  usuarioId: string;
  nombre: string;
}
/** Operador con la unidad que lleva. */
export interface OperadorAsignadoTicket extends PersonaAsignadaTicket {
  vehiculoId: string | null;
  placa: string | null;
}
export interface UnidadAsignadaTicket {
  vehiculoId: string;
  placa: string;
  descripcion: string | null;
}
export interface AsignacionTicket {
  supervisor: PersonaAsignadaTicket | null;
  operadores: OperadorAsignadoTicket[];
  unidades: UnidadAsignadaTicket[];
}

/** Cuerpo de `POST /tickets/:id/asignar`: solo ids (el backend obtiene los nombres de identidad y del catálogo de vehículos). Cada operador lleva su unidad. */
export interface AsignacionEntrada {
  supervisorId: string;
  operadores: { usuarioId: string; vehiculoId: string }[];
}

/** Paso en el que el Jefe de Base asigna al equipo. */
export const PASO_ASIGNACION = 'asignacion';

/** Fila del formulario de asignación: un operador y su unidad (cualquiera puede estar sin elegir todavía). */
export interface FilaAsignacion {
  usuarioId: string | null;
  vehiculoId: string | null;
}

/** Qué falta para poder asignar (texto para quien opera); `null` si está completo. */
export function validarAsignacion(supervisorId: string | null, filas: readonly FilaAsignacion[]): string | null {
  if (!supervisorId) return 'Elija el supervisor.';
  if (!filas.length) return 'Agregue al menos un operador.';
  if (filas.some(f => !f.usuarioId)) return 'Elija el operador de cada fila.';
  if (filas.some(f => !f.vehiculoId)) return 'Elija la unidad de cada operador.';
  const ids = filas.map(f => f.usuarioId as string);
  if (new Set(ids).size !== ids.length) return 'Un operador no puede repetirse.';
  if (ids.includes(supervisorId)) return 'El supervisor no puede ser también operador.';
  return null;
}

// ── Requisitos del traslado de salida (ver documentacion/pumping/PLAN-TRASLADO-SALIDA.md) ──

export type EstadoRequisito = 'pendiente' | 'cumplido';
export type ModuloDueno = 'pumping' | 'qhse' | 'flota';

export interface RequisitoTicket {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  modulo: ModuloDueno;
  ambito: 'ticket' | 'unidad' | 'operador';
  /** Paso del que se sale cuando se cumple. */
  paso: string | null;
  /** Placa de la unidad o nombre del operador; `null` si es del ticket. */
  para: string | null;
  vehiculoId: string | null;
  usuarioId: string | null;
  estado: EstadoRequisito;
  cumplidoAt: string | null;
  origen: 'sistema' | 'evento' | 'manual_temporal' | null;
  motivo: string | null;
}

export const MODULO_LABELS: Record<ModuloDueno, string> = { pumping: 'Pumping', qhse: 'QHSE', flota: 'Flota' };
export const ORIGEN_REQUISITO_LABELS: Record<'sistema' | 'evento' | 'manual_temporal', string> = {
  sistema: 'Registrado en Pumping',
  evento: 'Confirmado por su módulo',
  manual_temporal: 'Confirmado a mano (temporal)',
};
export const PERMISO_PUENTE_REQUISITOS = 'pumping.requisitos.puente';

/** Requisitos pendientes para salir del paso del ticket. */
export const pendientesDelPaso = (t: Pick<TicketPumping, 'requisitos' | 'paso'>): RequisitoTicket[] =>
  (t.requisitos ?? []).filter(r => r.paso === t.paso.codigo && r.estado === 'pendiente');

// ── Términos y condiciones ──
export interface TerminosVigentes {
  codigo: string;
  titulo: string;
  texto: string;
  textoHash: string;
}
export interface AceptacionOperador {
  usuarioId: string;
  nombre: string;
  aceptacion: { versionCodigo: string; aceptadoAt: string; esVigente: boolean } | null;
}

// ── Checklist de ingreso a locación ──
export type GasIngreso = 'h2s' | 'lel' | 'o2' | 'co';
export interface LimiteGas {
  gas: GasIngreso;
  nombre: string;
  unidad: string;
  minimo: number | null;
  maximo: number;
}
export interface IngresoLocacion {
  ticketId: string;
  toolboxTalkRealizado: boolean;
  walkaroundCompletado: boolean;
  lineaBaseAmbientalDocumentada: boolean;
  rutasEmergenciaVerificadas: boolean;
  simopsConfirmado: boolean;
  limites: LimiteGas[];
  lecturas: { gas: GasIngreso; lectura: number; seguro: boolean; medidoAt: string; medidoPor: string | null }[];
  loto: { itemId: string; etiqueta: string; marcado: boolean }[];
  lotoNotificadoClienteAt: string | null;
  confirmadoPor: string | null;
  confirmadoAt: string | null;
  completo: boolean;
}
export type ConfirmacionIngreso =
  | 'toolboxTalkRealizado'
  | 'walkaroundCompletado'
  | 'lineaBaseAmbientalDocumentada'
  | 'rutasEmergenciaVerificadas'
  | 'simopsConfirmado';
export const CONFIRMACIONES_INGRESO: { clave: ConfirmacionIngreso; etiqueta: string }[] = [
  { clave: 'toolboxTalkRealizado', etiqueta: 'Charla de seguridad (toolbox talk) realizada' },
  { clave: 'walkaroundCompletado', etiqueta: 'Recorrido de inspección (walkaround) completado' },
  { clave: 'lineaBaseAmbientalDocumentada', etiqueta: 'Línea base ambiental documentada' },
  { clave: 'rutasEmergenciaVerificadas', etiqueta: 'Rutas de emergencia verificadas' },
  { clave: 'simopsConfirmado', etiqueta: 'Operaciones simultáneas (SIMOPS) confirmadas' },
];
/** Última lectura de cada gas. */
export const ultimaLecturaPorGas = (i: Pick<IngresoLocacion, 'lecturas'>): Map<GasIngreso, IngresoLocacion['lecturas'][number]> =>
  new Map(i.lecturas.map(l => [l.gas, l] as const));

// ── Reporte de unidad (salida) ──
export type PuntoHubodometro = 'origen' | 'destino';
export type PosicionLlanta = 'delantera_izquierda' | 'delantera_derecha' | 'trasera_izquierda' | 'trasera_derecha';
export type SeccionInspeccion = 'chasis' | 'motor' | 'equipo' | 'instrumentacion';
export type ResultadoInspeccion = 'conforme' | 'no_conforme';

export const POSICIONES_LLANTA: { posicion: PosicionLlanta; etiqueta: string }[] = [
  { posicion: 'delantera_izquierda', etiqueta: 'Delantera izquierda' },
  { posicion: 'delantera_derecha', etiqueta: 'Delantera derecha' },
  { posicion: 'trasera_izquierda', etiqueta: 'Trasera izquierda' },
  { posicion: 'trasera_derecha', etiqueta: 'Trasera derecha' },
];
export const SECCIONES_INSPECCION: { seccion: SeccionInspeccion; etiqueta: string }[] = [
  { seccion: 'chasis', etiqueta: 'Chasis' },
  { seccion: 'motor', etiqueta: 'Motor y tren de potencia' },
  { seccion: 'equipo', etiqueta: 'Equipo de servicio' },
  { seccion: 'instrumentacion', etiqueta: 'Instrumentación' },
];

export interface UnidadReporte {
  vehiculoId: string;
  placa: string;
  operador: { usuarioId: string; nombre: string } | null;
  salidaFirmada: boolean;
  salidaFirmadaAt: string | null;
}
export interface ReporteUnidad {
  ticketId: string;
  vehiculoId: string;
  placa: string;
  operador: { usuarioId: string; nombre: string } | null;
  origen: string | null;
  destino: string | null;
  salida: { fecha: string | null; combustible: number | null; firmadaPor: string | null; firmadaAt: string | null };
  hubodometros: { eje: string; punto: PuntoHubodometro; salida: number | null; llegada: number | null }[];
  llantas: { posicion: PosicionLlanta; salida: string | null; llegada: string | null }[];
  inspecciones: { itemId: string; seccion: SeccionInspeccion; etiqueta: string; salida: ResultadoInspeccion | null; llegada: ResultadoInspeccion | null }[];
}
export interface SalidaEntrada {
  fecha: string;
  combustible: number;
  origen: string;
  destino: string;
  hubodometros: { eje: string; punto: PuntoHubodometro; salida: number | null }[];
  llantas: { posicion: PosicionLlanta; salida: string | null }[];
  inspecciones: { itemId: string; resultado: ResultadoInspeccion }[];
}

export interface FiltroTickets {
  paso?: string;
  q?: string;
  /** Solo los tickets cuyo paso atiende el rol de quien consulta. */
  mios?: boolean;
}

export const ROL_LABELS: Record<string, string> = {
  jefe_base: 'Jefe de Base',
  supervisor: 'Supervisor',
  supervisor_pumping: 'Supervisor Pumping',
  operador: 'Operador',
};

export const etiquetaRol = (codigo: string): string => ROL_LABELS[codigo] ?? codigo;
export const etiquetaRoles = (codigos: readonly string[]): string => codigos.map(etiquetaRol).join(' / ');

/** Tono del paso según su macro-estado (el texto siempre va escrito: el color no es lo único que informa). */
export const TONO_MACRO: Record<MacroPaso, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  pendiente: 'warning',
  en_proceso: 'info',
  esperando_aprobacion: 'warning',
  aprobado: 'success',
  rechazado: 'error',
};

/** `control_fluidos` → "Control fluidos" (los códigos vienen del catálogo de servicios del pedido). */
export function etiquetaTipoServicio(codigo: string): string {
  const t = codigo.replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : codigo;
}

/** Orden de los pasos del servicio, para el selector de la bandeja. */
export const PASOS_PUMPING: { codigo: string; nombre: string }[] = [  // el mantenimiento salió del flujo (ahora es una tarjeta aparte)
  { codigo: 'revision_inicial', nombre: 'Revisión inicial' },
  { codigo: 'asignacion', nombre: 'Asignación' },
  { codigo: 'traslado_salida', nombre: 'Traslado de salida' },
  { codigo: 'revision_reportes_salida', nombre: 'Revisión de reportes de salida' },
  { codigo: 'ejecucion_operativa', nombre: 'Ejecución operativa' },
  { codigo: 'control_retorno', nombre: 'Control de retorno' },
  { codigo: 'traslado_llegada', nombre: 'Traslado de llegada' },
  { codigo: 'revision_reportes_llegada', nombre: 'Revisión de reportes de llegada' },
  { codigo: 'revision_final', nombre: 'Revisión final' },
  { codigo: 'cierre', nombre: 'Cierre' },
];

export const nombrePaso = (codigo: string | null): string => PASOS_PUMPING.find(p => p.codigo === codigo)?.nombre ?? codigo ?? '';

export function mensajeErrorTicket(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: { message?: unknown; detail?: unknown } } | null;
  const m = e?.error?.detail ?? e?.error?.message;
  const texto = Array.isArray(m) ? m.filter(x => typeof x === 'string').join('. ') : typeof m === 'string' ? m : '';
  if (e?.status === 403) return texto || 'Ese paso lo atiende otro rol.';
  if (e?.status === 409) return texto || 'El ticket cambió de paso. Recargue e intente de nuevo.';
  return texto || porDefecto;
}
