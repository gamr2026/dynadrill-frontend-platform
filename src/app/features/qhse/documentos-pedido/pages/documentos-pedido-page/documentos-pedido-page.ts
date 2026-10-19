import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../../shared/components/qhse-registros-movil';
import {
  DocumentoCargarDialog,
  type DocumentoCargarDialogData,
} from '../../components/documento-cargar-dialog';
import {
  DocumentosDetalleDialog,
  type DocumentosDetalleDialogData,
} from '../../components/documentos-detalle-dialog';
import {
  PERMISO_DOCUMENTOS_GESTIONAR,
  insigniaArt,
  insigniaDocumento,
  type PedidoDocumental,
} from '../../models/documento-pedido';
import { DocumentosPedidoService } from '../../services/documentos-pedido.service';

/**
 * Bandeja «Documentos por pedido» de QHSE, contra `/api/v2/qhse/documentos`: formato de recepción, ART (vale 15 días), PT del día, SFI
 * y Acta de Entrega de Locación (la sube el Supervisor desde su ticket). QHSE carga y anula los suyos y ve el estado de cada pedido.
 */
@Component({
  selector: 'app-documentos-pedido-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    QhseRegistrosMovil,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
    DynadrillInputComponent,
  ],
  templateUrl: './documentos-pedido-page.html',
  styleUrl: './documentos-pedido-page.scss',
})
export class DocumentosPedidoPage {
  private readonly servicio = inject(DocumentosPedidoService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly cargando = signal(true);
  protected readonly pedidos = signal<PedidoDocumental[]>([]);
  protected readonly busqueda = signal('');
  protected readonly puedeCargar = computed(() => this.auth.can(PERMISO_DOCUMENTOS_GESTIONAR));

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'pedido', header: 'Pedido', sortable: true },
    { key: 'tickets', header: 'Tickets' },
    { key: 'cliente', header: 'Cliente' },
    { key: 'campo', header: 'Campo / Pozo' },
    { key: 'recepcion', header: 'Formato de recepción', type: 'badge' },
    { key: 'art', header: 'ART', type: 'badge' },
    { key: 'pt', header: 'PT (hoy)', type: 'badge' },
    { key: 'sfi', header: 'SFI', type: 'badge' },
    { key: 'acta', header: 'Acta de Entrega', type: 'badge' },
  ];

  private readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.pedidos().filter(
      (p) =>
        !q ||
        p.pedidoCodigo.toLowerCase().includes(q) ||
        (p.cliente ?? '').toLowerCase().includes(q) ||
        p.tickets.some((t) => String(t.numero ?? '').includes(q)),
    );
  });

  protected readonly filas = computed(() =>
    this.visibles().map((p) => ({
      id: p.pedidoId,
      codigo: p.pedidoCodigo,
      pedido: p.pedidoCodigo,
      tickets: p.tickets.map((t) => t.numero ?? '—').join(', '),
      cliente: p.cliente ?? '—',
      campo: `${p.campo ?? '—'} / ${p.pozo ?? '—'}`,
      recepcion: insigniaDocumento(p.formatoRecepcion),
      art: insigniaArt(p.art),
      pt: insigniaDocumento(p.ptHoy),
      sfi: insigniaDocumento(p.sfi),
      acta: insigniaDocumento(p.actaEntrega),
    })),
  );

  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.filas().map((f) => ({
      id: f.id,
      eyebrow: `Tickets ${f.tickets}`,
      title: f.pedido,
      subtitle: `${f.cliente} · ${f.campo}`,
      status: f.acta,
      fields: [
        {
          label: 'Formato de recepción',
          value: f.recepcion.text,
          tone: f.recepcion.tone === 'neutral' ? undefined : f.recepcion.tone,
        },
        {
          label: 'ART',
          value: f.art.text,
          tone: f.art.tone === 'neutral' ? undefined : f.art.tone,
        },
        {
          label: 'PT (hoy)',
          value: f.pt.text,
          tone: f.pt.tone === 'neutral' ? undefined : f.pt.tone,
        },
        {
          label: 'SFI',
          value: f.sfi.text,
          tone: f.sfi.tone === 'neutral' ? undefined : f.sfi.tone,
        },
      ],
      actions: [
        {
          icon: 'eye',
          label: 'Ver documentos',
          primary: true,
          run: () => this.ver(f.id, f.codigo),
        },
        ...(this.puedeCargar()
          ? [{ icon: 'upload', label: 'Cargar documento', run: () => this.cargar(f.id, f.codigo) }]
          : []),
      ],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  protected ver(pedidoId: string, pedidoCodigo: string): void {
    const ref = this.dialogos.open<DocumentosDetalleDialog, DocumentosDetalleDialogData>({
      title: 'Documentos del pedido',
      content: DocumentosDetalleDialog,
      data: { pedidoId, pedidoCodigo },
      footer: false,
      width: '720px',
    });
    ref.afterClose.subscribe((huboCambio) => {
      if (huboCambio) this.recargar();
    });
  }

  protected cargar(pedidoId: string, pedidoCodigo: string): void {
    const ref = this.dialogos.open<DocumentoCargarDialog, DocumentoCargarDialogData>({
      title: 'Cargar documento',
      content: DocumentoCargarDialog,
      data: { pedidoId, pedidoCodigo },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe((cargado) => {
      if (cargado) this.recargar();
    });
  }

  private recargar(): void {
    this.cargando.set(true);
    this.servicio.pedidos().subscribe({
      next: (p) => {
        this.pedidos.set(p);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error(
          'Error',
          mensajeDeError(err, 'No se pudieron cargar los documentos por pedido.'),
        );
      },
    });
  }
}
