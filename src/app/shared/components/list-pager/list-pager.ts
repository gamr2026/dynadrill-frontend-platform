import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DynadrillIconButtonComponent } from '@digitec-it-projects/dynadrill-ui';
import { pageWindow, type Pagination } from '../../utils/pagination.util';

/** Anterior / siguiente (y opcionalmente números de página) de una lista paginada con `createPagination`. */
@Component({
  selector: 'app-list-pager',
  imports: [DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pagination().totalPages() > 1 || numbered() || (summaryLabel() && pagination().total() > 0)) {
      <nav class="list-pager" [class.list-pager--summary]="summaryLabel()" [attr.aria-label]="label()">
        @if (summaryLabel()) {
          <p class="list-pager__info" aria-live="polite">
            Mostrando {{ pagination().range().from }}–{{ pagination().range().to }} de {{ pagination().total() }} {{ summaryLabel() }}
            <span>Página {{ pagination().page() }} de {{ pagination().totalPages() }}</span>
          </p>
        }
        @if (pagination().totalPages() > 1 || numbered()) {
        <div class="list-pager__actions">
        <dynadrill-icon-button
          icon="left"
          tooltip="Página anterior"
          [disabled]="pagination().page() === 1"
          (clicked)="pagination().goTo(pagination().page() - 1)"
        />
        @if (numbered()) {
          <ol class="list-pager__pages">
            @for (item of pages(); track $index) {
              <li>
                @if (item === 'ellipsis') {
                  <span class="list-pager__ellipsis" aria-hidden="true">…</span>
                } @else {
                  <button
                    type="button"
                    class="list-pager__page"
                    [class.list-pager__page--current]="item === pagination().page()"
                    [attr.aria-current]="item === pagination().page() ? 'page' : null"
                    [attr.aria-label]="'Página ' + item"
                    (click)="pagination().goTo(item)"
                  >
                    {{ item }}
                  </button>
                }
              </li>
            }
          </ol>
        }
        <dynadrill-icon-button
          icon="right"
          tooltip="Página siguiente"
          [disabled]="pagination().page() === pagination().totalPages()"
          (clicked)="pagination().goTo(pagination().page() + 1)"
        />
        </div>
        }
      </nav>
    }
  `,
  styles: `
    .list-pager { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .list-pager--summary { justify-content: space-between; gap: 12px; }
    .list-pager__actions { display: flex; align-items: center; gap: 8px; }
    .list-pager__pages { display: flex; align-items: center; gap: 4px; margin: 0; padding: 0; list-style: none; }
    .list-pager__page {
      min-width: 32px; height: 32px; padding: 0 6px;
      font: inherit; font-size: 13px; font-weight: 600; color: var(--text, #2c2b35);
      cursor: pointer; background: var(--surface, #fff); border: 1px solid var(--border, #e5e4ea); border-radius: 8px;
    }
    .list-pager__page:hover { border-color: var(--dynadrill-purple, #662e9b); color: var(--dynadrill-purple, #662e9b); }
    .list-pager__page:focus-visible { outline: 2px solid var(--dynadrill-purple, #662e9b); outline-offset: 2px; }
    .list-pager__page--current,
    .list-pager__page--current:hover { color: var(--dynadrill-white, #fff); background: var(--dynadrill-purple, #662e9b); border-color: var(--dynadrill-purple, #662e9b); }
    .list-pager__ellipsis { display: inline-block; min-width: 16px; color: var(--text-muted, #5c5870); text-align: center; }
    .list-pager__info { display: flex; flex-direction: column; gap: 2px; margin: 0; color: var(--text-muted, #5c5870); font-size: 11px; line-height: 1.35; }
  `,
})
export class ListPager {
  readonly pagination = input.required<Pagination<unknown>>();
  readonly label = input('Paginación');
  /**
   * Con texto (ej. "ítems"), muestra a la izquierda "Mostrando 1–25 de N ítems" y "Página X de Y"
   * (pie de tabla de Figma) y los botones a la derecha. Sin texto: solo los botones, centrados.
   */
  readonly summaryLabel = input('');
  /** Muestra los números de página entre las flechas (1 2 3 … 50), abreviados con "…" cuando son muchos. Siempre visible, aunque haya una sola página. */
  readonly numbered = input(false);

  protected readonly pages = computed(() => pageWindow(this.pagination().page(), this.pagination().totalPages()));
}
