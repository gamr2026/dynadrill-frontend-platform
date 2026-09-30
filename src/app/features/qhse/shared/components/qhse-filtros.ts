import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface QhseFiltroOpcion {
  value: string;
  label: string;
  count?: number;
}

/**
 * Filtros en píldoras (Figma: "Todos (231) · Solicitado (2) · …"): la opción activa va con fondo lila, ✓ y texto
 * morado; las demás, blancas con borde.
 */
@Component({
  selector: 'app-qhse-filtros',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filtros" role="group">
      @for (o of opciones(); track o.value) {
        <button
          type="button"
          class="filtro"
          [class.filtro--activo]="o.value === selected()"
          [attr.aria-pressed]="o.value === selected()"
          (click)="selectedChange.emit(o.value)"
        >
          @if (o.value === selected()) {
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5" /></svg>
          }
          {{ o.label }}@if (o.count !== undefined) { ({{ o.count }}) }
        </button>
      }
    </div>
  `,
  styles: `
    .filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .filtro {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 40px;
      padding: 8px 16px;
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 10px;
      background: var(--surface, #fff);
      color: var(--text, #2c2b35);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--dynadrill-purple, #662e9b);
        outline-offset: 2px;
      }
    }

    .filtro--activo {
      border-color: transparent;
      background: var(--dynadrill-purple-tint-strong, #e7deef);
      color: var(--dynadrill-purple, #662e9b);
    }
  `,
})
export class QhseFiltros {
  readonly opciones = input.required<QhseFiltroOpcion[]>();
  readonly selected = input.required<string>();
  readonly selectedChange = output<string>();
}
