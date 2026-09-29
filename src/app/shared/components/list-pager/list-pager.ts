import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DynadrillIconButtonComponent } from '@digitec-it-projects/dynadrill-ui';
import type { Pagination } from '../../utils/pagination.util';

/** Anterior / siguiente de una lista de tarjetas paginada con `createPagination`. */
@Component({
  selector: 'app-list-pager',
  imports: [DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pagination().totalPages() > 1) {
      <nav class="list-pager" [attr.aria-label]="label()">
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
      </nav>
    }
  `,
  styles: `.list-pager { display: flex; justify-content: center; gap: 8px; }`,
})
export class ListPager {
  readonly pagination = input.required<Pagination<unknown>>();
  readonly label = input('Paginación');
}
