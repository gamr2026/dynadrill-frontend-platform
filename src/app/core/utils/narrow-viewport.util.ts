import { DestroyRef, Signal, inject, signal } from '@angular/core';

/**
 * Signal reactivo a un breakpoint de ancho de viewport — mismo patrón que
 * ya existía duplicado en maintenance-list-page.ts/my-tasks-page.ts
 * (matchMedia + listener + cleanup en DestroyRef), extraído para no
 * repetirlo en cada página que necesita alternar `fixed`/`scrollX` de
 * dynadrill-data-table según el ancho disponible.
 */
export function injectNarrowViewport(maxWidthPx = 840): Signal<boolean> {
  const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
  const narrow = signal(mq.matches);

  const onChange = (e: MediaQueryListEvent): void => narrow.set(e.matches);
  mq.addEventListener('change', onChange);
  inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));

  return narrow.asReadonly();
}
