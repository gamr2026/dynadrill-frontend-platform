import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type QhseChipTone = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * Chip de estado (Chip/Status en Figma): píldora con fondo tenue y texto oscuro (AA), Roboto 12 medium.
 * Los tonos son los del sistema de diseño (success/warning/error/info/neutral/brand).
 */
@Component({
  selector: 'app-qhse-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class]="'chip chip--' + tone()">{{ label() }}</span>`,
  styles: `
    :host {
      display: inline-flex;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.3;
      white-space: nowrap;
    }

    .chip--brand {
      background: var(--dynadrill-purple-tint-strong, #e7deef);
      color: var(--dynadrill-purple, #662e9b);
    }

    .chip--success {
      background: var(--success-bg, #eaf8e4);
      color: var(--success-text, #237804);
    }

    .chip--warning {
      background: var(--warning-bg, #fef5e3);
      color: var(--warning-text, #ad6800);
    }

    .chip--error {
      background: var(--error-bg, #ffeaea);
      color: var(--error-text, #cf1322);
    }

    .chip--info {
      background: var(--info-bg, #e3f2ff);
      color: var(--info-text, #0958d9);
    }

    .chip--neutral {
      background: var(--surface-subtle, #f3f2f7);
      color: var(--text-muted, #5c5870);
    }
  `,
})
export class QhseChip {
  readonly label = input.required<string>();
  readonly tone = input<QhseChipTone>('neutral');
}
