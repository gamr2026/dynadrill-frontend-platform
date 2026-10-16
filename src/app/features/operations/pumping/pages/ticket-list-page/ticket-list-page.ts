import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillTabsComponent,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import {
  PumpingTicket,
  PUMPING_SERVICE_TYPE_LABELS,
  PUMPING_STEP_LABELS,
  PUMPING_STEP_ROLE,
  esRolResponsablePumping,
  type PumpingStep,
} from '../../models/pumping.model';
import { PumpingService } from '../../services/pumping.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { MACRO_ESTADO_TONE } from '../../../../../shared/index';
import { DocumentoOperativoService } from '../../../../facturacion/services/pedido.service';
import { TicketDocumentosDialog, TicketDocumentosDialogData } from '../../components/ticket-documentos-dialog';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { ConductorTareas } from '../../components/conductor-tareas';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { KpiStat, KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { RecordAction, RecordCard } from '../../../../../shared/components/record-card/record-card';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';

/** Mapea cada paso/estado del ticket a su badge visual */
const STEP_BADGES: Record<PumpingStep, { text: string; tone: BadgeTone }> = {
  revision_inicial: { text: 'Revisión Inicial', tone: 'warning' },
  asignacion: { text: 'Asignación', tone: 'info' },
  traslado_salida: { text: 'Traslado de Salida', tone: 'brand' },
  revision_reportes_salida: { text: 'Revisión de Reportes de Salida', tone: 'warning' },
  ejecucion_operativa: { text: 'Ejecución Operativa', tone: 'brand' },
  control_retorno: { text: 'Control de Retorno', tone: 'warning' },
  traslado_llegada: { text: 'Traslado de Llegada', tone: 'brand' },
  revision_reportes_llegada: { text: 'Revisión de Reportes de Llegada', tone: 'warning' },
  revision_final: { text: 'Revisión Final', tone: 'warning' },
  cierre: { text: 'Cierre', tone: 'success' },
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
    ConductorTareas,
    PageHeader,
    RecordCard,
    KpiStat,
    DynadrillDataTableComponent,
    DynadrillTabsComponent,
    DynadrillIconButtonComponent,
  ],
  templateUrl: './ticket-list-page.html',
  styleUrl: './ticket-list-page.scss',
})
export class TicketListPage {
  private readonly pumpingService = inject(PumpingService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly docService = inject(DocumentoOperativoService);

  // ── Rol actual ──
  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');
  protected readonly roleCode = computed(() => this.auth.currentUser()?.roleCode ?? '');
  protected readonly isJefeBase = computed(() => this.roleName() === 'Jefe de Base');
  /** Jefe de Base y Superadmin ven cualquier ticket sin importar el paso — mismo criterio "admin ve todo" del resto de la app. */
  protected readonly esAdmin = computed(() => this.roleName() === 'Jefe de Base' || this.roleName() === 'Superadmin');
  protected readonly isSupervisor = computed(() => this.roleName() === 'Supervisor' || this.roleName() === 'Supervisor Pumping');
  /** El Conductor no ve pedidos: su vista son sus tareas de Gerenciamiento de Viaje (ver ConductorTareas). */
  protected readonly isConductor = computed(() => this.roleName() === 'Conductor');
  protected readonly isOperador = computed(() => this.roleName() === 'Operador');

  /** Móvil: tarjetas (M · Pumping · Pedidos en Figma) en vez de la tabla. */
  protected readonly isMobile = injectNarrowViewport();

  protected readonly loading = signal(true);
  protected readonly tickets = signal<PumpingTicket[]>([]);

  // ── Pestañas ──

  /** Figma: el conteo va entre paréntesis en la etiqueta ("Pedidos en Proceso (6)"); en móvil, etiquetas cortas. */
  protected readonly tabs = computed<DynadrillTab[]>(() =>
    this.isMobile()
      ? [{ label: `En Proceso (${this.inProcessTickets().length})` }, { label: `Aprobados (${this.approvedTickets().length})` }]
      : [{ label: `Pedidos en Proceso (${this.inProcessTickets().length})` }, { label: `Pedidos Aprobados (${this.approvedTickets().length})` }],
  );
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

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.tickets();
    const inProcess = this.inProcessTickets();
    return [
      { label: 'Total pedidos', value: all.length, tone: 'neutral' },
      { label: 'Revisión inicial', value: inProcess.filter(t => t.currentStep === 'revision_inicial').length, tone: 'warning' },
      { label: 'Traslado de salida', value: inProcess.filter(t => t.currentStep === 'traslado_salida').length, tone: 'brand' },
      { label: 'Revisión final', value: inProcess.filter(t => t.currentStep === 'revision_final').length, tone: 'warning' },
      { label: 'Aprobados', value: this.approvedTickets().length, tone: 'success' },
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

  // ── Filas ──

  protected readonly inProcessRows = computed(() => {
    // Deduplica por id de ticket (defensivo ante duplicados reales en los datos) — deduplicar por
    // currentStep ocultaba tickets legítimos cuando dos coincidían en el mismo paso, mientras los
    // KPIs (que sí cuentan inProcessTickets() completo) seguían mostrando el conteo real.
    const seenIds = new Set<number>();
    return this.inProcessTickets()
      .filter(t => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        return true;
      })
      .map(t => ({
        id: t.id,
        code: t.code,
        wellName: t.wellName,
        clientName: t.clientName,
        serviceType: { text: PUMPING_SERVICE_TYPE_LABELS[t.serviceType], tone: 'brand' as const },
        // Texto = paso específico (como antes); color = macro-estado universal (6 tonos en vez de 11).
        statusBadge: {
          text: (STEP_BADGES[t.currentStep] ?? { text: t.currentStep }).text,
          tone: MACRO_ESTADO_TONE[t.timelineResumen?.macroEstadoActual ?? 'pendiente'],
        },
        step: t.currentStep,
        serviceTypeLabel: PUMPING_SERVICE_TYPE_LABELS[t.serviceType],
        actions: this.inProcessActions(t.id, t.currentStep, !!t.unitReport && !!t.pedidoId, t.pedidoId),
      }));
  });

  protected readonly approvedRows = computed(() =>
    this.approvedTickets().map(t => ({
      id: t.id,
      code: t.code,
      wellName: t.wellName,
      clientName: t.clientName,
      serviceType: { text: PUMPING_SERVICE_TYPE_LABELS[t.serviceType], tone: 'brand' as const },
      statusBadge: { text: 'Finalizado', tone: MACRO_ESTADO_TONE[t.timelineResumen?.macroEstadoActual ?? 'aprobado'] },
      step: 'aprobado',
      pedidoId: t.pedidoId,
      serviceTypeLabel: PUMPING_SERVICE_TYPE_LABELS[t.serviceType],
      actions: [{ icon: 'eye', label: 'Ver documentos', primary: true, run: () => this.verDocumentos({ id: t.id, code: t.code, pedidoId: t.pedidoId }) }] as RecordAction[],
    })),
  );

  /**
   * "Al finalizar, que se puedan ver los documentos generados" — por ahora
   * solo Reporte Job (vía DocumentoOperativo.ticketOperativoId, bien
   * vinculado); las inspecciones de vehículo todavía no guardan a qué
   * ticket de Pumping pertenecen, ver comentario en ticket-documentos-dialog.ts.
   */
  protected verDocumentos(row: Record<string, unknown>): void {
    const pedidoId = row['pedidoId'] as number | undefined;
    const ticketId = row['id'] as number;
    const ticketCode = row['code'] as string;
    if (!pedidoId) {
      this.notify.error('Sin pedido vinculado', 'Este ticket no tiene un Pedido de Facturación asociado.');
      return;
    }
    this.docService.listDePedido(pedidoId).subscribe({
      next: docs => {
        const reporteJobDocs = docs
          .filter(d => d.tipo === 'reporte_job' && d.ticketOperativoId === ticketId)
          .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''));
        this.dialog.open<TicketDocumentosDialog, TicketDocumentosDialogData>({
          title: `Documentos — ${ticketCode}`,
          content: TicketDocumentosDialog,
          data: { ticketId, ticketCode, reporteJobDocs, unitReport: this.tickets().find(t => t.id === ticketId)?.unitReport ?? null },
          footer: false,
          width: '640px',
        });
      },
      error: () => this.notify.error('Error', 'No se pudieron cargar los documentos de este ticket.'),
    });
  }

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
    if (this.isConductor()) return;
    this.loading.set(true);
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

  /**
   * Acciones por fila según rol y paso — una sola lista para la tabla de
   * escritorio y la tarjeta móvil. Solo si el rol puede ver ese paso.
   */
  private inProcessActions(id: number, step: PumpingStep, conDocumentos = false, pedidoId?: number): RecordAction[] {
    const acciones = this.accionesDePaso(id, step);
    // Con el Reporte de Unidad ya hecho (salida aprobada en adelante) el PDF se puede bajar desde "Documentos", sin esperar al cierre.
    if (conDocumentos) {
      const code = this.tickets().find(t => t.id === id)?.code ?? '';
      acciones.push({ icon: 'file-pdf', label: 'Ver documentos', run: () => this.verDocumentos({ id, code, pedidoId }) });
    }
    return acciones;
  }

  private accionesDePaso(id: number, step: PumpingStep): RecordAction[] {
    const row = { id, step };
    if (!this.canViewDetail(row)) return [];
    if (this.isSupervisor() && step === 'asignacion') {
      return [
        { icon: 'user-add', label: 'Asignar', run: () => this.viewDetailMode(row, 'asignar') },
        { icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.viewDetailMode(row, 'resumen') },
      ];
    }
    if (this.isSupervisor() && step === 'revision_reportes_salida') {
      return [{ icon: 'file-search', label: 'Revisar reportes de salida', run: () => this.viewDetail(row) }];
    }
    if (this.isSupervisor() && step === 'revision_reportes_llegada') {
      return [{ icon: 'file-search', label: 'Revisar reportes de llegada', run: () => this.viewDetail(row) }];
    }
    return [{ icon: 'eye', label: 'Ver detalle', run: () => this.viewDetail(row) }];
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
    if (this.esAdmin() || this.auth.puedeActuarComo()) return true;
    const step = row['step'] as PumpingStep;
    const expectedRole = PUMPING_STEP_ROLE[step];
    return esRolResponsablePumping(expectedRole?.roleCode, this.roleCode());
  }
}
