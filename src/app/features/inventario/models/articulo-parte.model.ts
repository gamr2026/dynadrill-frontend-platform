/**
 * Parte/componente del BOM de una herramienta (`Articulo` con
 * `categoria === 'HERRAMIENTAS'`). Espejo exacto de `ArticuloParte` en el
 * backend (`libs/domains/inventario/src/inventario.types.ts`).
 */
export interface ArticuloParte {
  id: number;
  articuloId: number;
  /** Posición secuencial dentro de la herramienta — la asigna el servidor. */
  orden: number;
  /** Etiqueta del ítem tal como aparece en el documento de origen (numérica, con sufijo o alfabética, ej. "1", "21*", "A"). */
  item: string;
  codigo: string;
  descripcion: string;
  cantidadEsperada: number;
}

export type CreateArticuloParteInput = Omit<ArticuloParte, 'id' | 'articuloId' | 'orden'>;
