import { Injectable, computed, signal } from '@angular/core';
import type { DynadrillNotificationItem } from '@digitec-it-projects/dynadrill-ui';

export interface AppNotificationItem extends DynadrillNotificationItem {
  /** Ruta a la que navegar al hacer clic — la resuelve quien consume la campana (Header), no este servicio. */
  link?: string;
  /** Se ejecuta al abrir el aviso (antes de navegar): p. ej. marcarlo como leído en el servidor. */
  alAbrir?: () => void;
}

/**
 * Agregador genérico para la campana de notificaciones (dynadrill-ui
 * 0.12.0). El Header vive en el shell, que carga en TODAS las rutas
 * autenticadas — así que este servicio no puede depender de ningún
 * feature module (Mantenimiento, Pumping, etc.), o el bundle inicial
 * cargaría código de módulos que el usuario nunca visita.
 *
 * En cambio, cada feature module empuja sus propios avisos vía
 * `setSource(id, items)` cuando carga y recalcula sus datos — el Header
 * solo lee `items()`, ya fusionados. Hoy solo Mantenimiento alimenta la
 * campana (preventivos vencidos, reportes pendientes de clasificar,
 * sub-órdenes en revisión de cierre); cualquier módulo nuevo puede sumar
 * su propia fuente sin tocar este servicio ni el Header.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly sources = signal<Record<string, AppNotificationItem[]>>({});

  readonly items = computed(() => Object.values(this.sources()).flat());

  setSource(sourceId: string, items: AppNotificationItem[]): void {
    this.sources.update(current => ({ ...current, [sourceId]: items }));
  }

  clearSource(sourceId: string): void {
    this.sources.update(current => {
      const { [sourceId]: _removed, ...rest } = current;
      return rest;
    });
  }
}
