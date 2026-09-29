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
