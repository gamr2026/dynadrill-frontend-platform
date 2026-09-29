import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDrawerService,
  DynadrillInputComponent,
  DynadrillKpiRowComponent,
  DynadrillSkeletonComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { FcrTicket, FCR_PHASE_LABELS, type FcrPhase, type TipoOt } from '../../models/fcr.model';
import { FCR_BOARD_PHASES, fcrResponsibleRole, fcrRolePhases } from '../../models/fcr-flow';
import {
  FCR_EMPTY_FILTERS,
  applyFcrFilters,
  fcrActiveFilterChips,
  type FcrFilterChip,
  type FcrTicketFilters,
} from '../../models/fcr-ticket-filters';
import { FcrService } from '../../services/fcr.service';
import { FcrKanbanBoard } from '../../components/kanban/fcr-kanban-board';
import { FcrTicketFiltersPanel, type FcrFiltersPanelData } from '../../components/kanban/fcr-ticket-filters-panel';
import {
  FcrTicketSummaryPanel,
  type FcrSummaryPanelData,
  type FcrSummaryPanelResult,
} from '../../components/kanban/fcr-ticket-summary-panel';
import { FcrTicketHistoryPanel, type FcrHistoryPanelData } from '../../components/kanban/fcr-ticket-history-panel';
import { AuthService } from '../../../../../core/services/auth.service';
import { MACRO_ESTADO_TONE } from '../../../../../shared/index';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { RecordAction, RecordCard } from '../../../../../shared/components/record-card/record-card';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';

const PHASE_BADGES: Record<FcrPhase, { text: string; tone: BadgeTone }> = {
  tipo_operador: { text: 'Tipo de Operador', tone: 'warning' },
  inspeccion: { text: 'Formulario de Inspección', tone: 'info' },
  aprobacion_supervisor_operaciones: { text: 'Aprobación de Supervisor', tone: 'warning' },
  revision_inicial: { text: 'Revisión Inicial', tone: 'warning' },
  preparacion_herramientas: { text: 'Preparación de Herramientas', tone: 'info' },
  asignacion: { text: 'Asignación de Operador', tone: 'info' },
  reunion_operativa: { text: 'Reunión Operativa', tone: 'warning' },
  ejecucion_operativa: { text: 'Ejecución Operativa', tone: 'brand' },
  revision_reportes: { text: 'Revisión de Reportes', tone: 'warning' },
  control_retorno: { text: 'Control de Retorno', tone: 'info' },
  cierre: { text: 'Cierre', tone: 'success' },
};

const TIPO_OT_BADGES: Record<TipoOt, { text: string; tone: BadgeTone }> = {
  venta: { text: 'Venta', tone: 'brand' },
  servicio: { text: 'Servicio', tone: 'neutral' },
};

const QUICK_FILTERS = ['Todos', 'Pendiente de mí', 'En Bodega', 'En campo', 'Cerrados'] as const;
type QuickFilter = (typeof QUICK_FILTERS)[number];

const VISTAS = ['Tablero', 'Tabla'] as const;
type Vista = (typeof VISTAS)[number];

const DRAWER_WIDTH_PX = 460;

@Component({
  selector: 'app-fcr-ticket-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    RecordCard,
    FcrKanbanBoard,
    DynadrillKpiRowComponent,
    DynadrillChipGroupComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSkeletonComponent,
  ],
  templateUrl: './ticket-list-page.html',
  styleUrl: './ticket-list-page.scss',
})
export class FcrTicketListPage {
  private readonly fcrService = inject(FcrService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly drawer = inject(DynadrillDrawerService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  /** Móvil: tarjetas (M · FCR · Tickets en Figma) en vez de la tabla; una etapa a la vez en el tablero. */
  protected readonly isMobile = injectNarrowViewport();

  protected readonly loading = signal(true);
  protected readonly tickets = signal<FcrTicket[]>([]);

  // ── Vista, búsqueda y filtros (compartidos por tabla y tablero) ──

  protected readonly vistas = [...VISTAS];
  protected readonly vista = signal<Vista>('Tablero');

  protected readonly filters = signal<FcrTicketFilters>(FCR_EMPTY_FILTERS);
  protected readonly filteredTickets = computed(() => applyFcrFilters(this.tickets(), this.filters(), this.roleName()));
  protected readonly activeChips = computed(() => fcrActiveFilterChips(this.filters()));
  protected readonly hasActiveFilters = computed(() => this.activeChips().length > 0 || !!this.filters().texto.trim());

  /** "Mis etapas" del tablero — columnas solo de las etapas del rol + resumen de lo que llega. */
  protected readonly soloMisEtapas = signal(false);
  private readonly myPhases = computed(() => fcrRolePhases(this.roleName()));
  protected readonly etapaOptions = computed(() => {
    const all = this.filteredTickets();
    const mine = all.filter(t => this.myPhases().has(t.currentPhase)).length;
    return [`Todas las etapas · ${all.length}`, `Mis etapas · ${mine}`];
  });
  protected readonly etapaSelected = computed(() => [this.etapaOptions()[this.soloMisEtapas() ? 1 : 0]]);
  protected readonly hasMyPhases = computed(() => FCR_BOARD_PHASES.some(p => this.myPhases().has(p)));

  // ── Tabla (vista original) ──

  protected readonly quickFilters = [...QUICK_FILTERS];
  protected readonly activeFilter = signal<QuickFilter>('Todos');

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.filteredTickets();
    return [
      { label: 'Total tickets', value: all.length },
      { label: 'Pendientes de mí', value: this.matchesFilter(all, 'Pendiente de mí').length },
      { label: 'En Bodega', value: this.matchesFilter(all, 'En Bodega').length },
      { label: 'En campo', value: this.matchesFilter(all, 'En campo').length },
      { label: 'Cerrados', value: this.matchesFilter(all, 'Cerrados').length },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Ticket', sortable: true, searchable: true },
    { key: 'clientName', header: 'Cliente', searchable: true },
    { key: 'wellName', header: 'Pozo', searchable: true },
    { key: 'tipoOtBadge', header: 'Tipo', type: 'badge' },
    { key: 'phase', header: 'Fase' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.matchesFilter(this.filteredTickets(), this.activeFilter()).map(t => ({
      id: t.id,
      code: t.code,
      clientName: t.clientName,
      wellName: t.wellName,
      // Tickets sembrados antes de este campo no traen tipoOt — mismo default que Pedido.tipoOt en el backend ('venta').
      tipoOtBadge: TIPO_OT_BADGES[t.tipoOt ?? 'venta'],
      phase: FCR_PHASE_LABELS[t.currentPhase],
      // Texto = fase específica (como antes); color = macro-estado universal (6 tonos en vez de 12).
      statusBadge: {
        text: PHASE_BADGES[t.currentPhase].text,
        tone: MACRO_ESTADO_TONE[t.timelineResumen?.macroEstadoActual ?? 'pendiente'],
      },
      actions: [{ icon: 'eye', label: 'Ver ticket', run: () => this.viewDetail({ id: t.id }) }] as RecordAction[],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload());
  }

  private reload(): void {
    this.loading.set(true);
    this.fcrService.listTickets().subscribe({
      next: tickets => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private matchesFilter(tickets: FcrTicket[], filterValue: QuickFilter): FcrTicket[] {
    switch (filterValue) {
      case 'Todos':
        return tickets;
      case 'Pendiente de mí':
        // Misma regla que el banner del detalle (sub-pasos de Revisión inicial y Preparación incluidos).
        return tickets.filter(t => t.status !== 'cerrado' && fcrResponsibleRole(t) === this.roleName());
      case 'En Bodega':
        return tickets.filter(t => t.currentPhase === 'preparacion_herramientas' && t.tools.some(tool => tool.status === 'en_preparacion'));
      case 'En campo':
        return tickets.filter(t => t.currentPhase === 'ejecucion_operativa');
      case 'Cerrados':
        return tickets.filter(t => t.status === 'cerrado');
    }
  }

  protected onFilterChange(selected: string[]): void {
    const value = selected[0] as QuickFilter | undefined;
    if (value) this.activeFilter.set(value);
  }

  protected onVistaChange(selected: string[]): void {
    const value = selected[0] as Vista | undefined;
    if (value) this.vista.set(value);
  }

  protected onEtapaChange(selected: string[]): void {
    if (selected[0]) this.soloMisEtapas.set(selected[0] === this.etapaOptions()[1]);
  }

  protected setTexto(texto: string): void {
    this.filters.update(f => ({ ...f, texto }));
  }

  protected clearChip(chip: FcrFilterChip): void {
    this.filters.update(chip.clear);
  }

  protected clearAll(): void {
    this.filters.set(FCR_EMPTY_FILTERS);
  }

  // ── Paneles laterales (a pantalla completa en móvil) ──

  private drawerWidth(): number {
    return this.isMobile() ? window.innerWidth : DRAWER_WIDTH_PX;
  }

  protected openFilters(): void {
    const ref = this.drawer.open<FcrTicketFiltersPanel, FcrFiltersPanelData>({
      title: 'Filtros',
      content: FcrTicketFiltersPanel,
      data: { filters: this.filters(), tickets: this.tickets(), roleName: this.roleName() },
      width: this.drawerWidth(),
    });
    ref.afterClose.subscribe((result: FcrTicketFilters | undefined) => {
      if (result) this.filters.set(result);
    });
  }

  protected openSummary(ticket: FcrTicket): void {
    const ref = this.drawer.open<FcrTicketSummaryPanel, FcrSummaryPanelData>({
      title: 'Resumen',
      content: FcrTicketSummaryPanel,
      data: { ticket, roleName: this.roleName() },
      width: this.drawerWidth(),
    });
    ref.afterClose.subscribe((result: FcrSummaryPanelResult | undefined) => {
      if (result === 'abrir') this.viewDetail({ id: ticket.id });
      if (result === 'historial') this.openHistory(ticket);
    });
  }

  protected openHistory(ticket: FcrTicket): void {
    this.drawer.open<FcrTicketHistoryPanel, FcrHistoryPanelData>({
      title: `Historial · ${ticket.code}`,
      content: FcrTicketHistoryPanel,
      data: { ticket },
      width: this.drawerWidth(),
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }
}
