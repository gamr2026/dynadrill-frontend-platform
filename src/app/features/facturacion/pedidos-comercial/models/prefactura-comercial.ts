import type { PedidoDetalle } from './pedido-comercial.model';
/** Prefactura del contenedor `comercial` (`/api/comercial/pedidos/:id/prefacturas` y `/api/comercial/prefacturas/:id`). */

export const PERMISOS_PREFACTURAS = {
  ver: 'comercial.prefacturas.ver',
  generar: 'comercial.prefacturas.generar',
  enviar: 'comercial.prefacturas.enviar',
  firmar: 'comercial.prefacturas.firmar',
  rechazar: 'comercial.prefacturas.rechazar',
} as const;

export type EstadoPrefactura =
  'generada' | 'enviada_para_firmas' | 'firmada' | 'rechazada' | 'anulada';
export type MedioEnvio = 'email' | 'portal';
export type DevueltoA = 'ventas' | 'operaciones' | 'facturacion';
export type FirmanteTipo = 'company_man' | 'cliente' | 'dynadrill';
export type VerificacionFirma =
  'no_verificada' | 'firma_detectada' | 'firma_no_detectada' | 'no_concluyente';
export type FuenteItem = 'herramienta' | 'material' | 'personal' | 'personal_manual';

export interface TotalesPrefactura {
  subtotalServicios: number;
  subtotalMateriales: number;
  subtotal: number;
  iva: number;
  retencionIr: number;
  retencionIva: number;
  netoCobrar: number;
}

export interface TasasPrefactura {
  ivaPct: number;
  retencionIrPct: number;
  retencionIvaPct: number;
}

export interface ItemPrefactura {
  orden: number;
  codigo: string | null;
  descripcion: string;
  unidad: string | null;
  serie: string | null;
  cantidad: number;
  precioUnitario: number;
  descuentoPct: number | null;
  precioTotal: number;
  tipo: 'Material' | 'Servicio';
  fuente: FuenteItem;
}

export interface FirmaPrefactura {
  id: string;
  firmanteTipo: FirmanteTipo;
  personaId: string | null;
  nombre: string;
  cargo: string | null;
  firmadoAt: string;
  archivoId: string;
  archivoNombre: string | null;
  verificacion: VerificacionFirma;
  /** 0..1; no es una probabilidad calibrada. */
  verificacionConfianza: number | null;
  verificacionAt: string | null;
  /** `null` = no se comparó el nombre. */
  nombreCoincide: boolean | null;
}

export interface RechazoPrefactura {
  at: string;
  motivo: string;
  devueltoA: DevueltoA;
}

export interface Prefactura {
  id: string;
  pedidoId: string;
  version: number;
  estado: EstadoPrefactura;
  ticketNumero: number | null;
  totales: TotalesPrefactura;
  tasas: TasasPrefactura;
  generadaAt: string;
  enviadaAt: string | null;
  medioEnvio: MedioEnvio | null;
  razonRetraso: string | null;
  firmadaAt: string | null;
  rechazo: RechazoPrefactura | null;
  items: ItemPrefactura[];
  advertencias: string[];
  firmas: FirmaPrefactura[];
}

export interface RegistrarFirmaRequest {
  firmanteTipo: FirmanteTipo;
  personaId?: string;
  nombre?: string;
  cargo?: string;
  firmadoAt: string;
  archivoId: string;
}

export const MODULO_ARCHIVO_PREFACTURA = 'prefactura_documento';
/** Módulo de `archivos` del documento que firma el Company Man y sube el Supervisor desde el ticket. */
export const MODULO_ARCHIVO_COMPANY_MAN = 'prefactura_company_man';

export const PERMISO_PREFACTURA_VISTA_TICKET = 'comercial.prefacturas.vista_ticket';
export const PERMISO_PREFACTURA_FIRMA_COMPANY_MAN = 'comercial.prefacturas.firma_company_man';

/** «Ver prefactura» desde el ticket: la vigente, o una preliminar calculada al vuelo (no se guarda), y el avance de la documentación. */
export interface VistaPrefacturaTicket {
  preliminar: boolean;
  prefactura: Pick<Prefactura, 'totales' | 'tasas' | 'items' | 'advertencias'> &
    Partial<Pick<Prefactura, 'id' | 'estado' | 'ticketNumero' | 'firmas'>>;
  avance: { completo: boolean; pendientes: string[] };
}

/** Cuerpo de `POST /pedidos/:pedidoId/prefactura/firma-company-man`: quién firmó, cuándo, y el archivo ya subido. */
export interface FirmaCompanyManEntrada {
  nombre: string;
  cargo?: string;
  firmadoAt: string;
  archivoId: string;
  razonRetraso?: string;
}
export const MAX_BYTES_FIRMA = 25 * 1024 * 1024;
export const MIN_MOTIVO_RECHAZO = 5;

/** Una fila del índice de prefacturas (`GET /comercial/prefacturas`): solo lo que muestra la lista. */
export interface PrefacturaFila {
  id: string;
  pedidoId: string;
  pedidoCodigo: string | null;
  clienteNombre: string | null;
  version: number;
  estado: EstadoPrefactura;
  ticketNumero: number | null;
  subtotal: number;
  netoCobrar: number;
  generadaAt: string;
  enviadaAt: string | null;
  firmadaAt: string | null;
}

export const ESTADO_PREFACTURA_LABELS: Record<EstadoPrefactura, string> = {
  generada: 'Generada',
  enviada_para_firmas: 'Enviada para firmas',
  firmada: 'Firmada',
  rechazada: 'Rechazada',
  anulada: 'Anulada',
};

export const ESTADO_PREFACTURA_TONO: Record<
  EstadoPrefactura,
  'brand' | 'info' | 'success' | 'error' | 'neutral'
> = {
  generada: 'brand',
  enviada_para_firmas: 'info',
  firmada: 'success',
  rechazada: 'error',
  anulada: 'neutral',
};

export const MEDIO_ENVIO_LABELS: Record<MedioEnvio, string> = {
  email: 'Correo electrónico',
  portal: 'Portal del cliente',
};
export const DEVUELTO_A_LABELS: Record<DevueltoA, string> = {
  ventas: 'Ventas',
  operaciones: 'Operaciones',
  facturacion: 'Facturación',
};
export const FIRMANTE_LABELS: Record<FirmanteTipo, string> = {
  company_man: 'Company man (representante de campo)',
  cliente: 'Cliente',
  dynadrill: 'Dynadrill',
};
export const VERIFICACION_LABELS: Record<VerificacionFirma, string> = {
  no_verificada: 'Sin verificar',
  firma_detectada: 'Firma detectada',
  firma_no_detectada: 'Firma no detectada',
  no_concluyente: 'No concluyente',
};
export const FUENTE_LABELS: Record<FuenteItem, string> = {
  herramienta: 'Herramienta',
  material: 'Material',
  personal: 'Personal',
  personal_manual: 'Personal (manual)',
};

const lab = <T extends string>(m: Record<T, string>, k: string | null | undefined): string =>
  k ? ((m as Record<string, string>)[k] ?? k) : '—';
export const etiquetaEstadoPrefactura = (e: string) => lab(ESTADO_PREFACTURA_LABELS, e);
export const etiquetaVerificacion = (v: string) => lab(VERIFICACION_LABELS, v);
export const etiquetaFuente = (f: string) => lab(FUENTE_LABELS, f);
export const etiquetaMedio = (m: string | null) => lab(MEDIO_ENVIO_LABELS, m);
export const etiquetaDevueltoA = (d: string) => lab(DEVUELTO_A_LABELS, d);
export const etiquetaFirmante = (f: string) => lab(FIRMANTE_LABELS, f);

/**
 * La hoja de impresión de la prefactura (DYN-AFN-RE-11) se dibuja con el modelo de la demo: aquí se arma con lo que el servidor devuelve
 * (la prefactura y el pedido). Solo lleva los campos que la hoja lee.
 */
export function aHojaPrefactura(
  pf: Prefactura,
  p: PedidoDetalle,
): { prefactura: unknown; pedido: unknown } {
  const firma = pf.firmas.find((f) => f.firmanteTipo === 'cliente') ?? pf.firmas[0] ?? null;
  return {
    prefactura: {
      code: pf.ticketNumero ? String(pf.ticketNumero) : `v${pf.version}`,
      fechaGeneracion: pf.generadaAt.slice(0, 10),
      subtotal: pf.totales.subtotal,
      firmaCliente: firma
        ? { nombre: firma.nombre, cargo: firma.cargo ?? '', firmadoAt: firma.firmadoAt }
        : undefined,
      items: pf.items.map((i) => ({
        id: i.orden,
        codigo: i.codigo ?? '',
        descripcion: i.descripcion,
        unidad: i.unidad ?? '',
        serie: i.serie ?? undefined,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        precioTotal: i.precioTotal,
        tipo: i.tipo,
        fuente: i.fuente,
      })),
    },
    pedido: {
      code: pf.ticketNumero ? String(pf.ticketNumero) : (p.codigo ?? ''),
      cliente: p.cliente.nombre ?? '',
      representanteCampo: p.responsables.representanteCampo.nombre ?? '',
      numeroContrato: p.numeroContrato ?? '',
      fechaInicioServicio: p.fechaInicioServicio?.slice(0, 10) ?? '',
      fechaFinServicio: p.fechaFinServicio?.slice(0, 10) ?? '',
      campo: p.ubicacion.campo ?? '',
      bloque: p.ubicacion.bloque ?? '',
      pozo: p.ubicacion.pozo ?? '',
      taladroRig: p.ubicacion.rigless ? 'RIGLESS' : (p.ubicacion.taladro ?? ''),
      solicitudMedio: p.administrativo.solicitudMedio ?? undefined,
      itemsEstimados: p.items.map((i) => ({
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        valorUnitario: i.valorUnitario,
      })),
    },
  };
}

export const AVISO_VERIFICACION =
  'La lectura automática es una ayuda para revisar; no certifica que la firma sea auténtica.';
/** Cada cuánto se consulta la prefactura mientras se espera el resultado, y hasta cuándo. */
export const INTERVALO_SONDEO_MS = 3000;
export const LIMITE_SONDEO_MS = 90_000;

export type ClaveVerificacion =
  'verificando' | 'sin_resultado' | 'no_se_pudo' | 'detectada' | 'no_detectada' | 'no_concluyente';

export interface EstadoVerificacion {
  clave: ClaveVerificacion;
  /** Texto principal (no depende solo del color). */
  texto: string;
  tono: 'info' | 'neutral' | 'warning' | 'success' | 'error';
  /** Detalle opcional: confianza y coincidencia del nombre. */
  detalle: string | null;
}

/**
 * Estado de la lectura automática de una firma. `sondeoAgotado` indica que ya se esperó el máximo sin resultado.
 * Es solo informativo: nunca condiciona ninguna acción de la prefactura.
 */
export function estadoVerificacion(
  f: Pick<
    FirmaPrefactura,
    'verificacion' | 'verificacionConfianza' | 'verificacionAt' | 'nombreCoincide'
  >,
  sondeoAgotado = false,
): EstadoVerificacion {
  if (f.verificacionAt === null || f.verificacionAt === undefined) {
    return sondeoAgotado
      ? {
          clave: 'sin_resultado',
          texto: 'Todavía sin resultado — use "Volver a verificar"',
          tono: 'neutral',
          detalle: null,
        }
      : { clave: 'verificando', texto: 'Verificando…', tono: 'info', detalle: null };
  }
  const conf =
    f.verificacionConfianza === null || f.verificacionConfianza === undefined
      ? null
      : `Confianza: ${Math.round(Math.min(1, Math.max(0, f.verificacionConfianza)) * 100)} %`;
  const nombre =
    f.nombreCoincide === true
      ? 'El nombre coincide'
      : f.nombreCoincide === false
        ? 'No se encontró el nombre esperado'
        : null;
  const detalle = [conf, nombre].filter(Boolean).join(' · ') || null;
  switch (f.verificacion) {
    case 'firma_detectada':
      return {
        clave: 'detectada',
        texto: 'Se detecta una firma — revise el documento',
        tono: 'success',
        detalle,
      };
    case 'firma_no_detectada':
      return {
        clave: 'no_detectada',
        texto: 'No se detecta firma manuscrita — revise el documento',
        tono: 'warning',
        detalle,
      };
    case 'no_concluyente':
      return {
        clave: 'no_concluyente',
        texto: 'No concluyente — revise a mano',
        tono: 'neutral',
        detalle,
      };
    default:
      return {
        clave: 'no_se_pudo',
        texto: 'No se pudo verificar (el servicio no respondió)',
        tono: 'neutral',
        detalle: null,
      };
  }
}

/** ¿Hay alguna firma esperando resultado? */
export const hayVerificacionPendiente = (
  firmas: readonly Pick<FirmaPrefactura, 'verificacionAt'>[],
): boolean => firmas.some((f) => f.verificacionAt === null || f.verificacionAt === undefined);

/** Se sigue consultando solo mientras haya resultados pendientes y no se haya pasado el límite. */
export function debeSondear(
  firmas: readonly Pick<FirmaPrefactura, 'verificacionAt'>[],
  inicioMs: number,
  ahoraMs: number,
  limiteMs = LIMITE_SONDEO_MS,
): boolean {
  return hayVerificacionPendiente(firmas) && ahoraMs - inicioMs < limiteMs;
}

/** Una prefactura está vigente mientras no esté rechazada ni anulada (solo hay una por pedido). */
export const esVigente = (p: Pick<Prefactura, 'estado'>): boolean =>
  p.estado !== 'rechazada' && p.estado !== 'anulada';

/** La prefactura a mostrar: la vigente o, si no hay, la más reciente (las versiones vienen de la más nueva a la más antigua). */
export function prefacturaActual<T extends Pick<Prefactura, 'estado'>>(
  versiones: readonly T[],
): T | null {
  return versiones.find(esVigente) ?? versiones[0] ?? null;
}

export type AccionPrefactura =
  'generar' | 'recalcular' | 'ticket' | 'enviar' | 'firma' | 'firmada' | 'rechazar';

/**
 * Acciones disponibles según el estado de la prefactura vigente (o su ausencia) y los permisos. El backend es la
 * autoridad y devuelve el error si algo no corresponde; esto solo evita ofrecer botones imposibles.
 */
export function accionesDisponibles(
  actual: Pick<Prefactura, 'estado' | 'firmas'> | null,
  can: (permiso: string) => boolean,
): AccionPrefactura[] {
  const acciones: AccionPrefactura[] = [];
  if (!actual || !esVigente(actual)) {
    if (can(PERMISOS_PREFACTURAS.generar)) acciones.push('generar');
    return acciones;
  }
  const generada = actual.estado === 'generada';
  const enviada = actual.estado === 'enviada_para_firmas';
  if (generada && can(PERMISOS_PREFACTURAS.generar)) acciones.push('recalcular');
  // El número de ticket de AS2 se registra en cualquier estado vigente (generada, enviada o firmada).
  if (can(PERMISOS_PREFACTURAS.generar)) acciones.push('ticket');
  if (generada && can(PERMISOS_PREFACTURAS.enviar)) acciones.push('enviar');
  // La firma del company man se toma en campo antes de enviar al cliente.
  if ((generada || enviada) && can(PERMISOS_PREFACTURAS.firmar)) acciones.push('firma');
  if (enviada && actual.firmas.length > 0 && can(PERMISOS_PREFACTURAS.firmar))
    acciones.push('firmada');
  if (enviada && can(PERMISOS_PREFACTURAS.rechazar)) acciones.push('rechazar');
  return acciones;
}

const ROTULOS_ACCION: Record<AccionPrefactura, string> = {
  generar: 'Generar prefactura',
  recalcular: 'Recalcular',
  ticket: 'Registrar número de ticket de AS2',
  enviar: 'Enviar al cliente',
  firma: 'Registrar firma',
  firmada: 'Dar por firmada',
  rechazar: 'Registrar rechazo',
};
export const rotuloAccion = (a: AccionPrefactura): string => ROTULOS_ACCION[a];

// ── Validaciones de los diálogos ──

/** Número de ticket: entero positivo, sin el prefijo PRC-. */
export function validarNumeroTicket(texto: string): { valor: number | null; error: string | null } {
  const t = texto.trim().replace(/^PRC-?/i, '');
  if (!/^\d+$/.test(t) || Number(t) <= 0)
    return { valor: null, error: 'Escriba un número entero mayor que cero (sin el prefijo PRC-).' };
  return { valor: Number(t), error: null };
}

export function validarMotivoRechazo(motivo: string, devueltoA: string | null): string | null {
  if (motivo.trim().length < MIN_MOTIVO_RECHAZO)
    return `El motivo debe tener al menos ${MIN_MOTIVO_RECHAZO} caracteres.`;
  if (!devueltoA) return 'Indique a quién se devuelve.';
  return null;
}

export interface BorradorFirma {
  firmanteTipo: FirmanteTipo | null;
  /** Representante de campo del pedido (solo aplica al company man). */
  personaIdRepresentante: string | null;
  nombre: string;
  cargo: string;
  firmadoAt: string | null;
  archivo: { name: string; size: number; type: string } | null;
}

/** Mensaje del primer problema de la firma o `null` si está lista para registrar. */
export function validarFirma(b: BorradorFirma, hoy: string): string | null {
  if (!b.firmanteTipo) return 'Elija quién firma.';
  const usaPersona = b.firmanteTipo === 'company_man' && !!b.personaIdRepresentante;
  if (b.firmanteTipo === 'company_man' && !b.personaIdRepresentante && !b.nombre.trim()) {
    return 'El pedido no tiene representante de campo asignado: escriba el nombre del company man.';
  }
  if (!usaPersona && !b.nombre.trim()) return 'Escriba el nombre de quien firma.';
  if (!b.firmadoAt) return 'Indique la fecha de la firma.';
  if (b.firmadoAt > hoy) return 'La fecha de la firma no puede ser futura.';
  if (!b.archivo) return 'Adjunte el documento firmado.';
  if (b.archivo.size <= 0) return 'El archivo está vacío.';
  if (b.archivo.size > MAX_BYTES_FIRMA) return 'El archivo supera el máximo de 25 MB.';
  const ext = b.archivo.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeOk = ['application/pdf', 'image/png', 'image/jpeg'].includes(b.archivo.type);
  const sinTipo = b.archivo.type === '' || b.archivo.type === 'application/octet-stream';
  if (!mimeOk && !(sinTipo && ['pdf', 'png', 'jpg', 'jpeg'].includes(ext)))
    return 'El documento firmado debe ser PDF, PNG o JPEG.';
  return null;
}

/** Cuerpo de `POST /prefacturas/:id/firmas`. */
export function armarFirma(b: BorradorFirma, archivoId: string): RegistrarFirmaRequest {
  const usaPersona = b.firmanteTipo === 'company_man' && !!b.personaIdRepresentante;
  const req: RegistrarFirmaRequest = {
    firmanteTipo: b.firmanteTipo as FirmanteTipo,
    firmadoAt: b.firmadoAt as string,
    archivoId,
  };
  if (usaPersona) req.personaId = b.personaIdRepresentante as string;
  else req.nombre = b.nombre.trim();
  if (b.cargo.trim()) req.cargo = b.cargo.trim();
  return req;
}

/** Mensaje de error del backend; en 422 de documentación incompleta se muestra lo que falta. */
export function mensajeErrorPrefactura(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: { message?: unknown; code?: string } } | null;
  const m = e?.error?.message;
  const texto = Array.isArray(m)
    ? m.filter((x) => typeof x === 'string').join('. ')
    : typeof m === 'string'
      ? m
      : '';
  if (e?.status === 422 && e.error?.code === 'DOCUMENTACION_INCOMPLETA')
    return texto || 'La documentación del pedido está incompleta.';
  if (e?.status === 409)
    return texto || 'La operación entra en conflicto con el estado actual de la prefactura.';
  return texto || porDefecto;
}
