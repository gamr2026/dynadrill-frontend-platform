/**
 * Qué hace FCR con cada código que Ventas cotiza a un cliente
 * (specs/fcr-precarga-herramientas). Espejo de
 * `fcr-configuracion-codigos.service.ts` del backend: 'herramienta' se
 * expande en su kit al crear el ticket y 'servicio' no genera nada. Un código
 * sin configurar se trata como 'servicio'. La movilización no es una clase
 * acá: la marca el Pedido con el tipo de línea "Movilización" (una sola fuente).
 */

export const CLASES_OPERATIVAS = ['herramienta', 'servicio'] as const;
export type ClaseOperativa = (typeof CLASES_OPERATIVAS)[number];

export const CLASE_OPERATIVA_LABELS: Record<ClaseOperativa, string> = {
  herramienta: 'Herramienta',
  servicio: 'Servicio',
};

export const CLASE_OPERATIVA_DESCRIPCIONES: Record<ClaseOperativa, string> = {
  herramienta: 'Se pide a Bodega: el ticket nace con las herramientas de su kit.',
  servicio: 'No genera nada en el ticket (personal, renta, Lump Sum…). La movilización se marca en el Pedido.',
};

export interface KitItem {
  /** Articulo de Inventario, categoría HERRAMIENTAS (tiene BOM para el checklist). */
  articuloId: number;
  cantidad: number;
}

/** Un código de la Lista de Precios del cliente (sin precio) junto con su configuración. */
export interface CodigoClienteFcr {
  codigo: string;
  descripcion: string;
  unidad: string;
  /** `false` = configuración huérfana: el código ya no está en ninguna lista activa del cliente. */
  enListaPrecios: boolean;
  /** `null` = sin configurar. */
  id: number | null;
  clase: ClaseOperativa | null;
  kit: KitItem[];
}

export interface GuardarConfiguracionCodigoInput {
  clienteId: number;
  codigo: string;
  clase: ClaseOperativa;
  kit?: KitItem[];
}

export type FiltroCodigos = 'todos' | 'sin_configurar' | ClaseOperativa | 'huerfanos';

export function filtrarCodigos(filas: CodigoClienteFcr[], filtro: FiltroCodigos, busqueda: string): CodigoClienteFcr[] {
  const q = busqueda.trim().toLowerCase();
  return filas.filter(f => cumpleFiltro(f, filtro) && (!q || f.codigo.toLowerCase().includes(q) || f.descripcion.toLowerCase().includes(q)));
}

function cumpleFiltro(fila: CodigoClienteFcr, filtro: FiltroCodigos): boolean {
  switch (filtro) {
    case 'todos':
      return true;
    case 'sin_configurar':
      return fila.clase === null;
    case 'huerfanos':
      return !fila.enListaPrecios;
    default:
      return fila.clase === filtro;
  }
}

/** "Casing scraper 7" ×1 · Cepillo ×2" — `nombres` es el catálogo activo de HERRAMIENTAS por id. */
export function resumenKit(kit: KitItem[], nombres: ReadonlyMap<number, string>): string {
  return kit.map(k => `${nombres.get(k.articuloId) ?? `Artículo #${k.articuloId} (inactivo)`} ×${k.cantidad}`).join(' · ');
}

/** Fila del editor de kit mientras se edita: la herramienta puede no estar elegida todavía. */
export interface KitItemBorrador {
  articuloId: number | null;
  cantidad: number;
}

/** Mismas reglas que valida el backend, para avisar antes de guardar. `null` = válido. */
export function errorDelKit(kit: KitItemBorrador[]): string | null {
  if (kit.some(k => k.articuloId === null)) return 'Elija la herramienta de cada fila.';
  if (kit.some(k => !Number.isInteger(k.cantidad) || k.cantidad < 1)) return 'La cantidad debe ser un número entero de 1 o más.';
  const ids = kit.map(k => k.articuloId);
  if (new Set(ids).size !== ids.length) return 'Una herramienta aparece dos veces: use una sola fila con la cantidad total.';
  return null;
}
