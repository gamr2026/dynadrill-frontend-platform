import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillApprovalActionsComponent,
  DynadrillButtonComponent,
  DynadrillChecklistComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillScreenHeaderComponent,
  DynadrillStepperComponent,
  DynadrillTextComponent,
  type DynadrillApprovalDecision,
  type DynadrillChecklistItem,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import { PumpingTicket, PumpingStep } from '../../models/pumping.model';
import { PumpingService } from '../../services/pumping.service';

@Component({
  selector: 'app-ticket-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillStepperComponent,
    DynadrillContextCardComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillTextComponent,
    DynadrillApprovalActionsComponent,
    DynadrillChecklistComponent,
  ],
  templateUrl: './ticket-detail-page.html',
  styleUrl: './ticket-detail-page.scss',
})
export class TicketDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pumpingService = inject(PumpingService);

  protected readonly loading = signal(true);
  protected readonly ticket = signal<PumpingTicket | null>(null);
  protected readonly decision = signal<DynadrillApprovalDecision>(null);

  protected readonly steps: string[] = [
    'Revision propuesta',
    'Asignar supervisor',
    'Asignar operador/unidad',
    'Preparacion documental',
    'Ejecucion',
    'Cierre documental',
    'Validacion final',
  ];

  private readonly stepKeys: PumpingStep[] = [
    'revision_propuesta',
    'asignar_supervisor',
    'asignar_operador_unidad',
    'preparacion_documental',
    'ejecucion',
    'cierre_documental',
    'validacion_final',
  ];

  protected readonly currentStepIndex = computed(() => {
    const t = this.ticket();
    if (!t) return 0;
    const idx = this.stepKeys.indexOf(t.currentStep);
    return idx >= 0 ? idx : 0;
  });

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      { label: 'Ticket', value: t.code },
      { label: 'Cliente', value: t.clientName },
      { label: 'Pozo', value: t.wellName },
      { label: 'Tipo de servicio', value: t.serviceType.toUpperCase() },
      { label: 'Supervisor', value: t.assignedSupervisor || '—' },
      { label: 'Operador', value: t.assignedOperator || '—' },
      { label: 'Unidad', value: t.unitCode || '—' },
      { label: 'Fecha estimada', value: t.estimatedDate || '—' },
    ];
  });

  protected readonly toolColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Herramienta', searchable: true },
    { key: 'serialCode', header: 'Serie' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly toolRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return t.tools.map(tool => ({
      id: tool.id,
      name: tool.name,
      serialCode: tool.serialCode,
      statusBadge: {
        text: tool.status,
        tone: tool.status === 'instalada' ? 'success' as const : tool.status === 'devuelta' ? 'neutral' as const : 'warning' as const,
      },
    }));
  });

  protected readonly chemicalColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Quimico' },
    { key: 'quantityAssigned', header: 'Asignado' },
    { key: 'quantityUsed', header: 'Usado' },
    { key: 'quantityReturned', header: 'Devuelto' },
    { key: 'unit', header: 'Unidad' },
  ];

  protected readonly chemicalRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return t.chemicals.map(c => ({
      id: c.id,
      name: c.name,
      quantityAssigned: c.quantityAssigned,
      quantityUsed: c.quantityUsed,
      quantityReturned: c.quantityReturned,
      unit: c.unit,
    }));
  });

  protected readonly checklist = signal<DynadrillChecklistItem[]>([
    { label: 'PTW firmado', checked: false },
    { label: 'Checklist operativo aprobado', checked: false },
    { label: 'Toolbox Talk realizado', checked: false },
    { label: 'Reporte de unidad de salida', checked: false },
  ]);

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.pumpingService.getTicket(id).subscribe({
      next: ticket => {
        this.ticket.set(ticket);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onChecklistToggle(index: number): void {
    this.checklist.update(items =>
      items.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)),
    );
  }

  protected onDecisionChange(decision: DynadrillApprovalDecision): void {
    this.decision.set(decision);
  }

  protected goBack(): void {
    this.router.navigate(['/operaciones/pumping']);
  }
}
