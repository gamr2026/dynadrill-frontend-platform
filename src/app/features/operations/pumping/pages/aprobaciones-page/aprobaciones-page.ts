import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillTabsComponent,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { RecordCard, type RecordCardData } from '../../../../../shared/components/record-card/record-card';
import { SolicitudCambioItemsService } from '../../services/solicitud-cambio-items.service';
import { ESTADO_SOLICITUD_LABELS, SolicitudCambioItems } from '../../models/solicitud-cambio-items.model';
import {
  RevisarSolicitudCambioItemsDialog,
  RevisarSolicitudDialogData,
  RevisarSolicitudDialogResult,
} from '../../components/revisar-solicitud-cambio-items-dialog';

/**
 * Bandeja consolidada del Supervisor: todas las solicitudes de cambio de
 * ítems que sus Operadores propusieron, sin tener que entrar ticket por
 * ticket a buscarlas ("le gustaría que el supervisor tenga una pestaña de
 * aprobaciones, donde vea todas las solicitudes de aprobación que tiene").
 */
@Component({
  selector: 'app-aprobaciones-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RecordCard, DynadrillTabsComponent, DynadrillDataTableComponent, DynadrillButtonComponent],
  templateUrl: './aprobaciones-page.html',
  styleUrl: './aprobaciones-page.scss',
})
export class AprobacionesPage {
  private readonly service = inject(SolicitudCambioItemsService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  /** Móvil: tarjetas (M · Pumping · Aprobaciones en Figma) en vez de la tabla. */
  protected readonly isMobile = injectNarrowViewport();

  protected readonly loading = signal(true);
  protected readonly solicitudes = signal<SolicitudCambioItems[]>([]);

  protected readonly pendientes = computed(() => this.solicitudes().filter(s => s.estado === 'pendiente'));
  protected readonly resueltas = computed(() =>
    this.solicitudes()
      .filter(s => s.estado !== 'pendiente')
      .sort((a, b) => (b.fechaRevision ?? '').localeCompare(a.fechaRevision ?? '')),
  );

  protected readonly tabs = computed<DynadrillTab[]>(() => [
    { label: 'Pendientes', badge: this.pendientes().length },
    { label: 'Resueltas', badge: this.resueltas().length },
  ]);
  protected readonly activeTabIndex = signal(0);

  protected readonly pendientesColumns: DynadrillDataTableColumn[] = [
    { key: 'ticketCode', header: 'Ticket', searchable: true },
    { key: 'pedidoCode', header: 'Pedido', searchable: true },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'solicitadoPor', header: 'Solicitado por', searchable: true },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'motivo', header: 'Motivo' },
  ];

  protected readonly resueltasColumns: DynadrillDataTableColumn[] = [
    { key: 'ticketCode', header: 'Ticket', searchable: true },
    { key: 'pedidoCode', header: 'Pedido', searchable: true },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'solicitadoPor', header: 'Solicitado por', searchable: true },
    {
      key: 'estadoBadge',
      header: 'Estado',
      type: 'badge',
      filters: [
        { text: ESTADO_SOLICITUD_LABELS.aprobada, value: 'aprobada' },
        { text: ESTADO_SOLICITUD_LABELS.rechazada, value: 'rechazada' },
      ],
    },
    { key: 'revisadoPor', header: 'Revisado por', searchable: true },
    { key: 'fechaRevisionTexto', header: 'Fecha de revisión', sortable: true },
  ];

  protected readonly pendientesRows = computed(() =>
    this.pendientes().map(s => ({
      id: s.id,
      ticketCode: s.ticketCode,
      pedidoCode: s.pedidoCode,
      cliente: s.cliente,
      solicitadoPor: s.solicitadoPor,
      fecha: this.formatearFecha(s.fechaSolicitud),
      motivo: s.motivo,
    })),
  );

  protected readonly resueltasRows = computed(() =>
    this.resueltas().map(s => ({
      id: s.id,
      ticketCode: s.ticketCode,
      pedidoCode: s.pedidoCode,
      cliente: s.cliente,
      solicitadoPor: s.solicitadoPor,
      estadoBadge: {
        text: ESTADO_SOLICITUD_LABELS[s.estado],
        tone: s.estado === 'aprobada' ? ('success' as const) : ('error' as const),
      },
      estado: s.estado,
      revisadoPor: s.revisadoPor ?? '—',
      fechaRevisionTexto: s.fechaRevision ? this.formatearFecha(s.fechaRevision) : '—',
    })),
  );

  protected readonly cards = computed<(RecordCardData & { id: number })[]>(() =>
    this.activeTabIndex() === 0
      ? this.pendientes().map(s => ({
          id: s.id,
          eyebrow: `${s.ticketCode} · ${s.pedidoCode}`,
          title: s.cliente,
          subtitle: `Solicitado por ${s.solicitadoPor} · ${this.formatearFecha(s.fechaSolicitud)}`,
          status: { text: ESTADO_SOLICITUD_LABELS[s.estado], tone: 'warning' },
          fields: [
            { label: 'Motivo', value: s.motivo },
            { label: 'Estado', value: 'Por revisar' },
          ],
          actions: [{ icon: 'eye', label: 'Revisar', run: () => this.revisar({ id: s.id }) }],
        }))
      : this.resueltas().map(s => ({
          id: s.id,
          eyebrow: `${s.ticketCode} · ${s.pedidoCode}`,
          title: s.cliente,
          subtitle: `Solicitado por ${s.solicitadoPor}`,
          status: { text: ESTADO_SOLICITUD_LABELS[s.estado], tone: s.estado === 'aprobada' ? 'success' : 'error' },
          fields: [
            { label: 'Revisado por', value: s.revisadoPor ?? '—' },
            { label: 'Fecha de revisión', value: s.fechaRevision ? this.formatearFecha(s.fechaRevision) : '—' },
          ],
          actions: [{ icon: 'eye', label: 'Ver detalle', run: () => this.revisar({ id: s.id }) }],
        })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: solicitudes => {
        this.solicitudes.set(solicitudes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar las solicitudes de cambio.');
      },
    });
  }

  private formatearFecha(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
  }

  protected onTabChange(index: number): void {
    this.activeTabIndex.set(index);
  }

  protected revisar(row: Record<string, unknown>): void {
    const solicitud = this.solicitudes().find(s => s.id === row['id']);
    if (!solicitud) return;

    const ref = this.dialog.open<RevisarSolicitudCambioItemsDialog, RevisarSolicitudDialogData>({
      title: 'Revisar solicitud',
      content: RevisarSolicitudCambioItemsDialog,
      data: { solicitud },
      footer: false,
      width: '820px',
    });

    ref.afterClose.subscribe((result?: RevisarSolicitudDialogResult) => {
      if (!result) return;
      const usuario = this.auth.currentUser()?.name ?? 'Supervisor';
      const accion =
        result.decision === 'aprobada'
          ? this.service.aprobar(solicitud.id, usuario)
          : this.service.rechazar(solicitud.id, usuario, result.motivoRechazo);

      accion.subscribe({
        next: () => {
          this.notify.success(
            result.decision === 'aprobada' ? 'Solicitud aprobada' : 'Solicitud rechazada',
            result.decision === 'aprobada'
              ? `Los ítems del pedido ${solicitud.pedidoCode} se actualizaron.`
              : `Se notificó el rechazo al operador.`,
          );
          this.reload();
        },
        error: () => this.notify.error('Error', 'No se pudo procesar la decisión. Probá de nuevo.'),
      });
    });
  }
}
