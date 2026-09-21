/**
 * Módulo Inventario — cubre solo lo que físicamente se guarda y se le
 * lleva stock (herramientas, químicos, insumos de trabajo en Pumping).
 * El catálogo de origen (export de un sistema externo) trae también
 * líneas de "Servicio" (día de renta, movilización, Lump Sum) — esas son
 * conceptos de facturación/cotización, no inventario, y quedan fuera de
 * este módulo a propósito.
 */
export interface Articulo {
  id: number;
  codigo: string;
  codigoAlterno?: string;
  codigoComercial?: string;
  codigoBarras?: string;
  nombre: string;
  nombreComercial?: string;
  /**
   * Categoría/subcategoría se dejan como texto libre, igual que en el
   * catálogo de origen — la variedad real de categorías es mucho mayor
   * que la de cualquier muestra, así que no se hardcodea un enum cerrado.
   */
  categoria: string;
  subcategoria: string;
  unidadStock: string;
  nota?: string;
  activo: boolean;
  informacionAdicional?: string;
  /** Costo interno Dynadrill (no es precio de venta) — referencia para Ventas cuando el código no está aún en la Lista de Precios del cliente. */
  costoUnitario?: number;
  /** % de descuento sugerido a nivel general (no por cliente), de la Lista de Descuentos de Dynadrill. */
  descuentoSugerido?: number;
  /** Calculado a partir de los movimientos de kardex — nunca se edita directo. */
  stockActual: number;
}

export type CreateArticuloInput = Omit<Articulo, 'id' | 'stockActual'>;

export type MovimientoTipo = 'entrada' | 'salida';

export const MOVIMIENTO_TIPO_LABELS: Record<MovimientoTipo, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
};

/** Kardex — un renglón por movimiento, con el saldo resultante ya calculado (trazabilidad histórica). */
export interface MovimientoInventario {
  id: number;
  articuloId: number;
  tipo: MovimientoTipo;
  cantidad: number;
  fecha: string;
  motivo: string;
  responsable: string;
  saldoResultante: number;
}

export type CreateMovimientoInput = Pick<MovimientoInventario, 'articuloId' | 'tipo' | 'cantidad' | 'fecha' | 'motivo' | 'responsable'>;
