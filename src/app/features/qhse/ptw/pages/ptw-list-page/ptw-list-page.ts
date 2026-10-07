import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillPhaseTrackComponent,
  DynadrillScreenHeaderComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import {
  PTW_FASE_LABELS,
  PTW_FASE_ORDER,
  PTW_FASE_STEPS,
  PTW_TICKET_TIPO_LABELS,
  PtwFase,
  PtwMatrix,
  ptwCerrado,
} from '../../models/ptw.model';
import { PtwService } from '../../services/ptw.service';
import { AppNotificationItem, NotificationsService } from '../../../../../core/services/notifications.service';
import { PedidoService } from '../../../../facturacion/services/pedido.service';
import { VerPedidoDialog, VerPedidoDialogData } from '../../../../facturacion/components/ver-pedido-dialog';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';

const FASE_BADGES: Record<PtwFase, { text: string; tone: BadgeTone }> = {
  gabinete: { text: PTW_FASE_LABELS['gabinete'], tone: 'neutral' },
  ingreso: { text: PTW_FASE_LABELS['ingreso'], tone: 'info' },
  verificaciones: { text: PTW_FASE_LABELS['verificaciones'], tone: 'warning' },
  formalizacion: { text: PTW_FASE_LABELS['formalizacion'], tone: 'warning' },
  ejecucion: { text: PTW_FASE_LABELS['ejecucion'], tone: 'info' },
  gestion_documental: { text: PTW_FASE_LABELS['gestion_documental'], tone: 'info' },
};

const CERRADO_BADGE: { text: string; tone: BadgeTone } = { text: 'Aprobado', tone: 'success' };

@Component({
  selector: 'app-ptw-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
    DynadrillPhaseTrackComponent,
  ],
  templateUrl: './ptw-list-page.html',
  styleUrl: './ptw-list-page.scss',
})
export class PtwListPage {
  private readonly ptwService = inject(PtwService);
  private readonly pedidoService = inject(PedidoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationsService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialog = inject(DynadrillDialogService);

  protected readonly loading = signal(true);
  protected readonly records = signal<PtwMatrix[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.records();
    return [
      { label: 'Total PTW', value: all.length },
      { label: 'En preparación', value: all.filter(p => p.fase === 'gabinete' || p.fase === 'ingreso').length },
      { label: 'En verificación/formalización', value: all.filter(p => p.fase === 'verificaciones' || p.fase === 'formalizacion').length },
      { label: 'Aprobados', value: all.filter(p => ptwCerrado(p)).length },
    ];
  });

  /** Sin fixed:'left'/'right' ni scrollX — ver nota en iperc-list-page.ts (mismo criterio contra el pipeline de columnas fijas de nz-table). */
  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'servicio', header: 'Servicio', searchable: true },
    { key: 'ubicacion', header: 'Ubicación', searchable: true },
    { key: 'faseBadge', header: 'Fase actual', type: 'badge' },
  ]);

  protected readonly faseSteps = PTW_FASE_ORDER.length;
  protected readonly faseLabels = PTW_FASE_STEPS;

  protected readonly rows = computed(() =>
    this.records().map(p => ({
      id: p.id,
      code: p.code,
      servicio: p.ticketTipo ? PTW_TICKET_TIPO_LABELS[p.ticketTipo] : '—',
      ubicacion: p.ubicacion,
      pedidoId: p.pedidoId,
      pedidoCode: p.pedidoCode,
      faseBadge: ptwCerrado(p) ? CERRADO_BADGE : FASE_BADGES[p.fase],
      faseIndex: ptwCerrado(p) ? PTW_FASE_ORDER.length : PTW_FASE_ORDER.indexOf(p.fase),
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  /**
   * HSE-SITIO-001: "Sistema de alertas de documentos pendientes" — un PTW
   * no puede avanzar de Fase 1 sin los 4 documentos cargados, así que
   * "pendiente" solo puede darse mientras sigue en 'gabinete'. Va al
   * mismo mecanismo de notificación global que ya usa IPERC (campanita
   * del header), no solo un aviso dentro de esta pantalla.
   */
  protected readonly notificationItems = computed<AppNotificationItem[]>(() =>
    this.records()
      .filter(p => p.fase === 'gabinete' && p.documentos.some(d => !d.cargado))
      .map(p => {
        const faltantes = p.documentos.filter(d => !d.cargado);
        return {
          id: `ptw-documentos-pendientes-${p.id}`,
          title: `${p.code} — documentos pendientes`,
          description: `Falta cargar: ${faltantes.map(d => d.label).join(', ')}`,
          tone: 'warning',
          link: `/dashboard/qhse/ptw/${p.id}`,
        };
      }),
  );

  constructor() {
    this.ptwService.list().subscribe({
      next: records => {
        this.records.set(records);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    effect(() => this.notifications.setSource('ptw', this.notificationItems()));
    inject(DestroyRef).onDestroy(() => this.notifications.clearSource('ptw'));
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }

  /**
   * "Botón con ícono para ver el detalle de las líneas estimadas definidas
   * en el ticket" — contexto de qué se va a usar en el trabajo (la
   * "Actividad" IPERC es genérica de la línea de servicio, no dice nada de
   * eso). Reusa el mismo diálogo de solo lectura que ya usa Pumping.
   */
  protected verLineasPedido(row: Record<string, unknown>): void {
    const pedidoId = row['pedidoId'] as number | undefined;
    if (!pedidoId) {
      this.notify.error('Sin pedido vinculado', 'Este PTW no tiene un Pedido de Ventas asociado.');
      return;
    }
    this.pedidoService.get(pedidoId).subscribe({
      next: pedido =>
        this.dialog.open<VerPedidoDialog, VerPedidoDialogData>({
          title: `Pedido ${pedido.code} — ${pedido.cliente}`,
          content: VerPedidoDialog,
          data: { pedido },
          footer: false,
          width: '760px',
        }),
      error: () => this.notify.error('Error', 'No se pudo cargar el Pedido vinculado.'),
    });
  }
}
