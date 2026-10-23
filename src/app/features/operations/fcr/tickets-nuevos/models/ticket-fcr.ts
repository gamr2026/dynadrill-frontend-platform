import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';

/**
 * Tickets de FCR del contenedor `operaciones` (`/api/operaciones/fcr`). El ticket nace cuando Ventas abre un pedido de la línea FCR y entra
 * por uno de dos recorridos según el tipo de OT del pedido (venta o servicios) que confluyen en el mismo tronco. La autoridad de los
 * pasos, de los roles y de los requisitos es el backend: aquí solo se traducen sus códigos estables a los textos de la pantalla.
 */

export const PERMISO_FCR_OPERAR = 'fcr.tickets.operar';
export const PERMISO_FCR_VER = 'fcr.tickets.ver';
export const PERMISO_FCR_BODEGA = 'fcr.herramientas.preparar';
export const PERMISO_FCR_CAMBIOS_SOLICITAR = 'fcr.cambios_items.solicitar';
export const PERMISO_FCR_CAMBIOS_APROBAR = 'fcr.cambios_items.aprobar';
export const PERMISO_FCR_PUENTE = 'fcr.requisitos.puente';
export const PERMISO_FCR_CONFIGURAR = 'fcr.configuracion.gestionar';

/** Módulo de `archivos` de los documentos del ticket. */
export const MODULO_ARCHIVO_FCR = 'ticket_fcr_documento';

export type TipoOt = 'venta' | 'servicio';
export type MacroPaso =
  'pendiente' | 'en_proceso' | 'esperando_aprobacion' | 'aprobado' | 'rechazado';

export interface PasoTicket {
  codigo: string;
  nombre: string;
  macro: MacroPaso;
  /** Códigos de rol que atienden el paso. */
  roles: string[];
}

export interface TicketFcrResumen {
  id: string;
  ticketNumero: number | null;
  pedidoId: string;
  pedidoCodigo: string;
  tipoOt: TipoOt;
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

export interface RequisitoTicket {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  modulo: 'fcr' | 'qhse' | 'flota';
  ambito: 'ticket' | 'operador';
  paso: string | null;
  para: string | null;
  usuarioId: string | null;
  estado: 'pendiente' | 'cumplido';
  cumplidoAt: string | null;
  origen: 'sistema' | 'evento' | 'manual_temporal' | null;
  motivo: string | null;
}

export interface PersonaAsignada {
  usuarioId: string;
  nombre: string;
}
/** Una observación del ticket: nota con autor, rol y fecha, inmutable. */
export interface ObservacionTicket {
  id: string;
  mensaje: string;
  autor: string;
  autorRol: string;
  autorRolNombre: string;
  fecha: string;
}

/** Un ticket de FCR sin cerrar en el que el operador ya está asignado. */
export interface OcupacionOperador {
  ticketId: string;
  ticketNumero: number | null;
  pedidoCodigo: string;
  desde: string | null;
  hasta: string | null;
}

/** Un operador frente al rango del servicio: ✓ disponible, ✗ ocupado (con la razón en una frase). */
export interface OperadorDisponible {
  usuarioId: string;
  nombre: string;
  disponible: boolean;
  detalle: string;
  ocupaciones: OcupacionOperador[];
}

export interface DisponibilidadOperadores {
  desde: string;
  hasta: string;
  operadores: OperadorDisponible[];
}

export interface AsignacionTicket {
  supervisor: PersonaAsignada | null;
  operadores: PersonaAsignada[];
}

export interface TicketFcr extends TicketFcrResumen {
  numeroContrato: string | null;
  as2Numero: string | null;
  clienteRuc: string | null;
  bloque: string | null;
  fechaFinServicio: string | null;
  version: number;
  tipoOperador: { id: string; codigo: string; nombre: string } | null;
  inspector: PersonaAsignada | null;
  /** Quien consulta es de un rol que atiende el paso actual y, si el paso lo exige, del equipo. */
  puedeActuar: boolean;
  siguientes: SiguientePaso[];
  asignacion: AsignacionTicket;
  requisitos: RequisitoTicket[];
  historial: HistorialTicket[];
}

export interface FiltroTickets {
  paso?: string;
  q?: string;
  mios?: boolean;
}

// ── Pasos (códigos del catálogo de la base) ──

export const PASO_REVISION_INICIAL = 'revision_inicial';
export const PASO_TIPO_OPERADOR = 'tipo_operador';
export const PASO_INSPECCION = 'inspeccion';
export const PASO_APROBACION = 'aprobacion_supervisor_operaciones';
export const PASO_PREPARACION = 'preparacion_herramientas';
export const PASO_ASIGNACION = 'asignacion';
export const PASO_REUNION = 'reunion_operativa';
export const PASO_EJECUCION = 'ejecucion_operativa';
export const PASO_REVISION_REPORTES = 'revision_reportes';
export const PASO_RETORNO = 'control_retorno';
export const PASO_CIERRE = 'cierre';
export const PASO_CERRADO = 'cerrado';

/** Para el filtro de la bandeja (el orden es el del proceso). */
export const PASOS_FCR: ReadonlyArray<{ codigo: string; nombre: string }> = [
  { codigo: PASO_REVISION_INICIAL, nombre: 'Revisión inicial' },
  { codigo: PASO_TIPO_OPERADOR, nombre: 'Tipo de operador' },
  { codigo: PASO_INSPECCION, nombre: 'Inspección' },
  { codigo: PASO_APROBACION, nombre: 'Aprobación del Supervisor de Operaciones' },
  { codigo: PASO_PREPARACION, nombre: 'Preparación de herramientas' },
  { codigo: PASO_ASIGNACION, nombre: 'Asignación' },
  { codigo: PASO_REUNION, nombre: 'Reunión operativa' },
  { codigo: PASO_EJECUCION, nombre: 'Ejecución operativa' },
  { codigo: PASO_REVISION_REPORTES, nombre: 'Revisión de reportes' },
  { codigo: PASO_RETORNO, nombre: 'Control de retorno' },
  { codigo: PASO_CIERRE, nombre: 'Cierre' },
  { codigo: PASO_CERRADO, nombre: 'Cerrado' },
];

export const TIPO_OT_LABELS: Record<TipoOt, string> = { venta: 'Venta', servicio: 'Servicios' };

export const ROL_LABELS: Record<string, string> = {
  supervisor: 'Supervisor',
  operador_fcr: 'Operador FCR',
  supervisor_operaciones_fcr: 'Supervisor de Operaciones FCR',
  bodeguero: 'Bodega',
  superadmin: 'Superadmin',
  jefe_base: 'Jefe de Base',
};
export const etiquetaRol = (codigo: string): string => ROL_LABELS[codigo] ?? codigo;
export const etiquetaRoles = (codigos: readonly string[]): string =>
  codigos.map(etiquetaRol).join(' / ');

export const TONO_MACRO: Record<MacroPaso, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  pendiente: 'warning',
  en_proceso: 'info',
  esperando_aprobacion: 'warning',
  aprobado: 'success',
  rechazado: 'error',
};

export const ORIGEN_REQUISITO_LABELS: Record<NonNullable<RequisitoTicket['origen']>, string> = {
  sistema: 'Registrado en el ticket',
  evento: 'Confirmado por otro módulo',
  manual_temporal: 'Confirmado a mano (temporal)',
};
export const MODULO_LABELS: Record<RequisitoTicket['modulo'], string> = {
  fcr: 'FCR',
  qhse: 'QHSE',
  flota: 'Flota',
};

/** `pesca` → "Pesca" (los códigos vienen del catálogo de servicios del pedido). */
export function etiquetaTipoServicio(codigo: string): string {
  const t = codigo.replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : codigo;
}

/** Requisitos que faltan para salir del paso actual. */
export function pendientesDelPaso(t: Pick<TicketFcr, 'paso' | 'requisitos'>): RequisitoTicket[] {
  return t.requisitos.filter((r) => r.paso === t.paso.codigo && r.estado === 'pendiente');
}

export function mensajeErrorTicket(err: unknown, porDefecto: string): string {
  const e = err as { status?: number } | null;
  const texto = mensajeDeError(err, '');
  if (e?.status === 403) return texto || 'Esa acción la atiende otro rol o el equipo asignado.';
  if (e?.status === 409) return texto || 'El ticket cambió. Recargue e intente de nuevo.';
  return texto || porDefecto;
}

// ── Catálogos ──

export interface ElementoCatalogo {
  id: string;
  codigo: string;
  nombre: string;
}
export interface CatalogosFcr {
  tiposOperador: ElementoCatalogo[];
  tiposCompletacion: ElementoCatalogo[];
  tiposTrabajo: ElementoCatalogo[];
  tiposPicker: ElementoCatalogo[];
}

// ── Herramientas ──

export type EstadoHerramienta =
  | 'seleccionada'
  | 'solicitada'
  | 'novedad_bodega'
  | 'preparada'
  | 'enviada'
  | 'novedad_recepcion'
  | 'recibida'
  | 'devuelta'
  | 'faltante';

export const ESTADO_HERRAMIENTA_LABELS: Record<EstadoHerramienta, string> = {
  seleccionada: 'Por solicitar a Bodega',
  solicitada: 'Solicitada a Bodega',
  novedad_bodega: 'Novedad en Bodega',
  preparada: 'Preparada por Bodega',
  enviada: 'Enviada, por recibir',
  novedad_recepcion: 'Novedad al recibir',
  recibida: 'Recibida',
  devuelta: 'Devuelta',
  faltante: 'Faltante',
};
export const ESTADO_HERRAMIENTA_TONO: Record<
  EstadoHerramienta,
  'info' | 'warning' | 'success' | 'error' | 'neutral'
> = {
  seleccionada: 'neutral',
  solicitada: 'info',
  novedad_bodega: 'warning',
  preparada: 'info',
  enviada: 'info',
  novedad_recepcion: 'warning',
  recibida: 'success',
  devuelta: 'success',
  faltante: 'error',
};

export interface HerramientaTicket {
  id: string;
  articuloId: string;
  codigo: string;
  nombre: string;
  origen: 'pedido' | 'manual';
  codigoPedido: string | null;
  agregadaTarde: boolean;
  numeroSerie: string | null;
  estado: EstadoHerramienta;
  existencia: number | null;
  solicitadaAt: string | null;
  preparadaAt: string | null;
  bodegaNovedad: string | null;
  enviadaAt: string | null;
  recibidaAt: string | null;
  recepcionNovedad: string | null;
  devueltaAt: string | null;
  faltanteAt: string | null;
  faltanteMotivo: string | null;
}

export type MotivoAvisoPrecarga =
  'pedido_sin_cliente' | 'sin_configurar' | 'kit_vacio' | 'articulo_inactivo';
export const AVISO_PRECARGA_LABELS: Record<MotivoAvisoPrecarga, string> = {
  pedido_sin_cliente: 'El pedido no tiene cliente: no se pudo armar el listado.',
  sin_configurar: 'Sin kit configurado en «Códigos por cliente»: agregue las herramientas a mano.',
  kit_vacio: 'El código está configurado como herramienta pero su kit no tiene artículos.',
  articulo_inactivo: 'Un artículo del kit ya no está activo en Inventario: no se cargó.',
};

export interface AvisoPrecarga {
  motivo: MotivoAvisoPrecarga;
  codigo: string | null;
  descripcion: string | null;
  articulo: string | null;
}

export interface HerramientasTicket {
  listadoConfirmado: boolean;
  herramientas: HerramientaTicket[];
  movilizaciones: Array<{ codigo: string; descripcion: string; unidad: string; cantidad: number }>;
  avisosPrecarga: AvisoPrecarga[];
}

export interface HerramientaDisponible {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
}

export interface HerramientaPendiente extends Pick<
  HerramientaTicket,
  'id' | 'codigo' | 'nombre' | 'estado' | 'bodegaNovedad'
> {
  ticket: {
    id: string;
    ticketNumero: number | null;
    pedidoCodigo: string;
    cliente: string | null;
    pozo: string | null;
  };
}

export type CausaFaltante = 'venta_complementaria' | 'perdida' | 'dano' | 'otro';
export const CAUSA_FALTANTE_LABELS: Record<CausaFaltante, string> = {
  venta_complementaria: 'Venta de herramienta complementaria al cliente',
  perdida: 'Pérdida',
  dano: 'Daño',
  otro: 'Otro',
};

/** Cuántas herramientas del ticket están en cada estado (para el resumen de la tarjeta). */
export function resumenHerramientas(
  l: readonly HerramientaTicket[],
): Array<{ estado: EstadoHerramienta; cantidad: number }> {
  const cuenta = new Map<EstadoHerramienta, number>();
  for (const h of l) cuenta.set(h.estado, (cuenta.get(h.estado) ?? 0) + 1);
  return (Object.keys(ESTADO_HERRAMIENTA_LABELS) as EstadoHerramienta[])
    .filter((e) => cuenta.has(e))
    .map((e) => ({ estado: e, cantidad: cuenta.get(e) ?? 0 }));
}

// ── Inspección ──

export type EstadoInspeccion = 'borrador' | 'enviada' | 'aprobada' | 'rechazada';
export type ResponsableTrabajo = 'dynadrill' | 'proveedor_externo';
export type ResultadoParte = 'ok' | 'defectuoso';
export type RolFirma = 'reparado_por' | 'revisado_por' | 'liberado_qhse';

export const ESTADO_INSPECCION_LABELS: Record<EstadoInspeccion, string> = {
  borrador: 'En borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  rechazada: 'Devuelta',
};
export const ESTADO_INSPECCION_TONO: Record<
  EstadoInspeccion,
  'info' | 'warning' | 'success' | 'error' | 'neutral'
> = {
  borrador: 'neutral',
  enviada: 'info',
  aprobada: 'success',
  rechazada: 'error',
};
export const RESPONSABLE_LABELS: Record<ResponsableTrabajo, string> = {
  dynadrill: 'Dynadrill',
  proveedor_externo: 'Proveedor externo',
};
export const RESULTADO_LABELS: Record<ResultadoParte, string> = {
  ok: 'OK',
  defectuoso: 'Defectuoso',
};
export const FIRMAS: readonly RolFirma[] = ['reparado_por', 'revisado_por', 'liberado_qhse'];
export const FIRMA_LABELS: Record<RolFirma, string> = {
  reparado_por: 'Reparado por',
  revisado_por: 'Revisado por',
  liberado_qhse: 'Liberado por QHSE',
};
/** Rol de cuenta que deja cada firma (espejo de la tabla `firma_rol_permitido`; la base lo exige). */
export const FIRMA_ROLES: Record<RolFirma, readonly string[]> = {
  reparado_por: ['operador_fcr'],
  revisado_por: ['supervisor'],
  liberado_qhse: ['tecnico_hse', 'gerente_hse'],
};

export interface ResumenInspeccion {
  herramientaId: string;
  codigo: string;
  nombre: string;
  inspeccion: {
    id: string;
    version: number;
    estado: EstadoInspeccion;
    firmas: RolFirma[];
    motivoRechazo: string | null;
  } | null;
}

export interface ParteInspeccion {
  id: string;
  orden: number;
  item: string;
  codigo: string | null;
  descripcion: string;
  cantidadEsperada: number;
  visual: ResultadoParte | null;
  endResultado: ResultadoParte | null;
  cambioCantidad: number | null;
  accion: string | null;
  manual: boolean;
}

export interface FirmaInspeccion {
  usuarioId: string;
  nombre: string;
  firmadaAt: string;
}

export interface InspeccionHerramienta {
  id: string;
  herramientaId: string;
  version: number;
  estado: EstadoInspeccion;
  cliente: string | null;
  pozo: string | null;
  descripcionHerramienta: string;
  codigoHerramienta: string;
  numeroSerie: string | null;
  fechaInspeccion: string | null;
  fechaReparacion: string | null;
  fechaEnvio: string | null;
  inspeccionadoPor: ResponsableTrabajo | null;
  reparadoPor: ResponsableTrabajo | null;
  observaciones: string | null;
  enviadaAt: string | null;
  enviadaPor: string | null;
  decididaAt: string | null;
  decididaPor: string | null;
  motivoRechazo: string | null;
  firmas: Record<RolFirma, FirmaInspeccion | null>;
  partes: ParteInspeccion[];
}

/** La siguiente firma que se puede dejar (en orden), o `null` si ya están las tres. */
export function siguienteFirma(firmas: Record<RolFirma, FirmaInspeccion | null>): RolFirma | null {
  return FIRMAS.find((r) => !firmas[r]) ?? null;
}

/** «Reparado por» certifica los datos y las partes: desde que firma, la cabecera y las partes se bloquean. */
export const inspeccionEditable = (i: Pick<InspeccionHerramienta, 'estado' | 'firmas'>): boolean =>
  i.estado === 'borrador' && !i.firmas.reparado_por;

/** ¿Esta cuenta puede dejar la firma `rol`? (Por rol; que sea el operador o el supervisor del ticket lo comprueba el backend.) */
export const puedeFirmar = (rol: RolFirma, rolCuenta: string | undefined): boolean =>
  !!rolCuenta && FIRMA_ROLES[rol].includes(rolCuenta);

/** Qué falta para poder firmar «reparado por» (o `null`). */
export function faltaParaFirmar(
  i: Pick<InspeccionHerramienta, 'inspeccionadoPor' | 'reparadoPor'>,
): string | null {
  if (!i.inspeccionadoPor || !i.reparadoPor)
    return 'Indique quién inspeccionó y quién reparó antes de firmar.';
  return null;
}

// ── Documentos ──

export type CampoDocumento =
  | 'formulario_inspeccion_externo'
  | 'formato_dimensionamiento_servicio'
  | 'formato_dureza_servicio'
  | 'documento_inspeccion'
  | 'registro_dureza'
  | 'registro_qaqc';

export const CAMPO_DOCUMENTO_LABELS: Record<CampoDocumento, string> = {
  formulario_inspeccion_externo: 'Formulario de inspección externo',
  formato_dimensionamiento_servicio: 'Formato de dimensionamiento',
  formato_dureza_servicio: 'Formato de dureza',
  documento_inspeccion: 'Inspección y dimensionamiento de herramientas',
  registro_dureza: 'Registro de dureza',
  registro_qaqc: 'Registro firmado de QAQC',
};
/** Qué campos se adjuntan en cada paso (servicios en la inspección; venta y tronco en la preparación). */
export const CAMPOS_POR_PASO: Record<string, readonly CampoDocumento[]> = {
  [PASO_INSPECCION]: [
    'formulario_inspeccion_externo',
    'formato_dimensionamiento_servicio',
    'formato_dureza_servicio',
  ],
  [PASO_PREPARACION]: ['documento_inspeccion', 'registro_dureza', 'registro_qaqc'],
};

export interface DocumentoTicket {
  id: string;
  campo: CampoDocumento;
  archivoId: string;
  subidoPor: string;
  createdAt: string;
}

/** El vigente de cada campo es el último que se adjuntó. */
export function documentoVigente(
  l: readonly DocumentoTicket[],
  campo: CampoDocumento,
): DocumentoTicket | null {
  return (
    [...l]
      .filter((d) => d.campo === campo)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .pop() ?? null
  );
}

// ── Reunión, bitácora y uso ──

export interface ActaReunion {
  fecha: string;
  firmadaAt: string;
  firmadaPor: string;
}

export type EstadoDiaBitacora = 'borrador' | 'enviado' | 'corregido';
export const ESTADO_DIA_LABELS: Record<EstadoDiaBitacora, string> = {
  borrador: 'Por enviar',
  enviado: 'Enviado',
  corregido: 'Corregido por Facturación',
};
export const ESTADO_DIA_TONO: Record<
  EstadoDiaBitacora,
  'info' | 'warning' | 'success' | 'error' | 'neutral'
> = { borrador: 'warning', enviado: 'success', corregido: 'info' };

export interface DiaBitacora {
  fecha: string;
  estado: EstadoDiaBitacora;
  actividades: number;
  totalHoras: number;
  enviadaAt: string | null;
}
export interface BitacoraTicket {
  servicio: { desde: string | null; hasta: string | null };
  dias: DiaBitacora[];
}
export interface ActividadBitacora {
  horaInicio: string;
  horaFin: string;
  detalle: string;
}
export interface DiaBitacoraDetalle {
  fecha: string;
  estado: EstadoDiaBitacora;
  totalHoras: number;
  enviadaAt: string | null;
  corregidaAt: string | null;
  actividades: Array<
    ActividadBitacora & { duracionHoras: number; autor: { id: string; nombre: string } }
  >;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Horas entre dos horas del día (si el fin es menor que el inicio, cruza la medianoche), con dos decimales. */
export function duracionHoras(inicio: string, fin: string): number {
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  let min = h2 * 60 + m2 - (h1 * 60 + m1);
  if (min < 0) min += 24 * 60;
  return Math.round((min / 60) * 100) / 100;
}

/** Qué falta para guardar las actividades de un día (texto para quien opera), o `null` si están completas. */
export function validarActividades(l: readonly ActividadBitacora[]): string | null {
  for (const [i, a] of l.entries()) {
    const n = `Actividad ${i + 1}: `;
    if (!HORA.test(a.horaInicio) || !HORA.test(a.horaFin))
      return `${n}indique la hora de inicio y de fin (HH:mm).`;
    if (a.horaInicio === a.horaFin) return `${n}no puede empezar y terminar a la misma hora.`;
    if (!a.detalle.trim()) return `${n}escriba el detalle.`;
  }
  return null;
}

/** ¿El día se puede cambiar o enviar desde el ticket? (Facturación bloquea los que corrigió.) */
export const diaEditable = (estado: EstadoDiaBitacora | undefined): boolean =>
  estado !== 'corregido';

/** ¿La fecha está dentro de las del servicio del pedido? (si el pedido no las trae, solo se exige que sea una fecha). */
export function fechaEnServicio(fecha: string, servicio: BitacoraTicket['servicio']): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  return (
    (!servicio.desde || fecha >= servicio.desde) && (!servicio.hasta || fecha <= servicio.hasta)
  );
}

/** Estado de un día de una fila por día del Reporte de Herramientas (el stand-by no se cobra y no se registra). */
export type EstadoDiaReporte = 'operacion' | 'daily_charge' | 'venta';
export const ESTADO_DIA_REPORTE_LABELS: Record<EstadoDiaReporte, string> = {
  operacion: 'Operación',
  daily_charge: 'Daily charge',
  venta: 'Venta',
};
/** Marca corta del formato impreso DYN-FCR-RE-008. */
export const ESTADO_DIA_REPORTE_MARCA: Record<EstadoDiaReporte, string> = {
  operacion: 'O',
  daily_charge: 'D',
  venta: 'V',
};

/** Una fila del Reporte de Herramientas: un ítem de la lista de precios del cliente con su cantidad real. */
export interface ItemReporte {
  id: string;
  orden: number;
  listaPreciosItemId: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  /** La unidad es de tiempo: sus celdas son marcas que valen 1; en las demás cada celda lleva su cantidad. */
  porDia: boolean;
  serie: string | null;
  /** Total real de la fila: la suma de sus días. */
  cantidad: number;
  /** Lo cotizado por Ventas para ese código (tope de lo que se puede reportar). */
  cotizado: number;
  dias: Array<{ fecha: string; estado: EstadoDiaReporte; cantidad: number }>;
  seriesSugeridas: string[];
}

export interface ReporteHerramientas {
  listadoConfirmado: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  items: ItemReporte[];
}

export interface AgregarItemReporteEntrada {
  listaPreciosItemId?: string;
  codigo: string;
  descripcion: string;
  unidad?: string;
  serie?: string;
}

/** Ítem elegible de la lista de precios del cliente (lo devuelve Comercial). */
export interface OpcionItemLista {
  listaPreciosItemId: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  tipo: 'Material' | 'Servicio';
}

// ── Asignación ──

export interface FilaOperador {
  usuarioId: string | null;
}

/** Qué falta para asignar (o `null`): al menos un operador, sin repetir, y el supervisor distinto de los operadores. */
export function validarAsignacion(
  supervisorId: string | null,
  filas: readonly FilaOperador[],
  haySupervisorActual: boolean,
): string | null {
  if (!haySupervisorActual && !supervisorId) return 'Elija el supervisor del servicio.';
  if (!filas.length || filas.some((f) => !f.usuarioId))
    return 'Elija al menos un operador (y complete cada fila).';
  const ids = filas.map((f) => f.usuarioId);
  if (new Set(ids).size !== ids.length) return 'Un operador no puede estar dos veces.';
  if (supervisorId && ids.includes(supervisorId))
    return 'El supervisor no puede ser también operador.';
  return null;
}
