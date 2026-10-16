/**
 * Modelos del backend nuevo de Inventario (`/api/operaciones/inventario`, ids UUID). Los nombres de categorías, unidades,
 * bodegas y responsables llegan resueltos (JOIN) junto con su id: la pantalla nunca guarda copias del nombre.
 * El `articulo.model.ts` de la demo (ids numéricos, categoría como texto) sigue en uso por las pantallas que aún no migran.
 */

export interface CategoriaArticuloRef {
  id: string;
  nombre: string;
  esQuimica: boolean;
  /** Las herramientas de la categoría llevan lista de partes. */
  llevaPartes: boolean;
}

export interface SubcategoriaRef {
  id: string;
  nombre: string;
}

export interface UnidadStockRef {
  id: string;
  nombre: string;
  simbolo: string;
}

export interface CodigosArticulo {
  alterno: string | null;
  comercial: string | null;
  barras: string | null;
}

export interface ArticuloInventario {
  id: string;
  codigo: string;
  nombre: string;
  nombreComercial: string | null;
  categoria: CategoriaArticuloRef;
  subcategoria: SubcategoriaRef | null;
  unidadStock: UnidadStockRef;
  codigos: CodigosArticulo;
  nota: string | null;
  informacionAdicional: string | null;
  /** Costo interno de Dynadrill (no es precio de venta). */
  costoUnitario: number | null;
  /** % de descuento sugerido a nivel general (no por cliente). */
  descuentoSugerido: number | null;
  activo: boolean;
  /** Calculado del kardex: nunca se edita. */
  stockActual: number;
}

export interface StockPorBodega {
  bodegaId: string;
  bodega: string;
  stock: number;
}

export interface ArticuloInventarioDetalle extends ArticuloInventario {
  stockPorBodega: StockPorBodega[];
}

export interface FiltroArticulos {
  q?: string;
  categoriaId?: string;
  subcategoriaId?: string;
  activo?: boolean;
  conStock?: boolean;
  quimicos?: boolean;
}

/** Alta de artículo. El código es el de AS2 y no se puede cambiar después. */
export interface CrearArticuloInput {
  codigo: string;
  nombre: string;
  nombreComercial?: string;
  categoriaId: string;
  subcategoriaId?: string;
  unidadStockId: string;
  nota?: string;
  informacionAdicional?: string;
  costoUnitario?: number;
  descuentoSugerido?: number;
  activo?: boolean;
  /** Cadena vacía quita el código. */
  codigos?: { alterno?: string; comercial?: string; barras?: string };
}

/** Edición: todo opcional; `null` quita la subcategoría, el costo o el descuento. */
export type ActualizarArticuloInput = Partial<
  Omit<CrearArticuloInput, 'codigo' | 'subcategoriaId' | 'costoUnitario' | 'descuentoSugerido'>
> & {
  subcategoriaId?: string | null;
  costoUnitario?: number | null;
  descuentoSugerido?: number | null;
};

export interface CategoriaInventario extends CategoriaArticuloRef {
  activo: boolean;
  subcategorias: Array<SubcategoriaRef & { activo: boolean }>;
}

export interface UnidadStockInventario extends UnidadStockRef {
  activo: boolean;
}

export type TipoMovimiento = 'entrada' | 'salida';

export type OrigenMovimiento =
  | 'saldo_inicial'
  | 'compra'
  | 'ajuste'
  | 'despacho_bodega'
  | 'salida_ticket'
  | 'devolucion_ticket';

export const MOVIMIENTO_TIPO_LABELS: Record<TipoMovimiento, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
};

/** Motivo de movimiento: fija el tipo (entrada o salida) y el origen. Los `manual` son los que Bodega puede elegir. */
export interface MotivoMovimiento {
  id: string;
  nombre: string;
  tipo: TipoMovimiento;
  origen: OrigenMovimiento;
  manual: boolean;
}

export interface BodegaInventario {
  id: string;
  nombre: string;
}

/** Renglón del kardex (inmutable), con el saldo del artículo en esa bodega justo después del movimiento. */
export interface MovimientoKardex {
  id: string;
  secuencia: number;
  articuloId: string;
  bodega: { id: string; nombre: string };
  tipo: TipoMovimiento;
  origen: OrigenMovimiento;
  motivo: { id: string; nombre: string };
  cantidad: number;
  saldoResultante: number;
  fecha: string;
  observacion: string | null;
  responsable: { id: string; nombre: string };
  pedidoId: string | null;
  ticketId: string | null;
}

export interface RegistrarMovimientoInput {
  articuloId: string;
  bodegaId: string;
  motivoId: string;
  cantidad: number;
  observacion?: string;
}

export interface ParteArticulo {
  id: string;
  articuloId: string;
  /** Posición dentro de la herramienta: la asigna el servidor. */
  orden: number;
  /** Etiqueta del ítem tal como aparece en el documento de origen ("1", "21*", "A"). */
  item: string;
  codigo: string;
  descripcion: string;
  cantidadEsperada: number;
}

export type ParteArticuloInput = Pick<ParteArticulo, 'item' | 'codigo' | 'descripcion'> & { cantidadEsperada?: number };

/** Mensaje para quien usa la pantalla: el del servidor si lo trae (409, 400 con detalle), o el genérico. */
export function mensajeErrorInventario(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; error?: { message?: unknown; detail?: unknown } } | null;
  const m = e?.error?.detail ?? e?.error?.message;
  if (Array.isArray(m)) return m.join('. ');
  if (typeof m === 'string' && m.trim() && (e?.status ?? 0) < 500) return m;
  if (e?.status === 403) return 'No tiene permiso para esta acción.';
  return porDefecto;
}

/** Cantidad con hasta 3 decimales, como la guarda el kardex. */
export function formatearCantidad(n: number): string {
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits: 3 }).format(n);
}
