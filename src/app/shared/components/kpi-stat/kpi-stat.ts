import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type KpiStatTone = 'neutral' | 'brand' | 'success' | 'error' | 'info' | 'warning';

/**
 * Card de indicador (Figma Card/KPI): número grande, título y leyenda. Se
 * agrupa en un contenedor `.kpi-stat-row` — carrusel horizontal en móvil,
 * grilla en escritorio — definido en styles.scss para que lo compartan las
 * páginas sin repetir CSS.
 */
@Component({
  selector: 'app-kpi-stat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kpi-stat.html',
  styleUrl: './kpi-stat.scss',
  host: { role: 'listitem', '[class]': '"kpi-stat kpi-stat--" + tone()' },
})
export class KpiStat {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly caption = input('');
  readonly tone = input<KpiStatTone>('neutral');
}
