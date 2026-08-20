import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ScreenHeaderComponent } from '../../../../shared/components/screen-header/screen-header';
import { StepperComponent } from '../../../../shared/components/stepper/stepper';
import { ContextCardComponent, ContextCardItem } from '../../../../shared/components/context-card/context-card';
import { PumpingService } from '../../pumping/services/pumping.service';
import { PumpingTicket, PumpingStep } from '../../pumping/models/pumping.model';

@Component({
  selector: 'app-ticket-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScreenHeaderComponent, StepperComponent, ContextCardComponent],
  templateUrl: './ticket-detail-page.html',
  styleUrl: './ticket-detail-page.scss',
})
export class TicketDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly pumpingService = inject(PumpingService);

  readonly loading = signal(true);
  readonly ticket = signal<PumpingTicket | null>(null);

  readonly steps: PumpingStep[] = [
    'revision_propuesta',
    'asignar_supervisor',
    'asignar_operador_unidad',
    'preparacion_documental',
    'ejecucion',
    'cierre_documental',
    'validacion_final',
  ];

  readonly stepLabels = [
    'Revisión propuesta',
    'Asignar supervisor',
    'Asignar operador/unidad',
    'Preparación documental',
    'Ejecución',
    'Cierre documental',
    'Validación final',
  ];

  readonly currentStepIndex = computed(() => {
    const t = this.ticket();
    if (!t) return 0;
    const idx = this.steps.indexOf(t.currentStep);
    return idx >= 0 ? idx : 0;
  });

  readonly contextItems = computed<ContextCardItem[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      { label: 'Cliente', value: t.clientName },
      { label: 'Pozo', value: t.wellName },
      { label: 'Tipo servicio', value: t.serviceType },
      { label: 'Supervisor', value: t.assignedSupervisor || '—' },
      { label: 'Operador', value: t.assignedOperator || '—' },
      { label: 'Unidad', value: t.unitCode || '—' },
    ];
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.pumpingService.getTicket(id).subscribe({
      next: (ticket) => {
        this.ticket.set(ticket);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
