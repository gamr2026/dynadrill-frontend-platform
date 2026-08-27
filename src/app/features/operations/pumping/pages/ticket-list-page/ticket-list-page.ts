import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillKpiRowComponent,
  DynadrillScreenHeaderComponent,
  DynadrillTabsComponent,
  DynadrillTagComponent,
  type DynadrillKpiRowItem,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import {
  PumpingTicket,
  PUMPING_SERVICE_TYPE_LABELS,
  PUMPING_STEP_LABELS,
  PUMPING_STEP_ROLE,
  type PumpingStep,
} from '../../models/pumping.model';
import { PumpingService } from '../../services/pumping.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { MaintenanceOrderWithSubOrders, SubOrder } from '../../../../maintenance/models/maintenance-order.model';
import { MaintenanceOrdersService } from '../../../../maintenance/services/maintenance-orders.service';
import { SuborderReviewDialog, SuborderReviewDialogData } from '../../../../maintenance/components/suborder-review-dialog';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';

/** Mapea cada paso/estado del ticket a su badge visual */
const STEP_BADGES: Record<PumpingStep, { text: string; tone: BadgeTone }> = {
  revision_propuesta: { text: 'Revisión de propuesta', tone: 'warning' },
  asignacion: { text: 'Asignación', tone: 'info' },
  en_ejecucion: { text: 'En ejecución (Salida)', tone: 'brand' },
  revisar_reportes_salida: { text: 'Revisar reportes de salida', tone: 'warning' },
  ejecucion_operativa: { text: 'Ejecución operativa', tone: 'brand' },
  en_ejecucion_llegada: { text: 'En ejecución (Llegada)', tone: 'brand' },
  mantenimiento: { text: 'Mantenimiento', tone: 'info' },
  revisar_reportes_llegada: { text: 'Revisar reportes de llegada', tone: 'warning' },
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
    DynadrillTagComponent,
  ],
  templateUrl: './ticket-list-page.html',
  styleUrl: './ticket-list-page.scss',
})
export class TicketListPage {
  private readonly pumpingService = inject(PumpingService);
  private readonly maintenanceOrdersService = inject(MaintenanceOrdersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  private readonly dialog = inject(DynadrillDialogService);

  // ── Rol actual ──
  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');
  protected readonly isJefeBase = computed(() => this.roleName() === 'Jefe de Base');
  protected readonly isSupervisor = computed(() => this.roleName() === 'Supervisor');
  protected readonly isOperador = computed(() => this.roleName() === 'Operador');

  protected readonly loading = signal(true);
  protected readonly tickets = signal<PumpingTicket[]>([]);
  protected readonly maintenanceOrders = signal<MaintenanceOrderWithSubOrders[]>([]);

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

  protected readonly inProcessColumns = computed<DynadrillDataTableColumn[]>(() => {
    const base: DynadrillDataTableColumn[] = [
      { key: 'code', header: 'Código', sortable: true, searchable: true },
      { key: 'wellName', header: 'Pozo', sortable: true, searchable: true },
      { key: 'clientName', header: 'Cliente', searchable: true },
      { key: 'serviceType', header: 'Tipo', type: 'badge', filters: SERVICE_TYPE_FILTERS },
      { key: 'statusBadge', header: 'Estado', type: 'badge', filters: STEP_FILTERS },
    ];
    return base;
  });

  // ── Columnas "Aprobados" ──

  protected readonly approvedColumns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'wellName', header: 'Pozo', sortable: true, searchable: true },
    { key: 'clientName', header: 'Cliente', searchable: true },
    { key: 'serviceType', header: 'Tipo', type: 'badge', filters: SERVICE_TYPE_FILTERS },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ];

  /** Steps where maintenance expandable detail is shown */
  private static readonly MAINTENANCE_RELEVANT_STEPS: ReadonlySet<PumpingStep> = new Set([
    'mantenimiento',
  ]);

  private static readonly SUB_ORDER_STATUS_TONES: Record<string, BadgeTone> = {
    'En Ejecución': 'brand',
    'En Revisión': 'warning',
    Aprobado: 'success',
    Rechazado: 'error',
  };

  // ── Filas ──

  protected readonly inProcessRows = computed(() => {
    const seenSteps = new Set<PumpingStep>();
    return this.inProcessTickets()
      .filter(t => {
        if (seenSteps.has(t.currentStep)) return false;
        seenSteps.add(t.currentStep);
        return true;
      })
      .map(t => {
        const orders = this.maintenanceOrders().filter(o => o.unidad === t.unitCode);
        const isMaintenanceRelevant = TicketListPage.MAINTENANCE_RELEVANT_STEPS.has(t.currentStep);
        return {
          id: t.id,
          code: t.code,
          wellName: t.wellName,
          clientName: t.clientName,
          serviceType: { text: PUMPING_SERVICE_TYPE_LABELS[t.serviceType], tone: 'brand' as const },
          statusBadge: STEP_BADGES[t.currentStep] ?? { text: t.currentStep, tone: 'neutral' as const },
          step: t.currentStep,
          isMaintenanceStep: isMaintenanceRelevant,
          hasMaintenanceOrders: isMaintenanceRelevant && orders.length > 0,
          maintenanceSubOrders: isMaintenanceRelevant
            ? orders.flatMap(o => o.subOrders.map(s => {
                const displayStatus = this.mapSubOrderDisplayStatus(s.status, s.type);
                return {
                  id: s.id,
                  code: s.code,
                  type: s.type,
                  status: displayStatus,
                  statusTone: TicketListPage.SUB_ORDER_STATUS_TONES[displayStatus] ?? ('neutral' as BadgeTone),
                  canReview: displayStatus === 'En Revisión',
                };
              }))
            : [],
        };
      });
  });

  protected readonly approvedRows = computed(() =>
    this.approvedTickets().map(t => ({
      id: t.id,
      code: t.code,
      wellName: t.wellName,
      clientName: t.clientName,
      serviceType: { text: PUMPING_SERVICE_TYPE_LABELS[t.serviceType], tone: 'brand' as const },
      statusBadge: { text: 'Finalizado', tone: 'success' as const },
      step: 'aprobado',
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();

    // Reload data when navigating back from detail page
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload());
  }

  private reload(): void {
    this.loading.set(true);
    this.pumpingService.listTickets().subscribe({
      next: tickets => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.maintenanceOrdersService.list().subscribe({
      next: orders => this.maintenanceOrders.set(orders),
    });
  }

  /**
   * Mapea los estados internos de sub-orden a los 4 estados visibles
   * para el supervisor: En Ejecución, En Revisión, Aprobado, Rechazado.
   * Si el tipo es Instrumental y está en revisión, se muestra como Rechazado.
   * Si el tipo es Operativo y está en revisión, se muestra como En Revisión (puede revisar).
   */
  private mapSubOrderDisplayStatus(status: string, type: string): string {
    switch (status) {
      case 'Pendiente':
      case 'En Diagnóstico':
      case 'En Ejecución':
        return 'En Ejecución';
      case 'En Revisión de Cierre':
      case 'Corrección Solicitada':
        return type === 'Instrumental' ? 'Rechazado' : 'En Revisión';
      case 'Cerrado':
      case 'Derivado a Pumping':
        return 'Aprobado';
      default:
        return 'Rechazado';
    }
  }

  protected onTabChange(index: number): void {
    this.activeTabIndex.set(index);
  }

  /**
   * Abre el mismo diálogo de revisión que usa el Jefe de Mantenimiento
   * para aprobar o rechazar una sub-orden de mantenimiento.
   */
  protected reviewMaintenance(subOrderId: number): void {
    const subOrder = this.findSubOrder(subOrderId);
    if (!subOrder) return;

    const order = this.maintenanceOrders().find(o => o.subOrders.some(s => s.id === subOrderId));
    const novedadOriginal = order ? `Origen: ${order.origin}` : '';

    const ref = this.dialog.open<SuborderReviewDialog, SuborderReviewDialogData>({
      title: 'Revisar mantenimiento — ' + subOrder.code,
      content: SuborderReviewDialog,
      data: { subOrder, novedadOriginal },
      footer: false,
    });

    ref.afterClose.subscribe(changed => {
      if (changed) {
        this.maintenanceOrdersService.list().subscribe({
          next: orders => this.maintenanceOrders.set(orders),
        });
      }
    });
  }

  private findSubOrder(id: number): SubOrder | undefined {
    for (const order of this.maintenanceOrders()) {
      const sub = order.subOrders.find(s => s.id === id);
      if (sub) return sub;
    }
    return undefined;
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }

  protected viewDetailMode(row: Record<string, unknown>, mode: string): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route, queryParams: { mode } });
  }

  /**
   * Determina si el usuario puede acceder al detalle de un ticket
   * según su rol y el estado (step) del ticket.
   * Usa el mapa PUMPING_STEP_ROLE para verificar si el rol actual
   * coincide con el rol responsable del paso.
   */
  protected canViewDetail(row: Record<string, unknown>): boolean {
    const step = row['step'] as PumpingStep;
    const expectedRole = PUMPING_STEP_ROLE[step];
    return expectedRole?.roleName === this.roleName();
  }
}
