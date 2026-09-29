import { Signal, computed, signal } from '@angular/core';

export interface Pagination<T> {
  /** Página actual (1-based), acotada al total: si la lista se achica no queda en una página vacía. */
  readonly page: Signal<number>;
  readonly totalPages: Signal<number>;
  readonly pageItems: Signal<T[]>;
  /** Total de ítems antes de paginar. */
  readonly total: Signal<number>;
  /** Rango visible de la página actual, 1-based (`{ from: 0, to: 0 }` si no hay ítems). */
  readonly range: Signal<{ from: number; to: number }>;
  goTo(page: number): void;
  reset(): void;
}

/** Paginación en memoria para las listas de tarjetas en móvil (la tabla de escritorio pagina sola). */
export function createPagination<T>(items: Signal<T[]>, pageSize: number): Pagination<T> {
  const requested = signal(1);
  const totalPages = computed(() => Math.max(1, Math.ceil(items().length / pageSize)));
  const page = computed(() => Math.min(requested(), totalPages()));
  return {
    page,
    totalPages,
    pageItems: computed(() => items().slice((page() - 1) * pageSize, page() * pageSize)),
    total: computed(() => items().length),
    range: computed(() => {
      const total = items().length;
      if (!total) return { from: 0, to: 0 };
      const from = (page() - 1) * pageSize + 1;
      return { from, to: Math.min(from + pageSize - 1, total) };
    }),
    goTo: target => requested.set(target),
    reset: () => requested.set(1),
  };
}

/** Un botón del paginador numerado: un número de página o un salto ("…"). */
export type PageWindowItem = number | 'ellipsis';

/**
 * Páginas a mostrar en un paginador numerado: siempre la primera y la última,
 * la actual con `siblings` vecinas a cada lado, y "…" donde se saltan páginas
 * (ej. 1 … 4 5 6 … 50). Si "…" taparía una sola página, se muestra la página.
 */
export function pageWindow(page: number, totalPages: number, siblings = 1): PageWindowItem[] {
  if (totalPages <= 0) return [];
  // Primera + última + actual con vecinas + dos "…" = 5 + 2×siblings botones: si caben todas, no se abrevia.
  if (totalPages <= 5 + 2 * siblings) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages]);
  for (let p = page - siblings; p <= page + siblings; p++) if (p >= 1 && p <= totalPages) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const items: PageWindowItem[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev === 2) items.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) items.push('ellipsis');
    items.push(p);
  });
  return items;
}
