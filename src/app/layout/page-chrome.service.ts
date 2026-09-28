import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

export interface DetailChrome {
  title: string;
  /** Destino del botón "atrás". */
  backLink: string;
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
export function useDetailChrome(title: () => string, backLink: string): void {
  const chrome = inject(PageChromeService);
  effect(() => chrome.detail.set({ title: title(), backLink }));
  inject(DestroyRef).onDestroy(() => chrome.detail.set(null));
}
