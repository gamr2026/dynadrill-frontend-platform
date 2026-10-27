import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillChipGroupComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillKpiRowItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { GestionarDespachoDialog, GestionarDespachoDialogData } from '../../components/gestionar-despacho-dialog';
import { injectNarrowViewport } from '../../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { RecordCard, type RecordCardData } from '../../../../shared/components/record-card/record-card';
import { mensajeErrorInventario, type DespachoBodega, type EstadoDespacho } from '../../models/inventario-plataforma.model';
import { InventarioPlataformaService } from '../../services/inventario-plataforma.service';

const ESTADO_BADGE: Record<EstadoDespacho, { text: string; tone: 'success' | 'warning' | 'error' }> = {
  solicitado: { text: 'Pendiente', tone: 'warning' },
  realizado: { text: 'Despachado', tone: 'success' },
  rechazado: { text: 'Rechazado', tone: 'error' },
};

/**
 * Bandeja de Bodega — correlación con "Orden Salida Material"/"Aprobar Orden Salida Material" de AS2. Facturación pide el despacho
 * desde el detalle del pedido (con la prefactura generada); acá Bodega lo resuelve: respalda con salidas de stock, despacha
 * adjuntando el documento de respaldo, o rechaza con motivo. Todo sale del contenedor de operaciones (`/api/operaciones/inventario/despachos`):
 * la solicitud trae el código del pedido y el cliente, así que Bodega no necesita consultar pedidos.
 */
@Component({
  selector: 'app-despachos-bodega-list-page',
  imports: [
    PageHeader,
    RecordCard,
    DynadrillChipGroupComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './despachos-bodega-list-page.html',
  styleUrl: './despachos-bodega-list-page.scss',
})
export class DespachosBodegaListPage {
  private readonly inventario = inject(InventarioPlataformaService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  /** Móvil: chips de estado + tarjetas (M · Despachos a Facturación · Lista en Figma). */
  protected readonly isMobile = injectNarrowViewport();

  protected readonly loading = signal(true);
  protected readonly solicitudes = signal<DespachoBodega[]>([]);
  protected readonly filtroEstado = signal<EstadoDespacho | null>('solicitado');

  protected readonly estadoOptions: DynadrillSelectOption[] = [
    { label: 'Pendientes', value: 'solicitado' },
    { label: 'Despachadas', value: 'realizado' },
    { label: 'Rechazadas', value: 'rechazado' },
    { label: 'Todas', value: '' },
  ];

  protected readonly estadoChips = this.estadoOptions.map(o => o.label);
  protected readonly estadoChipActivo = computed(
    () => this.estadoOptions.find(o => (o.value || null) === this.filtroEstado())?.label ?? 'Todas',
  );

  protected onEstadoChip(selected: string[]): void {
    const option = this.estadoOptions.find(o => o.label === selected[0]);
    if (option) this.filtroEstado.set((option.value as EstadoDespacho | '') || null);
  }

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.solicitudes();
    return [
      { label: 'Pendientes', value: all.filter(s => s.estado === 'solicitado').length, tone: 'warning' },
      { label: 'Despachadas', value: all.filter(s => s.estado === 'realizado').length, tone: 'success' },
      { label: 'Rechazadas', value: all.filter(s => s.estado === 'rechazado').length, tone: 'error' },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'numero', header: 'Número', sortable: true, searchable: true },
    { key: 'pedidoCode', header: 'Pedido', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'bodegaOrigen', header: 'Bodega origen' },
    { key: 'fechaRequerida', header: 'Fecha requerida', sortable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() => {
    const filtro = this.filtroEstado();
    return this.solicitudes()
      .filter(s => !filtro || s.estado === filtro)
      .map(s => ({
        id: s.id,
        numero: s.numero,
        pedidoCode: s.pedidoCodigo ?? '—',
        cliente: s.cliente?.nombre ?? '—',
        bodegaOrigen: s.bodega.nombre,
        fechaRequerida: s.fechaRequerida.slice(0, 10),
        estadoBadge: ESTADO_BADGE[s.estado],
      }));
  });

  protected readonly cards = computed<(RecordCardData & { id: string })[]>(() => {
    const filtro = this.filtroEstado();
    return this.solicitudes()
      .filter(s => !filtro || s.estado === filtro)
      .map(s => ({
        id: s.id,
        eyebrow: `Despacho ${s.numero}`,
        title: s.cliente?.nombre ?? '—',
        subtitle: `Pedido ${s.pedidoCodigo ?? '—'} • ${s.bodega.nombre}`,
        status: ESTADO_BADGE[s.estado],
        fields: [
          { label: 'Fecha requerida', value: s.fechaRequerida.slice(0, 10) },
          { label: 'Ítems', value: String(s.items.length) },
        ],
        actions: [{ icon: 'eye', label: 'Ver / gestionar', run: () => this.gestionar({ id: s.id }) }],
      }));
  });

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.inventario.despachos().subscribe({
      next: solicitudes => {
        this.solicitudes.set(solicitudes);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        this.notify.error('Error', mensajeErrorInventario(err, 'No se pudo cargar la bandeja de despachos.'));
      },
    });
  }

  protected gestionar(row: Record<string, unknown>): void {
    const solicitud = this.solicitudes().find(s => s.id === row['id']);
    if (!solicitud) return;
    const ref = this.dialog.open<GestionarDespachoDialog, GestionarDespachoDialogData>({
      title: `Solicitud de Despacho ${solicitud.numero}`,
      content: GestionarDespachoDialog,
      data: { despacho: solicitud },
      footer: false,
      width: '720px',
    });
    ref.afterClose.subscribe(actualizado => {
      if (actualizado) this.reload();
    });
  }
}
