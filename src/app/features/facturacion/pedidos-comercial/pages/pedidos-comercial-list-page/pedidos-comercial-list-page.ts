import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { SearchField } from '../../../../../shared/components/search-field/search-field';
import { KpiStat } from '../../../../../shared/components/kpi-stat/kpi-stat';
import {
  PedidosFiltrosDialog,
  type PedidosFiltros,
  type PedidosFiltrosData,
} from '../../../components/pedidos-filtros-dialog';
import { PorCompletarPanel } from '../../components/por-completar-panel/por-completar-panel';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import {
  LINEA_SERVICIO_LABELS,
  ORIGEN_LABELS,
  PERMISOS_PEDIDOS,
  mensajeDeError,
  type EstadoCatalogo,
  type LineaServicio,
  type OrigenPedido,
  type PedidoResumen,
} from '../../models/pedido-comercial.model';
import { chipsFiltros, filaPedido, filtrarPedidos, kpisPedidos, type FilaPedido } from '../../models/pedidos-lista';

/**
 * Lista de pedidos con el diseño de la demo (FACT-001): tarjetas de indicadores, filtros, tabla en escritorio y
 * tarjetas en móvil. Los datos vienen del contenedor comercial; los pedidos de AS2 se completan desde
 * "Sincronizar con AS2".
 */
@Component({
  selector: 'app-pedidos-comercial-list-page',
  imports: [
    SearchField,
    DynadrillScreenHeaderComponent,
    KpiStat,
    DynadrillIconComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedidos-comercial-list-page.html',
  styleUrl: './pedidos-comercial-list-page.scss',
})
export class PedidosComercialListPage {
  private readonly servicio = inject(PedidosComercialService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly puedeCrearPedido = computed(() => this.auth.can(PERMISOS_PEDIDOS.crear));
  protected readonly puedeVerAs2 = computed(() => this.auth.can(PERMISOS_PEDIDOS.as2PedidosVer));
  private readonly puedeEditar = computed(() => this.auth.can(PERMISOS_PEDIDOS.editar));

  /** Móvil (<840px): tarjetas + filtros en bottom sheet, como el shell. En escritorio, tabla + filtros en línea. */
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 840px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly loading = signal(true);
  protected readonly pedidos = signal<PedidoResumen[]>([]);
  private readonly estados = signal<EstadoCatalogo[]>([]);

  // ── Filtros ──
  protected readonly busqueda = signal('');
  protected readonly filtroLinea = signal<LineaServicio | null>(null);
  protected readonly filtroEstado = signal<string | null>(null);
  protected readonly filtroOrigen = signal<OrigenPedido | null>(null);

  protected readonly lineaOptions: DynadrillSelectOption[] = (
    Object.entries(LINEA_SERVICIO_LABELS) as [LineaServicio, string][]
  ).map(([value, label]) => ({ label, value }));
  protected readonly estadoOptions = computed<DynadrillSelectOption[]>(() =>
    this.estados().map((e) => ({ label: e.nombre, value: e.codigo })),
  );
  protected readonly origenOptions: DynadrillSelectOption[] = (
    Object.entries(ORIGEN_LABELS) as [OrigenPedido, string][]
  ).map(([value, label]) => ({ label, value }));

  protected readonly hayFiltros = computed(() => !!this.filtroLinea() || !!this.filtroEstado() || !!this.filtroOrigen());
  protected readonly filtrosActivos = computed(() =>
    chipsFiltros({ linea: this.filtroLinea(), estado: this.filtroEstado(), origen: this.filtroOrigen() }, this.estados()),
  );

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Pedido', sortable: true },
    { key: 'cliente', header: 'Cliente', sortable: true },
    { key: 'linea', header: 'Línea', sortable: true },
    { key: 'ubicacion', header: 'Campo / Pozo' },
    { key: 'origen', header: 'Origen' },
    { key: 'estimado', header: 'Valor estimado' },
    { key: 'diasBadge', header: 'Días desde fin', type: 'badge' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed<FilaPedido[]>(() =>
    filtrarPedidos(this.pedidos(), {
      busqueda: this.busqueda(),
      linea: this.filtroLinea(),
      estado: this.filtroEstado(),
      origen: this.filtroOrigen(),
    }).map((p) => filaPedido(p, this.puedeEditar())),
  );

  protected readonly kpis = computed(() => kpisPedidos(this.pedidos(), this.estados()));

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.servicio.estados().subscribe({
      next: (e) => this.estados.set(e),
      error: () => this.notify.error('Error', 'No se pudo cargar el catálogo de estados.'),
    });
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.servicio.listarTodos().subscribe({
      next: (pedidos) => {
        this.pedidos.set(pedidos);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la lista de pedidos.'));
      },
    });
  }

  protected limpiarFiltros(): void {
    this.filtroLinea.set(null);
    this.filtroEstado.set(null);
    this.filtroOrigen.set(null);
  }

  protected quitarFiltro(key: 'linea' | 'estado' | 'origen'): void {
    if (key === 'linea') this.filtroLinea.set(null);
    else if (key === 'estado') this.filtroEstado.set(null);
    else this.filtroOrigen.set(null);
  }

  protected abrirFiltros(): void {
    const ref = this.dialog.open<PedidosFiltrosDialog, PedidosFiltrosData>({
      title: 'Filtros',
      content: PedidosFiltrosDialog,
      data: {
        linea: this.filtroLinea(),
        estado: this.filtroEstado(),
        origen: this.filtroOrigen(),
        estados: this.estadoOptions(),
      },
      size: 'small',
      footer: false,
    });
    ref.afterClose.subscribe((f: PedidosFiltros | undefined) => {
      if (!f) return;
      this.filtroLinea.set(f.linea);
      this.filtroEstado.set(f.estado);
      this.filtroOrigen.set(f.origen);
    });
  }

  /** Los pedidos de AS2 no se traen solos: se crean en el portal o se vinculan desde esta bandeja. */
  protected sincronizar(): void {
    const ref = this.dialog.open<PorCompletarPanel>({
      title: 'Pedidos de AS2 por completar',
      content: PorCompletarPanel,
      footer: false,
      width: '1100px',
    });
    ref.afterClose.subscribe(() => this.reload());
  }

  protected nuevoPedido(): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos/nuevo']);
  }

  protected verDetalle(row: Record<string, unknown>): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos', row['id']]);
  }

  protected editarPedido(row: Record<string, unknown>): void {
    void this.router.navigate(['/dashboard/facturacion/pedidos', row['id'], 'editar']);
  }
}
