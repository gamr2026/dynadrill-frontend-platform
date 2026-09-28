import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DynadrillIconButtonComponent, DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import type { RecordAction, RecordStatus } from '../record-card/record-card';

/**
 * Tarjeta compacta para listas en móvil (M · Usuarios / M · Vehículos en
 * Figma): título, líneas de detalle, etiquetas y acciones de ícono a la
 * derecha. Para registros con código + estado + pares clave-valor, ver
 * `app-record-card`.
 */
@Component({
  selector: 'app-entity-card',
  imports: [DynadrillIconButtonComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="entity-card">
      <div class="entity-card__body">
        <h2 class="entity-card__title">{{ title() }}</h2>
        @for (line of lines(); track $index) {
          <p class="entity-card__line">{{ line }}</p>
        }
        @if (tags().length) {
          <div class="entity-card__tags">
            @for (tag of tags(); track $index) {
              <dynadrill-tag [label]="tag.text" [variant]="tag.tone" />
            }
          </div>
        }
      </div>
      @if (actions().length) {
        <div class="entity-card__actions">
          @for (action of actions(); track action.label) {
            <dynadrill-icon-button [icon]="action.icon" [tooltip]="action.label" (clicked)="action.run()" />
          }
        </div>
      }
    </article>
  `,
  styles: `
    :host { display: block; }
    .entity-card {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      border: var(--border-width, 1px) solid var(--border, #e5e4ea);
      border-radius: var(--radius-md, 12px);
      background: var(--surface, #fff);
    }
    .entity-card__body { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
    .entity-card__title { margin: 0 0 4px; color: var(--dynadrill-navy, #131529); font-size: 16px; font-weight: 700; }
    .entity-card__line {
      margin: 0;
      overflow: hidden;
      color: var(--text-muted, #5c5870);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .entity-card__tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .entity-card__actions { display: flex; flex: none; gap: 4px; }
  `,
})
export class EntityCard {
  readonly title = input.required<string>();
  readonly lines = input<string[]>([]);
  readonly tags = input<RecordStatus[]>([]);
  readonly actions = input<RecordAction[]>([]);
}
