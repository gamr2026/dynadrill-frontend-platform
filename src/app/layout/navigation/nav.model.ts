/** Íconos de la navegación — mismo set de línea que la librería de Figma (Components › Icons). */
export type NavIcon =
  | 'home'
  | 'modules'
  | 'tool'
  | 'shield'
  | 'box'
  | 'file-text'
  | 'users'
  | 'alert'
  | 'gauge'
  | 'check'
  | 'list'
  | 'route'
  | 'chart'
  | 'truck';

/** Destino dentro de un módulo. Sin `link` = grupo que solo agrupa `children` (ej. QHSE › Planificación). */
export interface NavEntry {
  label: string;
  link?: string;
  icon?: NavIcon;
  children?: NavEntry[];
}

/**
 * Módulo de primer nivel: lo que lista el drawer móvil y el sidebar de
 * escritorio. Sus `children` son los destinos de la navegación inferior
 * contextual en móvil. Sin `children` el módulo navega directo a `link`.
 */
export interface NavModule {
  key: string;
  label: string;
  icon: NavIcon;
  link?: string;
  children?: NavEntry[];
}

/** Primer link navegable de una entrada (una entrada-grupo navega a su primer hijo). */
export function firstLink(entry: NavEntry | NavModule): string | undefined {
  if (entry.link) return entry.link;
  for (const child of entry.children ?? []) {
    const link = firstLink(child);
    if (link) return link;
  }
  return undefined;
}

/** Todos los links alcanzables desde una entrada, incluida ella misma. */
export function allLinks(entry: NavEntry | NavModule): string[] {
  return [...(entry.link ? [entry.link] : []), ...(entry.children ?? []).flatMap(allLinks)];
}
