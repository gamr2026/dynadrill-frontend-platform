import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DynadrillIconButtonComponent, DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import type { FcrTicket } from '../../models/fcr.model';
import { FCR_STAGE_COLORS } from '../../models/fcr-stage-colors';
import { FCR_TIPO_OT_LABELS } from '../../models/fcr-ticket-filters';

/**
 * Tarjeta de ticket del tablero (Kanban/Card en Figma): franja con el color
 * de la etapa, datos mínimos y un pie de acciones de icono. "Abrir" queda
 * resaltado cuando es el turno del rol — reemplaza al chip "Tu turno".
 * Si a futuro hay más de 5 acciones secundarias, las extra van a un menú ⋮.
 */
@Component({
  selector: 'app-fcr-kanban-card',
  imports: [DynadrillTagComponent, DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--fcr-stage-accent]': 'accent()' },
  template: `
    <article class="card" [attr.aria-label]="ticket().code + ', ' + ticket().wellName">
      <div class="card__body">
        <header class="card__head">
          <span class="card__code">{{ ticket().code }}</span>
          <dynadrill-tag [label]="tipoLabel()" [variant]="ticket().tipoOt === 'servicio' ? 'brand' : 'neutral'" />
        </header>
        <p class="card__well">{{ ticket().wellName }}</p>
        <p class="card__client" [title]="ticket().clientName">{{ ticket().clientName }}</p>
      </div>
      <footer class="card__actions">
        <div class="card__secondary">
          <dynadrill-icon-button icon="info-circle" tooltip="Resumen" (clicked)="summary.emit()" />
          <span class="card__sep" aria-hidden="true"></span>
          <dynadrill-icon-button icon="clock" iconSource="dynadrill" tooltip="Historial y aprobaciones" (clicked)="history.emit()" />
        </div>
        <span class="card__sep" aria-hidden="true"></span>
        <dynadrill-icon-button
          icon="eye"
          iconSource="dynadrill"
          [tooltip]="turno() ? 'Abrir ticket — es tu turno' : 'Abrir ticket'"
          [active]="turno()"
          (clicked)="open.emit()"
        />
      </footer>
    </article>
  `,
  styleUrl: './fcr-kanban-card.scss',
})
export class FcrKanbanCard {
  readonly ticket = input.required<FcrTicket>();
  /** Es el turno del rol actual — resalta "Abrir ticket". */
  readonly turno = input(false);

  readonly summary = output<void>();
  readonly history = output<void>();
  readonly open = output<void>();

  protected readonly accent = computed(() => FCR_STAGE_COLORS[this.ticket().currentPhase].accent);
  protected readonly tipoLabel = computed(() => FCR_TIPO_OT_LABELS[this.ticket().tipoOt ?? 'venta']);
}
