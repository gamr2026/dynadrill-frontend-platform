import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';

/**
 * Caja de solo lectura para mostrar texto reportado por otra persona/área
 * (ej. la novedad que un operador escribió en un Reporte de Unidad). No es
 * un átomo de diseño genérico — es una composición de dynadrill-ui con una
 * decisión de negocio propia de Dynadrill ("así se muestra una novedad
 * reportada"), reutilizada entre features (Mantenimiento, Pumping).
 */
@Component({
  selector: 'app-novedad-readonly',
  imports: [DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="novedad-readonly">
      <dynadrill-text variant="caption">{{ label() }}</dynadrill-text>
      <dynadrill-text variant="body">{{ content() }}</dynadrill-text>
    </div>
  `,
  styles: `
    .novedad-readonly {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 14px;
      background: var(--surface-muted, #faf9fc);
      border: 1px solid var(--border, #e5e4ea);
      border-radius: var(--radius-sm, 4px);
    }
  `,
})
export class NovedadReadonlyComponent {
  label = input('Novedad reportada por el operador');
  content = input.required<string>();
}
