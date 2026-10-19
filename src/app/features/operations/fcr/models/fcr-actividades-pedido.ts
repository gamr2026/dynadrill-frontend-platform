import type { ItemEstimado } from '../../../facturacion/models/pedido.model';
import type { AvisoPrecarga, FcrTool, MotivoAvisoPrecarga, MovilizacionPedido } from './fcr.model';

/**
 * "Actividades según el Pedido" en Preparación de Herramientas
 * (specs/fcr-precarga-herramientas): qué línea del Pedido trajo
 * herramientas para Bodega, cuál es movilización (solo informativa) y qué
 * queda como otros servicios. Cada línea aparece una sola vez, con su aviso
 * de la precarga al lado. Todo sale del Pedido y de la precarga del ticket.
 */
export interface LineaConAviso {
  item: ItemEstimado;
  aviso: MotivoAvisoPrecarga | null;
}

export interface ActividadesDelPedido {
  herramientas: (LineaConAviso & { cantidadHerramientas: number })[];
  movilizaciones: MovilizacionPedido[];
  otros: LineaConAviso[];
}

/** Etiqueta corta junto a cada línea. */
export const ETIQUETA_AVISO_PRECARGA: Record<MotivoAvisoPrecarga, string> = {
  pedido_sin_cliente: 'Pedido sin cliente',
  sin_configurar: 'Sin configurar',
  kit_vacio: 'Kit vacío',
  articulo_inactivo: 'Herramienta dada de baja',
  cantidad_excedida: 'Cantidad mayor al máximo',
};

/**
 * `movilizacionesTicket` es lo que guardó la precarga al crear el ticket; los
 * tickets anteriores no lo tienen y se usa lo que marca el Pedido.
 */
export function agruparActividadesDelPedido(
  items: ItemEstimado[],
  tools: FcrTool[],
  movilizacionesTicket: MovilizacionPedido[] | undefined,
  avisos: AvisoPrecarga[],
): ActividadesDelPedido {
  const porLinea = new Map<string, number>();
  for (const t of tools)
    if (t.codigoPedido) porLinea.set(t.codigoPedido, (porLinea.get(t.codigoPedido) ?? 0) + 1);
  const avisoPorLinea = new Map(avisos.filter((a) => a.codigo).map((a) => [a.codigo!, a.motivo]));

  const movilizaciones =
    movilizacionesTicket ??
    items
      .filter((i) => i.esMovilizacion)
      .map((i) => ({
        codigo: i.codigo,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        unidad: i.unidad,
      }));
  const codigosDeMovilizacion = new Set(movilizaciones.map((m) => m.codigo));

  const resultado: ActividadesDelPedido = { herramientas: [], movilizaciones, otros: [] };
  for (const item of items) {
    if (codigosDeMovilizacion.has(item.codigo)) continue;
    const aviso = avisoPorLinea.get(item.codigo) ?? null;
    const cantidadHerramientas = porLinea.get(item.codigo) ?? 0;
    if (cantidadHerramientas > 0)
      resultado.herramientas.push({ item, cantidadHerramientas, aviso });
    else resultado.otros.push({ item, aviso });
  }
  return resultado;
}

/** Una sola nota con qué hacer, en vez de repetir cada línea: el detalle ya va junto a la línea. */
export function notaPrecarga(avisos: AvisoPrecarga[]): string | null {
  if (avisos.some((a) => a.motivo === 'pedido_sin_cliente')) {
    return 'El Pedido no tiene un cliente del catálogo: no se pudieron precargar herramientas. Agréguelas a mano.';
  }
  const lineas = new Set(avisos.filter((a) => a.codigo).map((a) => a.codigo)).size;
  if (!lineas) return null;
  return `${lineas} línea(s) del Pedido no trajeron todas sus herramientas. Si llevan, agréguelas a mano o configure su código en "Códigos por cliente" y recargue.`;
}
