import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillKpiRowItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADOS_FUERA_DE_ALCANCE,
  ESTADO_PEDIDO_LABELS,
  EstadoPedido,
  LINEA_SERVICIO_LABELS,
  LineaServicio,
  Pedido,
  valorEstimadoPedido,
} from '../../models/pedido.model';
import { DocumentoOperativo, TIPO_DOCUMENTO_OPERATIVO_LABELS } from '../../models/documento-operativo.model';
import { DocumentoOperativoService, PedidoService } from '../../services/pedido.service';
import { NuevoPedidoDialog } from '../../components/nuevo-pedido-dialog';
import { AppNotificationItem, NotificationsService } from '../../../../core/services/notifications.service';

/** Días entre `desde` y hoy (0 si no hay fecha). */
function diasDesde(desde?: string): number {
  if (!desde) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 86_400_000));
}

/**
 * Fase 1 — Lista de Pedidos + alta desde el Portal (FACT-001) + sincronización
 * bidireccional con AS2 (mock).
 */
@Component({
  selector: 'app-pedidos-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedidos-list-page.html',
  styleUrl: './pedidos-list-page.scss',
})
export class PedidosListPage {
  private readonly pedidoService = inject(PedidoService);
  private readonly docService = inject(DocumentoOperativoService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly sincronizando = signal(false);
  protected readonly pedidos = signal<Pedido[]>([]);
  private readonly documentos = signal<DocumentoOperativo[]>([]);

  // ── Filtros ──
  protected readonly filtroLinea = signal<LineaServicio | null>(null);
  protected readonly filtroEstado = signal<EstadoPedido | null>(null);
  protected readonly filtroOrigen = signal<'as2' | 'portal' | null>(null);

  protected readonly lineaOptions: DynadrillSelectOption[] = (Object.entries(LINEA_SERVICIO_LABELS) as [LineaServicio, string][]).map(
    ([value, label]) => ({ label, value }),
  );
  protected readonly estadoOptions: DynadrillSelectOption[] = (Object.entries(ESTADO_PEDIDO_LABELS) as [EstadoPedido, string][]).map(
    ([value, label]) => ({ label, value }),
  );
  protected readonly origenOptions: DynadrillSelectOption[] = [
    { label: 'AS2', value: 'as2' },
    { label: 'Portal', value: 'portal' },
  ];

  protected readonly hayFiltros = computed(() => !!this.filtroLinea() || !!this.filtroEstado() || !!this.filtroOrigen());

  protected limpiarFiltros(): void {
    this.filtroLinea.set(null);
    this.filtroEstado.set(null);
    this.filtroOrigen.set(null);
  }

  private readonly pedidosFiltrados = computed(() =>
    this.pedidos().filter(
      p =>
        (!this.filtroLinea() || p.lineaServicio === this.filtroLinea()) &&
        (!this.filtroEstado() || p.estado === this.filtroEstado()) &&
        (!this.filtroOrigen() || p.origen === this.filtroOrigen()),
    ),
  );

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Pedido', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', sortable: true, searchable: true },
    { key: 'linea', header: 'Línea', sortable: true, searchable: true },
    { key: 'ubicacion', header: 'Campo / Pozo', searchable: true },
    { key: 'origen', header: 'Origen' },
    { key: 'estimado', header: 'Valor estimado' },
    { key: 'diasBadge', header: 'Días desde fin', type: 'badge' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.pedidosFiltrados().map(p => {
      const dias = diasDesde(p.fechaFinServicio);
      const tono: 'success' | 'warning' | 'error' = dias <= 3 ? 'success' : dias <= 7 ? 'warning' : 'error';
      const fueraDeAlcance = ESTADOS_FUERA_DE_ALCANCE.includes(p.estado);
      const estadoTono: 'neutral' | 'warning' | 'success' =
        fueraDeAlcance ? 'neutral' : p.estado === 'ticket_firmado' || p.estado === 'aot_generada' ? 'success' : 'warning';
      return {
        id: p.id,
        code: p.code,
        cliente: p.cliente,
        linea: LINEA_SERVICIO_LABELS[p.lineaServicio],
        ubicacion: `${p.campo} — ${p.pozo}`,
        origen: p.origen.toUpperCase(),
        estimado: '$' + valorEstimadoPedido(p).toFixed(2),
        diasBadge: { text: dias + ' d', tone: tono },
        estadoBadge: { text: ESTADO_PEDIDO_LABELS[p.estado], tone: estadoTono },
      };
    }),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const ps = this.pedidos();
    const enProceso = ps.filter(p => !ESTADOS_FUERA_DE_ALCANCE.includes(p.estado));
    return [
      { label: 'Pedidos', value: ps.length, tone: 'neutral' },
      { label: 'En proceso', value: enProceso.length, tone: 'brand' },
      { label: 'Firmados / con AOT', value: ps.filter(p => p.estado === 'ticket_firmado' || p.estado === 'aot_generada').length, tone: 'success' },
      { label: 'Origen AS2', value: ps.filter(p => p.origen === 'as2').length, tone: 'neutral' },
    ];
  });

  /** Campana del facturador — documentos operativos recibidos en las últimas 72 h. */
  private readonly notificationItems = computed<AppNotificationItem[]>(() => {
    const pedidosPorId = new Map(this.pedidos().map(p => [p.id, p]));
    const hace72h = Date.now() - 72 * 60 * 60 * 1000;
    return this.documentos()
      .filter(d => d.recibidoAt && new Date(d.recibidoAt).getTime() >= hace72h)
      .map(d => {
        const p = pedidosPorId.get(d.pedidoId);
        return {
          id: `facturacion-doc-${d.id}`,
          title: `${d.origen === 'fcr' ? 'FCR' : 'Pumping'} cargó ${TIPO_DOCUMENTO_OPERATIVO_LABELS[d.tipo]}`,
          description: `${d.header?.pozo ?? p?.pozo ?? ''} · Pedido ${p?.code ?? d.pedidoId}${d.fecha ? ' · ' + d.fecha : ''}`,
          tone: 'info' as const,
          link: p ? '/dashboard/facturacion/pedidos/' + p.id : undefined,
        };
      });
  });

  constructor() {
    this.reload();
    effect(() => this.notifications.setSource('facturacion', this.notificationItems()));
    inject(DestroyRef).onDestroy(() => this.notifications.clearSource('facturacion'));
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ pedidos: this.pedidoService.list(), documentos: this.docService.listTodos() }).subscribe({
      next: ({ pedidos, documentos }) => {
        this.pedidos.set(pedidos);
        this.documentos.set(documentos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la lista de pedidos.');
      },
    });
  }

  protected sincronizar(): void {
    this.sincronizando.set(true);
    this.pedidoService.sincronizarConAs2().subscribe({
      next: ({ pedidos, nuevos }) => {
        this.pedidos.set(pedidos);
        this.sincronizando.set(false);
        if (nuevos > 0) {
          this.notify.success('Sincronizado', `${nuevos} pedido(s) nuevo(s) traído(s) desde AS2.`);
        } else {
          this.notify.info('Sincronizado', 'No hay pedidos nuevos en AS2.');
        }
      },
      error: () => {
        this.sincronizando.set(false);
        this.notify.error('Error', 'No se pudo sincronizar con AS2.');
      },
    });
  }

  protected nuevoPedido(): void {
    const ref = this.dialog.open<NuevoPedidoDialog>({
      title: 'Nuevo pedido',
      content: NuevoPedidoDialog,
      footer: false,
      width: '760px',
    });
    ref.afterClose.subscribe(pedido => {
      if (pedido) this.reload();
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    this.router.navigate(['/dashboard/facturacion/pedidos', row['id']]);
  }
}
