import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillIconButtonComponent,
  DynadrillTabsComponent,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../../../core/utils/narrow-viewport.util';
import { KpiStat, KpiStatTone } from '../../../../../../shared/components/kpi-stat/kpi-stat';
import { PageHeader } from '../../../../../../shared/components/page-header/page-header';
import {
  RecordAction,
  RecordCard,
} from '../../../../../../shared/components/record-card/record-card';
import {
  PASOS_PUMPING,
  TONO_MACRO,
  etiquetaTipoServicio,
  mensajeErrorTicket,
  type TicketPumpingResumen,
} from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

/** El ticket termina en el paso `cierre`: es lo que la demo llama "Pedidos Aprobados". */
const PASO_FINAL = 'cierre';

const STEP_FILTERS = PASOS_PUMPING.map((p) => ({ text: p.nombre, value: p.nombre }));

/**
 * Pedidos de Pumping: mismo diseño que la demo (indicadores, pestañas "En proceso" / "Aprobados" y tabla), pero con los datos
 * y las reglas del contenedor `operaciones`. Cada pedido que Ventas abre en la línea llega aquí como ticket.
 */
@Component({
  selector: 'app-tickets-pumping-list-page',
  imports: [
    DynadrillBannerComponent,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
    DynadrillTabsComponent,
    KpiStat,
    PageHeader,
    RecordCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tickets-pumping-list-page.html',
  styleUrl: './tickets-pumping-list-page.scss',
})
export class TicketsPumpingListPage {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');
  /** Móvil: tarjetas en vez de la tabla. */
  protected readonly isMobile = injectNarrowViewport();

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tickets = signal<TicketPumpingResumen[]>([]);

  protected readonly activeTabIndex = signal(0);
  protected readonly isInProcessTab = computed(() => this.activeTabIndex() === 0);

  private readonly enProceso = computed(() =>
    this.tickets().filter((t) => t.paso.codigo !== PASO_FINAL),
  );
  private readonly aprobados = computed(() =>
    this.tickets().filter((t) => t.paso.codigo === PASO_FINAL),
  );

  protected readonly tabs = computed<DynadrillTab[]>(() =>
    this.isMobile()
      ? [
          { label: `En Proceso (${this.enProceso().length})` },
          { label: `Aprobados (${this.aprobados().length})` },
        ]
      : [
          { label: `Pedidos en Proceso (${this.enProceso().length})` },
          { label: `Pedidos Aprobados (${this.aprobados().length})` },
        ],
  );

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const enProceso = this.enProceso();
    const enPaso = (codigo: string) => enProceso.filter((t) => t.paso.codigo === codigo).length;
    return [
      { label: 'Total pedidos', value: this.tickets().length, tone: 'neutral' },
      { label: 'Revisión inicial', value: enPaso('revision_inicial'), tone: 'warning' },
      { label: 'Traslado de salida', value: enPaso('traslado_salida'), tone: 'brand' },
      { label: 'Revisión final', value: enPaso('revision_final'), tone: 'warning' },
      { label: 'Aprobados', value: this.aprobados().length, tone: 'success' },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'wellName', header: 'Pozo', sortable: true, searchable: true },
    { key: 'clientName', header: 'Cliente', searchable: true },
    { key: 'serviceType', header: 'Tipo', type: 'badge' },
    { key: 'statusBadge', header: 'Estado', type: 'badge', filters: STEP_FILTERS },
  ];

  protected readonly inProcessRows = computed(() => this.enProceso().map((t) => this.fila(t)));
  protected readonly approvedRows = computed(() => this.aprobados().map((t) => this.fila(t)));

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  private fila(t: TicketPumpingResumen) {
    const tipos = t.tiposServicio.map(etiquetaTipoServicio).join(', ');
    return {
      id: t.id,
      code: t.ticketNumero !== null ? String(t.ticketNumero) : t.pedidoCodigo,
      wellName: t.pozo ?? '—',
      clientName: t.cliente ?? '—',
      serviceType: tipos ? { text: tipos, tone: 'brand' as const } : null,
      statusBadge: { text: t.paso.nombre, tone: TONO_MACRO[t.paso.macro] },
      serviceTypeLabel: tipos || '—',
      actions: [
        { icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.abrir(t) },
      ] as RecordAction[],
    };
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.listar().subscribe({
      next: (t) => {
        this.tickets.set(t);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar la bandeja. Intente de nuevo.'));
      },
    });
  }

  protected onTabChange(index: number): void {
    this.activeTabIndex.set(index);
  }

  private abrir(t: TicketPumpingResumen): void {
    void this.router.navigate(['/modulos/operativo/pumping/pedidos', t.id]);
  }
}
