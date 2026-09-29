import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

export interface DetailChromeMenuItem {
  label: string;
  action: () => void;
  /** Pinta el ítem en rojo (acción destructiva) — ej. "Anular pedido". */
  danger?: boolean;
}

export interface DetailChrome {
  title: string;
  /** Destino del botón "atrás". Sin definir, vuelve en el historial del navegador. */
  backLink?: string;
  /** Acciones del menú "⋮" (Nav/TopAppBar Type=Detail) — vacío/sin definir oculta el botón. */
  menuItems?: DetailChromeMenuItem[];
}

/**
 * Estado de la barra superior en móvil. En una pantalla de detalle la barra
 * pasa de "hamburguesa + logo + campana" a "← título" (Nav/TopAppBar
 * Type=Detail en Figma) y se oculta la navegación inferior, para dejarle el
 * borde inferior a las acciones de la propia pantalla.
 */
@Injectable({ providedIn: 'root' })
export class PageChromeService {
  readonly detail = signal<DetailChrome | null>(null);
}

/**
 * Marca la página actual como pantalla de detalle mientras esté montada.
 * Llamar desde el constructor (necesita contexto de inyección).
 */
export function useDetailChrome(title: () => string, backLink?: string, menuItems?: () => DetailChromeMenuItem[]): void {
  const chrome = inject(PageChromeService);
  effect(() => chrome.detail.set({ title: title(), backLink, menuItems: menuItems?.() }));
  inject(DestroyRef).onDestroy(() => chrome.detail.set(null));
}
