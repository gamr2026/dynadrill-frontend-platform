/**
 * Un lugar del catálogo de la plataforma: una bodega o un pozo (uno solo). Es lo que el backend nuevo guarda como origen y destino de un
 * traslado y como punto de partida y destino de una inspección: `bodegaId` o `pozoId`, nunca texto libre.
 */
export interface LugarSeleccion {
  bodegaId?: string;
  pozoId?: string;
}

/** Cómo devuelve el backend un lugar ya guardado. */
export interface LugarVista {
  tipo: 'bodega' | 'pozo';
  id: string;
  nombre: string;
}

/** Del lugar que devuelve el backend a la selección que se le envía de vuelta. */
export function aSeleccion(l: LugarVista | null | undefined): LugarSeleccion | null {
  if (!l) return null;
  return l.tipo === 'bodega' ? { bodegaId: l.id } : { pozoId: l.id };
}

/** Texto de un lugar para mostrarlo en pantalla. */
export function textoDeLugar(l: { nombre: string } | null | undefined): string {
  return l?.nombre ?? '—';
}
