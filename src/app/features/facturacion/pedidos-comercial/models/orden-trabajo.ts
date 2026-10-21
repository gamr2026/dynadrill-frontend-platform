import type { Aot } from '../../models/aot.model';

/** Orden de trabajo (OT) del contenedor `comercial` (`/api/comercial/pedidos/:id/orden-trabajo`) y cierre del pedido. */

export const PERMISOS_ORDENES = {
  ver: 'comercial.ordenes_trabajo.ver',
  emitir: 'comercial.ordenes_trabajo.emitir',
  firmar: 'comercial.ordenes_trabajo.firmar',
  cierre: 'comercial.cierre.gestionar',
} as const;

export const MODULO_ARCHIVO_ORDEN = 'orden_trabajo_documento';

export interface ItemOrdenTrabajo {
  orden: number;
  codigo: string | null;
  servicioRequerido: string;
  unidad: string | null;
  tarifaUnitaria: number;
  cantidad: number;
  total: number;
}

export interface OrdenTrabajo {
  id: string;
  pedidoId: string;
  prefacturaId: string;
  numero: number;
  /** `948-OPR-ESTACION NORTE 2-UIO-2026` */
  codigo: string;
  ciudad: { id: string; codigo: string; nombre: string };
  anio: number;
  fecha: string | null;
  numeroContrato: string | null;
  textoContrato: string | null;
  descripcionRequerimiento: string;
  servicio: string;
  fechaInicio: string | null;
  fechaTerminacion: string | null;
  valorOt: number;
  representanteContratista: { nombre: string; cargo: string };
  representanteCliente: { nombre: string; cargo: string };
  estado: 'generada' | 'firmada';
  generadaAt: string;
  firmada: { at: string; archivoId: string | null; archivoNombre: string | null } | null;
  items: ItemOrdenTrabajo[];
}

export interface OrdenDelPedido {
  /** El contrato del cliente exige la OT. */
  requiere: boolean;
  orden: OrdenTrabajo | null;
}

export interface CiudadOt {
  id: string;
  codigo: string;
  nombre: string;
}

export interface EmitirOrdenRequest {
  ciudadId?: string;
  descripcionRequerimiento?: string;
  representanteClienteNombre?: string;
  representanteClienteCargo?: string;
}

/** Estados del pedido en los que la sección de la OT tiene algo que mostrar o hacer (el cierre queda fuera del aplicativo). */
export const ESTADOS_ORDEN_Y_CIERRE = ['ticket_firmado', 'aot_generada', 'facturado'] as const;
export const muestraOrdenYCierre = (estado: string): boolean =>
  (ESTADOS_ORDEN_Y_CIERRE as readonly string[]).includes(estado);

/** La hoja de impresión de la OT ("Orden de trabajo — Resumen de costos") se dibuja con el modelo de la demo. */
export function aHojaAot(o: OrdenTrabajo): Aot {
  return {
    id: 0,
    pedidoId: 0,
    prefacturaId: 0,
    numeroOt: o.numero,
    ciudad: o.ciudad.codigo,
    numeroOpr: o.codigo,
    fecha: o.fecha ?? '',
    numeroContrato: o.numeroContrato ?? '',
    contratoTexto: o.textoContrato ?? '',
    descripcionRequerimiento: o.descripcionRequerimiento,
    servicio: o.servicio,
    fechaInicio: o.fechaInicio ?? '',
    fechaTerminacion: o.fechaTerminacion ?? '',
    detalle: o.items.map((i) => ({
      codigo: i.codigo ?? '',
      servicioRequerido: i.servicioRequerido,
      unidad: i.unidad ?? '',
      tarifaUnitaria: i.tarifaUnitaria,
      cantidad: i.cantidad,
      total: i.total,
    })),
    valorOt: o.valorOt,
    representanteContratista: o.representanteContratista,
    representanteCliente: o.representanteCliente,
    estado: o.estado,
    generadaAt: o.generadaAt,
  };
}

/** Lo único que queda por hacer tras la prefactura firmada: generar la OT, si el contrato la exige. */
export type PasoCierre = 'generar_orden' | null;

export function siguientePasoCierre(estado: string, requiereOrden: boolean): PasoCierre {
  return estado === 'ticket_firmado' && requiereOrden ? 'generar_orden' : null;
}

export const ROTULO_PASO: Record<Exclude<PasoCierre, null>, string> = {
  generar_orden: 'Generar orden de trabajo',
};

// ---- exportación a AS2 ------------------------------------------------------------------------------------------

export interface FilaAs2 {
  codigoProducto: string;
  codigoUnidad: string;
  cantidad: number;
  descripcion: string;
  precio: number;
  porcentajeDescuento: number;
}

export interface ExportacionAs2 {
  prefacturaId: string;
  ticketNumero: number | null;
  filas: FilaAs2[];
  advertencias: string[];
}

export const CABECERA_AS2 = [
  'Codigo Producto AS2',
  'Codigo Unidad AS2',
  'Cantidad',
  'Descripción',
  'Precio',
  'Porcentaje Descuento',
] as const;

const celda = (v: string | number): string => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV con las columnas de la plantilla "AS2 Prefactura Cliente" (con BOM para que Excel lea bien los acentos). */
export function csvAs2(filas: readonly FilaAs2[]): string {
  const lineas = [
    CABECERA_AS2.join(','),
    ...filas.map((f) =>
      [f.codigoProducto, f.codigoUnidad, f.cantidad, f.descripcion, f.precio, f.porcentajeDescuento]
        .map(celda)
        .join(','),
    ),
  ];
  return '﻿' + lineas.join('\r\n') + '\r\n';
}

export function mensajeErrorOrden(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: { message?: unknown; detail?: unknown } } | null;
  const m = e?.error?.detail ?? e?.error?.message;
  const texto = Array.isArray(m)
    ? m.filter((x) => typeof x === 'string').join('. ')
    : typeof m === 'string'
      ? m
      : '';
  if (e?.status === 409)
    return texto || 'La operación entra en conflicto con el estado actual del pedido.';
  return texto || porDefecto;
}
