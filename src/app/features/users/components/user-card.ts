import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DynadrillIconButtonComponent, DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import { UserRow } from '../models/user-row.model';

/** Tarjeta de usuario de la lista en móvil (M · Usuarios · Lista en Figma). */
@Component({
  selector: 'app-user-card',
  imports: [DynadrillIconButtonComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="user-card">
      <div class="user-card__body">
        <h2 class="user-card__name">{{ user().name }}</h2>
        <p class="user-card__meta">{{ user().username }} · {{ user().email }}</p>
        <p class="user-card__meta">{{ user().cargo }} · {{ user().departamento }}</p>
        <div class="user-card__tags">
          <dynadrill-tag [label]="user().role" variant="brand" />
          <dynadrill-tag [label]="user().active ? 'Activo' : 'Inactivo'" [variant]="user().active ? 'success' : 'neutral'" />
        </div>
      </div>
      <div class="user-card__actions">
        <dynadrill-icon-button icon="edit" [tooltip]="'Editar a ' + user().name" (clicked)="edit.emit()" />
        <dynadrill-icon-button icon="delete" [tooltip]="'Eliminar a ' + user().name" (clicked)="remove.emit()" />
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .user-card {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      border: var(--border-width, 1px) solid var(--border, #e5e4ea);
      border-radius: var(--radius-md, 12px);
      background: var(--surface, #fff);
    }
    .user-card__body { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
    .user-card__name { margin: 0 0 4px; color: var(--dynadrill-navy, #131529); font-size: 16px; font-weight: 700; }
    .user-card__meta {
      margin: 0;
      overflow: hidden;
      color: var(--text-muted, #5c5870);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .user-card__tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .user-card__actions { display: flex; flex: none; gap: 4px; }
  `,
})
export class UserCard {
  readonly user = input.required<UserRow>();
  readonly edit = output();
  readonly remove = output();
}
