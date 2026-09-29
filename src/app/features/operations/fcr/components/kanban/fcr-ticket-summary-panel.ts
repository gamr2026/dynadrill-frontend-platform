import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NZ_DRAWER_DATA, NzDrawerRef } from 'ng-zorro-antd/drawer';
import { DynadrillButtonComponent } from '@digitec-it-projects/dynadrill-ui';
import { FCR_PHASE_LABELS, type FcrTicket } from '../../models/fcr.model';
import { fcrPhaseKeys, fcrResponsibleRole, fcrRolePhases, fcrTicketRelation } from '../../models/fcr-flow';
import { FCR_STAGE_COLORS } from '../../models/fcr-stage-colors';
import { FCR_TIPO_OT_LABELS } from '../../models/fcr-ticket-filters';
import { DuracionPipe } from '../../../../../shared/pipes/duracion.pipe';

export interface FcrSummaryPanelData {
  ticket: FcrTicket;
  roleName: string;
}

/** Lo que el usuario eligió al cerrar el resumen — lo resuelve la página (abrir ticket / historial). */
export type FcrSummaryPanelResult = 'historial' | 'abrir';

/** Vista rápida de un ticket (acción "Resumen" de la tarjeta). */
@Component({
  selector: 'app-fcr-ticket-summary-panel',
  imports: [DatePipe, DuracionPipe, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="summary">
      <header class="summary__head">
        <span class="summary__code">{{ t.code }}</span>
        <h2>{{ t.wellName }}</h2>
        <p>{{ t.clientName }} • {{ tipoLabel }}</p>
      </header>

      <div class="summary__notice" [class]="'summary__notice--' + relation()" role="status">
        <strong>{{ notice().title }}</strong>
        <span>{{ notice().body }}</span>
      </div>

      <section aria-label="Progreso del proceso">
        <h3>Progreso del proceso</h3>
        <ol class="summary__progress">
          @for (step of steps(); track step.phase) {
            <li [style.background]="step.reached ? step.accent : null" [attr.aria-label]="step.label + (step.current ? ' (actual)' : '')"></li>
          }
        </ol>
        <p class="summary__stage">Etapa {{ currentIndex() + 1 }} de {{ steps().length }} · {{ phaseLabel() }}</p>
      </section>

      <dl class="summary__details">
        <div><dt>Supervisor</dt><dd>{{ t.assignedSupervisor || '—' }}</dd></div>
        <div><dt>Operador</dt><dd>{{ t.assignedOperator || '—' }}</dd></div>
        <div><dt>Unidad</dt><dd>{{ t.unitCode || '—' }}</dd></div>
        <div><dt>Fecha estimada</dt><dd>{{ t.estimatedDate ? (t.estimatedDate | date: 'dd/MM/yyyy') : '—' }}</dd></div>
        <div><dt>Herramientas</dt><dd>{{ t.tools.length }}</dd></div>
        @if (t.timelineResumen; as tl) {
          <div><dt>En la etapa</dt><dd>{{ tl.tiempoEnFaseActualMs | duracion }}</dd></div>
        }
        @if (t.pedidoCode) {
          <div><dt>Pedido</dt><dd>{{ t.pedidoCode }}</dd></div>
        }
      </dl>

      <footer class="summary__actions">
        <dynadrill-button variant="secondary" (clicked)="close('historial')">Ver historial</dynadrill-button>
        <dynadrill-button variant="primary" (clicked)="close('abrir')">Abrir ticket</dynadrill-button>
      </footer>
    </div>
  `,
  styleUrl: './fcr-ticket-panels.scss',
})
export class FcrTicketSummaryPanel {
  private readonly drawerRef = inject(NzDrawerRef<FcrTicketSummaryPanel, FcrSummaryPanelResult>);
  private readonly data = inject<FcrSummaryPanelData>(NZ_DRAWER_DATA);

  protected readonly t = this.data.ticket;
  protected readonly tipoLabel = FCR_TIPO_OT_LABELS[this.t.tipoOt ?? 'venta'];
  protected readonly relation = computed(() => fcrTicketRelation(this.t, this.data.roleName));
  protected readonly phaseLabel = computed(() => FCR_PHASE_LABELS[this.t.currentPhase]);

  private readonly keys = fcrPhaseKeys(this.t.tipoOt);
  protected readonly currentIndex = computed(() => this.keys.indexOf(this.t.currentPhase));
  protected readonly steps = computed(() =>
    this.keys.map((phase, i) => ({
      phase,
      label: FCR_PHASE_LABELS[phase],
      accent: FCR_STAGE_COLORS[phase].accent,
      reached: i <= this.currentIndex(),
      current: i === this.currentIndex(),
    })),
  );

  protected readonly notice = computed(() => {
    switch (this.relation()) {
      case 'turno':
        return { title: 'Es tu turno', body: `Te toca actuar en ${this.phaseLabel()}.` };
      case 'proxima': {
        const mine = fcrRolePhases(this.data.roleName);
        const next = this.keys.slice(this.currentIndex() + 1).find(p => mine.has(p));
        return {
          title: 'Aún no requiere tu acción',
          body: `Llegará a ${next ? FCR_PHASE_LABELS[next] : 'tu etapa'}. Ahora lo tiene: ${fcrResponsibleRole(this.t)}.`,
        };
      }
      case 'seguimiento':
        return {
          title: this.t.status === 'cerrado' ? 'Ticket cerrado' : 'Solo seguimiento',
          body: this.t.status === 'cerrado' ? 'El proceso terminó.' : `Ahora lo tiene: ${fcrResponsibleRole(this.t)}.`,
        };
    }
  });

  protected close(result: FcrSummaryPanelResult): void {
    this.drawerRef.close(result);
  }
}
