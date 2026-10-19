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
  | 'truck'
  | 'send'
  | 'clipboard';

/** Destino dentro de un módulo. Sin `link` = grupo que solo agrupa `children` (ej. QHSE › Planificación). */
export interface NavEntry {
  label: string;
  /** Etiqueta para la navegación inferior en móvil, cuando `label` no entra. */
  shortLabel?: string;
  link?: string;
  icon?: NavIcon;
  children?: NavEntry[];
  /** Permiso opcional: en un módulo «por permiso» el destino solo se muestra a quien lo tenga. */
  permission?: string;
  /** Alternativa a `permission`: basta con uno de estos permisos. */
  anyPermission?: string[];
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
  /** Código de permiso opcional: si se indica, el módulo solo se muestra a quien lo tenga (`AuthService.can`). */
  permission?: string;
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
