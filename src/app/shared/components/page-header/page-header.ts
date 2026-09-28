import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DynadrillScreenHeaderComponent } from '@digitec-it-projects/dynadrill-ui';

/**
 * Cabecera de pantalla (Layout/PageHeader en Figma): eyebrow + título +
 * subtítulo, con las acciones principales a la derecha en escritorio y a
 * ancho completo debajo en móvil. Las acciones van por proyección con el
 * atributo `actions`.
 */
@Component({
  selector: 'app-page-header',
  imports: [DynadrillScreenHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dynadrill-screen-header [eyebrow]="eyebrow()" [title]="title()" [subtitle]="subtitle()" [roleTag]="roleTag()" />
    <div class="page-header__actions"><ng-content select="[actions]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    dynadrill-screen-header { flex: 1 1 320px; min-width: 0; }
    .page-header__actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .page-header__actions:empty { display: none; }

    @media (max-width: 840px) {
      .page-header__actions { flex: 1 1 100%; }
      .page-header__actions ::ng-deep > * { flex: 1 1 100%; }
      .page-header__actions ::ng-deep > dynadrill-button .ant-btn { width: 100%; height: 48px; }
    }
  `,
})
export class PageHeader {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly roleTag = input('');
}
