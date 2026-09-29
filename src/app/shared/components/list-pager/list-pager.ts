import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DynadrillIconButtonComponent } from '@digitec-it-projects/dynadrill-ui';
import type { Pagination } from '../../utils/pagination.util';

/** Anterior / siguiente de una lista de tarjetas paginada con `createPagination`. */
@Component({
  selector: 'app-list-pager',
  imports: [DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pagination().totalPages() > 1 || (summaryLabel() && pagination().total() > 0)) {
      <nav class="list-pager" [class.list-pager--summary]="summaryLabel()" [attr.aria-label]="label()">
        @if (summaryLabel()) {
          <p class="list-pager__info" aria-live="polite">
            Mostrando {{ pagination().range().from }}–{{ pagination().range().to }} de {{ pagination().total() }} {{ summaryLabel() }}
            <span>Página {{ pagination().page() }} de {{ pagination().totalPages() }}</span>
          </p>
        }
        @if (pagination().totalPages() > 1) {
        <div class="list-pager__actions">
        <dynadrill-icon-button
          icon="left"
          tooltip="Página anterior"
          [disabled]="pagination().page() === 1"
          (clicked)="pagination().goTo(pagination().page() - 1)"
        />
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
    .list-pager__actions { display: flex; gap: 8px; }
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
}
