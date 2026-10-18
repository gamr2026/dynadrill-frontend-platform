import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import { QhseFiltros } from '../../../shared/components/qhse-filtros';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../../shared/components/qhse-registros-movil';
import { SwaActivarDialog } from '../../components/swa-activar-dialog';
import { SwaDetalleDialog, type SwaDetalleDialogData } from '../../components/swa-detalle-dialog';
import {
  ESTADO_SWA_ETIQUETA,
  ESTADOS_SWA,
  bloqueaElTicket,
  type EstadoSwa,
  type SwaResumen,
} from '../../models/swa';
import { SwaService } from '../../services/swa.service';

type FiltroEstado = EstadoSwa | 'todos';

const TONO: Record<EstadoSwa, DynadrillTagVariant> = {
  activo: 'error',
  evaluado: 'warning',
  cerrado: 'success',
};

/** Bandeja de SWA (Stop Work Authority). Una SWA sin cerrar bloquea su ticket. */
@Component({
  selector: 'app-swa-list-page',
  imports: [
    PageHeader,
    QhseFiltros,
    QhseRegistrosMovil,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillIconButtonComponent,
    DynadrillDataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
  templateUrl: './swa-list-page.html',
  styleUrl: './swa-list-page.scss',
})
export class SwaListPage {
  private readonly servicio = inject(SwaService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly datePipe = inject(DatePipe);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly cargando = signal(true);
  protected readonly swas = signal<SwaResumen[]>([]);
  protected readonly filtroEstado = signal<FiltroEstado>('todos');
  protected readonly busqueda = signal('');

  protected readonly opcionesFiltro = computed(() => [
    { value: 'todos', label: 'Todos', count: this.swas().length },
    ...ESTADOS_SWA.map((e) => ({
      value: e,
      label: ESTADO_SWA_ETIQUETA[e],
      count: this.swas().filter((s) => s.estado === e).length,
    })),
  ]);

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'SWA', sortable: true },
    { key: 'fecha', header: 'Activada', sortable: true },
    { key: 'peligro', header: 'Peligro' },
    { key: 'descripcion', header: 'Descripción' },
    { key: 'servicio', header: 'Servicio bloqueado' },
    { key: 'activadoPor', header: 'Activada por' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private readonly visibles = computed(() => {
    const filtro = this.filtroEstado();
    const q = this.busqueda().trim().toLowerCase();
    return this.swas()
      .filter((s) => filtro === 'todos' || s.estado === filtro)
      .filter(
        (s) =>
          !q ||
          [
            s.codigo,
            s.descripcion,
            s.tipoPeligro,
            s.pedidoCodigo ?? '',
            s.cliente ?? '',
            s.activadoPor,
          ].some((v) => v.toLowerCase().includes(q)),
      );
  });

  protected readonly filas = computed(() =>
    this.visibles().map((s) => ({
      id: s.id,
      codigo: s.codigo,
      fecha: this.datePipe.transform(s.activadoAt, 'dd/MM/yyyy HH:mm') ?? '',
      peligro: s.tipoPeligro,
      descripcion: s.descripcion,
      servicio: s.ticketId
        ? `${s.pedidoCodigo ?? ''} · Ticket ${s.ticketNumero ?? '—'}${bloqueaElTicket(s) ? ' (bloqueado)' : ''}`
        : '—',
      activadoPor: s.activadoPor,
      estadoBadge: { text: ESTADO_SWA_ETIQUETA[s.estado], tone: TONO[s.estado] },
    })),
  );

  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.filas().map((f) => ({
      id: f.id,
      eyebrow: f.codigo,
      title: f.peligro,
      subtitle: `${f.fecha} · ${f.activadoPor}`,
      status: f.estadoBadge,
      fields: [
        { label: 'Descripción', value: f.descripcion },
        { label: 'Servicio', value: f.servicio },
      ],
      actions: [{ icon: 'eye', label: 'Abrir', primary: true, run: () => this.abrir(f.id) }],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  protected abrir(id: string): void {
    const ref = this.dialogos.open<SwaDetalleDialog, SwaDetalleDialogData>({
      title: 'Stop Work Authority',
      content: SwaDetalleDialog,
      data: { swaId: id },
      footer: false,
      width: '720px',
    });
    ref.afterClose.subscribe((huboCambio) => {
      if (huboCambio) this.recargar();
    });
  }

  protected activar(): void {
    const ref = this.dialogos.open<SwaActivarDialog>({
      title: 'Activar SWA — detener el trabajo',
      content: SwaActivarDialog,
      footer: false,
      width: '560px',
    });
    ref.afterClose.subscribe((r) => {
      if (r) this.recargar();
    });
  }

  private recargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.swas.set(lista);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar las SWA.'));
      },
    });
  }
}
