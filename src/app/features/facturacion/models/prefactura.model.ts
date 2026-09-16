/**
 * Fase 0 — Prefactura (= "Ticket" de Facturación).
 *
 * NO se teclea: se **arma** cruzando el Reporte de Herramientas (días
 * O/S/D + series) con la Lista de Precios del cliente (tarifa + tipo), más
 * el consumo de materiales y las hojas de tiempo. "Nada sale inventado".
 *
 * Formato de impresión: `DYN-AFN-RE-11B`. Alcance del app: hasta enviar al
 * cliente y registrar su firma o rechazo.
 */

import type { ListaPreciosItem, TipoItem } from './lista-precios.model';
import type { OperativoToolRef, OperativoToolUsageEntry } from '../../../shared/models/operativo-docs.model';

/** De dónde salió cada línea de la prefactura. */
export type FuenteItem = 'htas' | 'material' | 'personal' | 'cambio_alcance';

export interface PrefacturaItem {
  id: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  serie?: string;
  cantidad: number;
  precioUnitario: number;
  precioTotal: number;
  tipo: TipoItem;
  fuente: FuenteItem;
}

export type EstadoPrefactura = 'borrador' | 'en_revision' | 'generada' | 'enviada_para_firmas' | 'firmada' | 'rechazada';

export interface EnvioCliente {
  enviadoAt: string;
  medio: string;
  /** Nombres de archivo simulados del paquete (Ticket + Job + Htas + BHA/gráficos/OpenWells). */
  adjuntos: string[];
}

export interface FirmaCliente {
  nombre: string;
  cargo: string;
  firmadoAt: string;
}

export interface RechazoCliente {
  motivo: string;
  /** Ej. "el cliente se fue de vacaciones" — la automatización no garantiza que firme más rápido. */
  razonRetraso?: string;
  fecha: string;
  itemsObservados?: string[];
  /** Persona a la que se devuelve la corrección — se le hace seguimiento aunque cambie de pozo. */
  devueltoA: string;
  seguimiento?: string;
}

export interface Prefactura {
  id: number;
  code: string;
  pedidoId: number;
  items: PrefacturaItem[];
  subtotalServicios: number;
  subtotalMateriales: number;
  subtotal: number;
  /** IVA 15% (vigente en Ecuador desde 2024). */
  iva: number;
  retencionIR: number;
  retencionIVA: number;
  netoCobrar: number;
  estado: EstadoPrefactura;
  envioCliente?: EnvioCliente;
  firmaCliente?: FirmaCliente;
  rechazoCliente?: RechazoCliente;
  fechaGeneracion: string;
  /** Quién generó esta versión de la prefactura — "Firma electrónica autorizada por Dynadrill" en el PDF. */
  generadoPor?: string;
  /** Por qué `netoCobrar` dio $0 (o `items` vino vacío) — sin Lista de Precios del cliente, o códigos del pedido sin match. */
  advertencia?: string;
}

export type CreatePrefacturaInput = Pick<Prefactura, 'pedidoId' | 'items'>;

const IVA_RATE = 0.15;
const RETENCION_IR_RATE = 0.01;
/** 30% para servicios entre contribuyentes especiales — mismo % de la plantilla real. */
const RETENCION_IVA_RATE = 0.3;

/** Entrada para armar la prefactura — un subconjunto de `DocumentoOperativo`. */
export interface DocParaPrefactura {
  tipo: 'reporte_job' | 'reporte_herramientas';
  fechasJob?: string[];
  herramientas?: OperativoToolRef[];
  usoHerramientas?: OperativoToolUsageEntry[];
}

/**
 * Arma las líneas de la prefactura cruzando el Reporte de Herramientas
 * (días O/S/D + series) con la Lista de Precios (tarifa + tipo), más un
 * cargo de personal por los días de Reporte Job. "Nada sale inventado".
 */
export function armarPrefacturaItems(
  itemEstimadoCodigo: string,
  docs: DocParaPrefactura[],
  lp: ListaPreciosItem[],
): PrefacturaItem[] {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const lpByCodigo = new Map(lp.map(i => [i.codigo, i]));
  const items: PrefacturaItem[] = [];
  let id = 1;

  // ── Herramientas ──
  const herramientas = new Map<number, OperativoToolRef>();
  const usos: OperativoToolUsageEntry[] = [];
  for (const d of docs.filter(d => d.tipo === 'reporte_herramientas')) {
    for (const h of d.herramientas ?? []) herramientas.set(h.id, h);
    usos.push(...(d.usoHerramientas ?? []));
  }
  for (const h of herramientas.values()) {
    const lpItem = h.codigo ? lpByCodigo.get(h.codigo) : undefined;
    if (!lpItem) continue;
    const dias = usos.filter(u => u.toolId === h.id);
    const rentaN = dias.filter(u => u.status === 'operacion' || u.status === 'daily_charge' || u.status === 'stand_by').length;
    const ventaN = dias.filter(u => u.status === 'venta').length;
    if (rentaN > 0) {
      items.push({
        id: id++,
        codigo: lpItem.codigo,
        descripcion: lpItem.descripcion,
        unidad: lpItem.unidad,
        serie: h.serialCode,
        cantidad: rentaN,
        precioUnitario: lpItem.precio,
        precioTotal: round2(rentaN * lpItem.precio),
        tipo: lpItem.tipo,
        fuente: 'htas',
      });
    }
    if (ventaN > 0) {
      items.push({
        id: id++,
        codigo: lpItem.codigo,
        descripcion: lpItem.descripcion,
        unidad: 'unidad',
        serie: h.serialCode,
        cantidad: ventaN,
        precioUnitario: lpItem.precio,
        precioTotal: round2(ventaN * lpItem.precio),
        tipo: lpItem.tipo === 'Material' ? 'Material' : lpItem.tipo,
        fuente: lpItem.tipo === 'Material' ? 'material' : 'htas',
      });
    }
  }

  // ── Personal (días de Reporte Job) ──
  const diasJob = new Set(docs.filter(d => d.tipo === 'reporte_job').flatMap(d => d.fechasJob ?? [])).size;
  const lpPersonal = lpByCodigo.get(itemEstimadoCodigo);
  if (diasJob > 0 && lpPersonal) {
    items.push({
      id: id++,
      codigo: lpPersonal.codigo,
      descripcion: lpPersonal.descripcion,
      unidad: lpPersonal.unidad,
      cantidad: diasJob,
      precioUnitario: lpPersonal.precio,
      precioTotal: round2(diasJob * lpPersonal.precio),
      tipo: lpPersonal.tipo,
      fuente: 'personal',
    });
  }

  return items;
}

export function prefacturaSubtotales(items: PrefacturaItem[]): {
  servicios: number;
  materiales: number;
  subtotal: number;
  iva: number;
  retencionIR: number;
  retencionIVA: number;
  netoCobrar: number;
} {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const servicios = round2(items.filter(i => i.tipo === 'Servicio').reduce((s, i) => s + i.precioTotal, 0));
  const materiales = round2(items.filter(i => i.tipo === 'Material').reduce((s, i) => s + i.precioTotal, 0));
  const subtotal = round2(servicios + materiales);
  const iva = round2(subtotal * IVA_RATE);
  const retencionIR = round2(subtotal * RETENCION_IR_RATE);
  const retencionIVA = round2(iva * RETENCION_IVA_RATE);
  const netoCobrar = round2(subtotal + iva - retencionIR - retencionIVA);
  return { servicios, materiales, subtotal, iva, retencionIR, retencionIVA, netoCobrar };
}
