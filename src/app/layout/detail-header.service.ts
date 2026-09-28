import { Injectable, signal } from '@angular/core';

export interface DetailHeaderMenuItem {
  label: string;
  action: () => void;
  /** Pinta el ítem en rojo (acción destructiva) — ej. "Anular pedido". */
  danger?: boolean;
}

export interface DetailHeaderConfig {
  /** Título compacto de la barra — normalmente el mismo texto que el `title` del dynadrill-screen-header de la página. */
  title: string;
  /** Ruta a la que vuelve la flecha "atrás". Sin definir, usa el historial del navegador. */
  backLink?: string;
  /** Acciones del menú "⋮" — vacío/sin definir oculta el botón. */
  menuItems?: DetailHeaderMenuItem[];
}

/**
 * Estado de la barra superior "Detail" (Figma Nav/TopAppBar: volver + título +
 * overflow) — solo móvil, ver header.html/scss. Reemplaza a la barra "Home"
 * (hamburguesa + logo + campana) en páginas de detalle. Cada página de
 * detalle llama `set()` en su constructor (recalculando el título si
 * depende de datos que llegan async) y `clear()` al destruirse.
 */
@Injectable({ providedIn: 'root' })
export class DetailHeaderService {
  readonly config = signal<DetailHeaderConfig | null>(null);

  set(config: DetailHeaderConfig): void {
    this.config.set(config);
  }

  clear(): void {
    this.config.set(null);
  }
}
