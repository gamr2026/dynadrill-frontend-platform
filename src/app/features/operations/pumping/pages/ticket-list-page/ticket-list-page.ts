import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillKpiRowComponent,
  DynadrillScreenHeaderComponent,
  DynadrillTabsComponent,
  type DynadrillKpiRowItem,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import {
  PumpingTicket,
  PUMPING_SERVICE_TYPE_LABELS,
  PUMPING_STEP_LABELS,
  type PumpingStep,
} from '../../models/pumping.model';
import { PumpingService } from '../../services/pumping.service';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';

/** Mapea cada paso/estado del ticket a su badge visual */
const STEP_BADGES: Record<PumpingStep, { text: string; tone: BadgeTone }> = {
  revision_propuesta: { text: 'Revisión de propuesta', tone: 'warning' },
  asignacion: { text: 'Asignación', tone: 'info' },
  en_ejecucion: { text: 'En ejecución (Salida)', tone: 'brand' },
  en_ejecucion_llegada: { text: 'En ejecución (Llegada)', tone: 'brand' },
  en_revision: { text: 'En revisión', tone: 'warning' },
};

const SERVICE_TYPE_FILTERS = Object.entries(PUMPING_SERVICE_TYPE_LABELS).map(
  ([value, text]) => ({ text, value }),
);

const STEP_FILTERS = Object.entries(PUMPING_STEP_LABELS).map(
  ([value, text]) => ({ text, value }),
);

@Component({
  selector: 'app-ticket-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillTabsComponent,
    DynadrillButtonComponent,
  ],
  templateUrl: './ticket-list-page.html',
  styleUrl: './ticket-list-page.scss',
})
export class TicketListPage {
  private readonly pumpingService = inject(PumpingService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly tickets = signal<PumpingTicket[]>([]);

  // ── Pestañas ──

  protected readonly tabs = computed<DynadrillTab[]>(() => [
    { label: 'Tickets en Proceso', badge: this.inProcessTickets().length },
    { label: 'Tickets Aprobados', badge: this.approvedTickets().length },
  ]);
  protected readonly activeTabIndex = signal(0);
  protected readonly isInProcessTab = computed(() => this.activeTabIndex() === 0);

  // ── Tickets filtrados por pestaña ──

  protected readonly inProcessTickets = computed(() =>
    this.tickets().filter(t => t.status !== 'aprobado'),
  );

  protected readonly approvedTickets = computed(() =>
    this.tickets().filter(t => t.status === 'aprobado'),
  );

  // ── KPIs ──

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.tickets();
    const inProcess = this.inProcessTickets();
    return [
      { label: 'Total tickets', value: all.length },
      { label: 'Revisión de propuesta', value: inProcess.filter(t => t.currentStep === 'revision_propuesta').length },
      { label: 'En ejecución', value: inProcess.filter(t => t.currentStep === 'en_ejecucion').length },
      { label: 'En revisión', value: inProcess.filter(t => t.currentStep === 'en_revision').length },
      { label: 'Aprobados', value: this.approvedTickets().length },
    ];
  });

  // ── Columnas "En Proceso" ──

  protected readonly inProcessColumns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'wellName', header: 'Pozo', sortable: true, searchable: true },
    { key: 'clientName', header: 'Cliente', searchable: true },
    { key: 'serviceType', header: 'Tipo', type: 'badge', filters: SERVICE_TYPE_FILTERS },
    { key: 'statusBadge', header: 'Estado', type: 'badge', filters: STEP_FILTERS },
  ];

  // ── Columnas "Aprobados" ──

  protected readonly approvedColumns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'wellName', header: 'Pozo', sortable: true, searchable: true },
    { key: 'clientName', header: 'Cliente', searchable: true },
    { key: 'serviceType', header: 'Tipo', type: 'badge', filters: SERVICE_TYPE_FILTERS },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ];

  // ── Filas ──

  protected readonly inProcessRows = computed(() =>
    this.inProcessTickets().map(t => ({
      id: t.id,
      code: t.code,
      wellName: t.wellName,
      clientName: t.clientName,
      serviceType: { text: PUMPING_SERVICE_TYPE_LABELS[t.serviceType], tone: 'brand' as const },
      statusBadge: STEP_BADGES[t.currentStep] ?? { text: t.currentStep, tone: 'neutral' as const },
    })),
  );

  protected readonly approvedRows = computed(() =>
    this.approvedTickets().map(t => ({
      id: t.id,
      code: t.code,
      wellName: t.wellName,
      clientName: t.clientName,
      serviceType: { text: PUMPING_SERVICE_TYPE_LABELS[t.serviceType], tone: 'brand' as const },
      statusBadge: { text: 'Finalizado', tone: 'success' as const },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.pumpingService.listTickets().subscribe({
      next: tickets => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onTabChange(index: number): void {
    this.activeTabIndex.set(index);
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate(['/modulos/operativo/pumping', row['id']]);
  }
}
