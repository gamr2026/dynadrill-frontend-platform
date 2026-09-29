import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import type { FcrTicket } from '../../models/fcr.model';
import { FCR_STAGE_COLORS } from '../../models/fcr-stage-colors';
import { buildFcrHistory, type FcrHistoryState } from '../../models/fcr-ticket-history';
import { DuracionPipe } from '../../../../../shared/pipes/duracion.pipe';

export interface FcrHistoryPanelData {
  ticket: FcrTicket;
}

const STATE_TAG: Record<FcrHistoryState, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  done: { label: 'Aprobada', variant: 'success' },
  current: { label: 'En curso', variant: 'warning' },
  pending: { label: 'Pendiente', variant: 'neutral' },
};

/** Historial del ticket (acción "Historial" de la tarjeta): una etapa por fila, con tiempos, aprobación y observaciones. */
@Component({
  selector: 'app-fcr-ticket-history-panel',
  imports: [DatePipe, DuracionPipe, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="history">
      <p class="history__sub">{{ t.wellName }} • {{ t.clientName }}</p>
      <ol class="history__list">
        @for (s of stages; track s.phase; let last = $last) {
          <li class="history__item" [class]="'history__item--' + s.state" [style.--fcr-stage-accent]="accent(s.phase)">
            <span class="history__rail" aria-hidden="true">
              <span class="history__dot"></span>
              @if (!last) {
                <span class="history__line"></span>
              }
            </span>
            <div class="history__content">
              <div class="history__row">
                <strong>{{ s.label }}</strong>
                <dynadrill-tag [label]="stateTag[s.state].label" [variant]="stateTag[s.state].variant" />
              </div>
              @if (s.inicio) {
                <span class="history__meta">
                  {{ s.inicio | date: 'dd/MM/yyyy HH:mm' }} → {{ s.fin ? (s.fin | date: 'dd/MM/yyyy HH:mm') : 'en curso' }}
                  @if (s.duracionMs !== undefined) { · {{ s.duracionMs | duracion }} }
                </span>
              }
              @if (s.actor) {
                <span class="history__meta">Responsable: {{ s.actor }}</span>
              }
              @if (s.aprobacion; as a) {
                <span class="history__approval">✓ Aprobado por {{ a.approvedBy }} ({{ a.approvedByRole }}) · {{ a.date | date: 'dd/MM/yyyy HH:mm' }}</span>
              }
              @for (o of s.observaciones; track o.id) {
                <span class="history__meta">Observación de {{ o.author }} ({{ o.role }}): {{ o.message }}</span>
              }
            </div>
          </li>
        }
      </ol>
    </div>
  `,
  styleUrl: './fcr-ticket-panels.scss',
})
export class FcrTicketHistoryPanel {
  protected readonly t = inject<FcrHistoryPanelData>(NZ_DRAWER_DATA).ticket;
  protected readonly stages = buildFcrHistory(this.t);
  protected readonly stateTag = STATE_TAG;
  protected readonly accent = (phase: FcrTicket['currentPhase']) => FCR_STAGE_COLORS[phase].accent;
}
