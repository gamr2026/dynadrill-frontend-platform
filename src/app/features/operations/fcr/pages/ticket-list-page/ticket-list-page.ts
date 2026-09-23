import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillKpiRowComponent,
  DynadrillScreenHeaderComponent,
  DynadrillSkeletonComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { FcrTicket, FCR_PHASE_LABELS, FCR_PHASE_ROLE, type FcrPhase, type TipoOt } from '../../models/fcr.model';
import { FcrService } from '../../services/fcr.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { MACRO_ESTADO_TONE } from '../../../../../shared/index';

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

@Component({
  selector: 'app-fcr-ticket-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillChipGroupComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
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

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  protected readonly loading = signal(true);
  protected readonly tickets = signal<FcrTicket[]>([]);

  protected readonly quickFilters = [...QUICK_FILTERS];
  protected readonly activeFilter = signal<QuickFilter>('Todos');

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.tickets();
    return [
      { label: 'Total tickets', value: all.length },
      { label: 'Pendientes de mí', value: this.matchesFilter(all, 'Pendiente de mí').length },
      { label: 'En Bodega', value: this.matchesFilter(all, 'En Bodega').length },
      { label: 'En campo', value: all.filter(t => t.currentPhase === 'ejecucion_operativa').length },
      { label: 'Cerrados', value: all.filter(t => t.status === 'cerrado').length },
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
    this.matchesFilter(this.tickets(), this.activeFilter()).map(t => ({
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
        return tickets.filter(t => FCR_PHASE_ROLE[t.currentPhase].roleName === this.roleName());
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

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }
}
