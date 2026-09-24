import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillKpiRowItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { EstadoSolicitudDespacho, SolicitudDespachoBodega } from '../../../facturacion/models/solicitud-despacho-bodega.model';
import { SolicitudesDespachoBodegaService } from '../../../facturacion/services/pedido.service';
import { GestionarDespachoDialog, GestionarDespachoDialogData } from '../../components/gestionar-despacho-dialog';

const ESTADO_BADGE: Record<EstadoSolicitudDespacho, { text: string; tone: 'success' | 'warning' | 'error' }> = {
  pendiente: { text: 'Pendiente', tone: 'warning' },
  despachado: { text: 'Despachado', tone: 'success' },
  rechazado: { text: 'Rechazado', tone: 'error' },
};

/**
 * Bandeja de Bodega — correlación con "Orden Salida Material"/"Aprobar
 * Orden Salida Material" de AS2. Facturación pide el despacho desde el
 * detalle del Pedido (`solicitar-despacho-dialog.ts`); acá Bodega lo
 * resuelve (despacha adjuntando el respaldo, o rechaza con motivo).
 *
 * Solo depende de `SolicitudesDespachoBodegaService` — Bodega no tiene
 * acceso a `GET /facturacion/pedidos` (ese es terreno de Facturación/
 * Ventas), así que el backend ya embebe `pedidoCode`/`pedidoCliente` en
 * cada fila de la bandeja (ver `listarSolicitudesDespachoBandeja`).
 */
@Component({
  selector: 'app-despachos-bodega-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
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
  private readonly solicitudesService = inject(SolicitudesDespachoBodegaService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly solicitudes = signal<SolicitudDespachoBodega[]>([]);
  protected readonly filtroEstado = signal<EstadoSolicitudDespacho | null>('pendiente');

  protected readonly estadoOptions: DynadrillSelectOption[] = [
    { label: 'Pendientes', value: 'pendiente' },
    { label: 'Despachadas', value: 'despachado' },
    { label: 'Rechazadas', value: 'rechazado' },
    { label: 'Todas', value: '' },
  ];

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.solicitudes();
    return [
      { label: 'Pendientes', value: all.filter(s => s.estado === 'pendiente').length, tone: 'warning' },
      { label: 'Despachadas', value: all.filter(s => s.estado === 'despachado').length, tone: 'success' },
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
        pedidoCode: s.pedidoCode ?? '—',
        cliente: s.pedidoCliente ?? '—',
        bodegaOrigen: s.bodegaOrigen,
        fechaRequerida: s.fechaRequerida.slice(0, 10),
        estadoBadge: ESTADO_BADGE[s.estado],
      }));
  });

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.solicitudesService.listar().subscribe({
      next: solicitudes => {
        this.solicitudes.set(solicitudes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la bandeja de despachos.');
      },
    });
  }

  protected gestionar(row: Record<string, unknown>): void {
    const solicitud = this.solicitudes().find(s => s.id === row['id']);
    if (!solicitud) return;
    const ref = this.dialog.open<GestionarDespachoDialog, GestionarDespachoDialogData>({
      title: `Solicitud de Despacho ${solicitud.numero}`,
      content: GestionarDespachoDialog,
      data: { solicitud },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe(actualizado => {
      if (actualizado) this.reload();
    });
  }
}
