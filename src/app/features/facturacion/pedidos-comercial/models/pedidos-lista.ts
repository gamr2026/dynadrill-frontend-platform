import { MACRO_ESTADO_TONE, type MacroEstadoTone } from '../../../../shared/models/timeline.model';
import type { KpiStatTone } from '../../../../shared/components/kpi-stat/kpi-stat';
import {
  LINEA_SERVICIO_LABELS,
  ORIGEN_LABELS,
  type EstadoCatalogo,
  type LineaServicio,
  type OrigenPedido,
  type PedidoResumen,
} from './pedido-comercial.model';

/** Filtros de la lista de pedidos (se aplican en pantalla, como en la demo). */
export interface FiltrosListaPedidos {
  busqueda: string;
  linea: LineaServicio | null;
  estado: string | null;
  origen: OrigenPedido | null;
}

export type TonoDias = 'success' | 'warning' | 'error' | 'neutral';

/** Fila de la tabla (escritorio) y de la tarjeta (móvil) de la lista de pedidos (`type`: la tabla pide filas indexables). */
export type FilaPedido = {
  id: string;
  code: string;
  cliente: string;
  linea: string;
  ubicacion: string;
  origen: string;
  estimado: string;
  diasBadge: { text: string; tone: TonoDias };
  estadoBadge: { text: string; tone: MacroEstadoTone };
  dias: string;
  diasTono: TonoDias;
  estadoTexto: string;
  estadoTono: MacroEstadoTone;
  editable: boolean;
};

export interface KpiPedidos {
  value: number;
  label: string;
  caption: string;
  tone: KpiStatTone;
}

/** Estados en los que el pedido ya tiene el ticket firmado o la OT generada (tarjeta "Firmados / con OT"). */
const ESTADOS_FIRMADOS = ['ticket_firmado', 'aot_generada'];
const ESTADOS_NO_EDITABLES = ['anulado', 'facturado'];

/** Días enteros desde el fin del servicio hasta hoy; `null` si el pedido aún no tiene fecha de fin. */
export function diasDesdeFin(fechaFin: string | null, hoy: Date = new Date()): number | null {
  if (!fechaFin) return null;
  const fin = new Date(fechaFin + 'T00:00:00');
  const inicioDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.max(0, Math.round((inicioDeHoy.getTime() - fin.getTime()) / 86_400_000));
}

/** Mismo semáforo que la demo: hasta 3 días en verde, hasta 7 en amarillo, después en rojo. */
export function tonoDias(dias: number | null): TonoDias {
  if (dias === null) return 'neutral';
  return dias <= 3 ? 'success' : dias <= 7 ? 'warning' : 'error';
}

const ubicacionDe = (p: PedidoResumen) => [p.campoNombre, p.pozoNombre].filter(Boolean).join(' — ') || '—';
const lineaDe = (p: PedidoResumen) => (p.lineaServicio ? LINEA_SERVICIO_LABELS[p.lineaServicio] : '—');

/** Filtra por línea, estado, origen y texto, y ordena del más reciente al más antiguo. */
export function filtrarPedidos(pedidos: PedidoResumen[], f: FiltrosListaPedidos): PedidoResumen[] {
  const q = f.busqueda.trim().toLowerCase();
  return pedidos
    .filter(
      (p) =>
        (!f.linea || p.lineaServicio === f.linea) &&
        (!f.estado || p.estado === f.estado) &&
        (!f.origen || p.origen === f.origen) &&
        (!q ||
          [p.codigo, p.as2Numero, p.clienteNombre, p.campoNombre, p.pozoNombre, lineaDe(p)].some((v) =>
            (v ?? '').toLowerCase().includes(q),
          )),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Convierte un pedido en la fila que pintan la tabla y la tarjeta móvil de la demo. */
export function filaPedido(p: PedidoResumen, puedeEditar: boolean, hoy: Date = new Date()): FilaPedido {
  const dias = diasDesdeFin(p.fechaFinServicio, hoy);
  const diasTono = tonoDias(dias);
  const diasTexto = dias === null ? '—' : `${dias} d`;
  const estadoTono = MACRO_ESTADO_TONE[p.macroEstado] ?? 'neutral';
  return {
    id: p.id,
    code: p.codigo ?? 'Sin código',
    cliente: p.clienteNombre ?? '—',
    linea: lineaDe(p),
    ubicacion: ubicacionDe(p),
    origen: (ORIGEN_LABELS[p.origen] ?? p.origen).toUpperCase(),
    estimado: '$' + p.valorEstimado.toFixed(2),
    diasBadge: { text: diasTexto, tone: diasTono },
    estadoBadge: { text: p.estadoNombre, tone: estadoTono },
    dias: diasTexto,
    diasTono,
    estadoTexto: p.estadoNombre,
    estadoTono,
    editable: puedeEditar && !ESTADOS_NO_EDITABLES.includes(p.estado),
  };
}

/** Las cuatro tarjetas de la demo; "En proceso" son los pedidos en un estado no terminal del catálogo. */
export function kpisPedidos(pedidos: PedidoResumen[], estados: EstadoCatalogo[]): KpiPedidos[] {
  const terminales = new Set(estados.filter((e) => e.terminal).map((e) => e.codigo));
  return [
    { value: pedidos.length, label: 'Pedidos', caption: 'Pedidos registrados', tone: 'neutral' },
    {
      value: pedidos.filter((p) => !terminales.has(p.estado)).length,
      label: 'En proceso',
      caption: 'Requieren seguimiento',
      tone: 'brand',
    },
    {
      value: pedidos.filter((p) => ESTADOS_FIRMADOS.includes(p.estado)).length,
      label: 'Firmados / con OT',
      caption: 'Listos para continuar',
      tone: 'success',
    },
    {
      value: pedidos.filter((p) => p.origen === 'as2').length,
      label: 'Origen AS2',
      caption: 'Sincronizados desde AS2',
      tone: 'neutral',
    },
  ];
}

/** Chips de los filtros activos (móvil): tocar uno lo quita. */
export function chipsFiltros(
  f: Pick<FiltrosListaPedidos, 'linea' | 'estado' | 'origen'>,
  estados: EstadoCatalogo[],
): { key: 'linea' | 'estado' | 'origen'; label: string }[] {
  const chips: { key: 'linea' | 'estado' | 'origen'; label: string }[] = [];
  if (f.linea) chips.push({ key: 'linea', label: `Línea: ${LINEA_SERVICIO_LABELS[f.linea]}` });
  if (f.estado) {
    const nombre = estados.find((e) => e.codigo === f.estado)?.nombre ?? f.estado;
    chips.push({ key: 'estado', label: `Estado: ${nombre}` });
  }
  if (f.origen) chips.push({ key: 'origen', label: `Origen: ${ORIGEN_LABELS[f.origen]}` });
  return chips;
}
