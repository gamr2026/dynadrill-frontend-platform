import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Buscador de texto libre (Input/Search en Figma) — el filtrado lo hace quien lo usa. */
@Component({
  selector: 'app-search-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="search-field">
      <span class="search-field__sr-only">{{ label() }}</span>
      <svg class="search-field__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        class="search-field__input"
        type="search"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="value.set($any($event.target).value)"
      />
    </label>
  `,
  styles: `
    :host { display: block; }
    .search-field {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 48px;
      padding: 0 16px;
      border: var(--border-width, 1px) solid var(--border, #e5e4ea);
      border-radius: var(--radius-sm, 8px);
      background: var(--surface, #fff);
      color: var(--text-muted, #5c5870);
      cursor: text;
    }
    .search-field:focus-within {
      border-color: var(--dynadrill-purple, #662e9b);
      box-shadow: 0 0 0 3px var(--dynadrill-purple-tint-strong, rgba(102, 46, 155, 0.16));
    }
    .search-field__icon { flex: none; }
    .search-field__input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      color: var(--text, #2c2b35);
      font: inherit;
      font-size: 14px;
    }
    .search-field__input::placeholder { color: var(--text-muted, #5c5870); }
    .search-field__sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
})
export class SearchField {
  /** Nombre accesible del campo (el placeholder no cuenta como label). */
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly value = model('');
}
