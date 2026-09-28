import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TimelinePopoverTriggerDirective } from '../../../../shared/components/timeline/timeline-popover-trigger.directive';
import type { TimelineTramo } from '../../../../shared/models/timeline.model';

/**
 * "Avance del ticket" (Data/TimelineStep en Figma) — fases del ticket en
 * vertical, compartido por Pumping y FCR. Cada fase ya alcanzada se puede
 * seleccionar para ver su detalle; también abre el popover con el tramo del
 * timeline (actor y fecha).
 */
@Component({
  selector: 'app-ticket-progress',
  imports: [TimelinePopoverTriggerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-progress.html',
  styleUrl: './ticket-progress.scss',
})
export class TicketProgress {
  readonly labels = input.required<string[]>();
  readonly currentIndex = input.required<number>();
  readonly selectedIndex = input.required<number>();
  readonly tramos = input<TimelineTramo[] | undefined>(undefined);
  readonly responsableRolActual = input<string | null>(null);

  readonly select = output<number>();
}
