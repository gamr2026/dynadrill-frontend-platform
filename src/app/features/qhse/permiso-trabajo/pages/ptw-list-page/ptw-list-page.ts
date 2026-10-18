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
import { AuthService } from '../../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import { QhseFiltros } from '../../../shared/components/qhse-filtros';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../../shared/components/qhse-registros-movil';
import { PtwAbrirDialog } from '../../components/ptw-abrir-dialog';
import { PtwDetalleDialog, type PtwDetalleDialogData } from '../../components/ptw-detalle-dialog';
import {
  FASE_PTW_ETIQUETA,
  FASES_PTW,
  PERMISO_PTW_GESTIONAR,
  type FasePtw,
  type PtwDetalle,
  type PtwResumen,
} from '../../models/permiso-trabajo';
import { PermisoTrabajoService } from '../../services/permiso-trabajo.service';

type FiltroFase = FasePtw | 'todos';

const TONO: Record<FasePtw, DynadrillTagVariant> = {
  gabinete: 'warning',
  formalizacion: 'brand',
  aprobacion: 'brand',
  aprobado: 'success',
};

/** Bandeja de permisos de trabajo (PTW) del contenedor `qhse`: uno por pedido y día de operación. */
@Component({
  selector: 'app-ptw-list-page',
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
  templateUrl: './ptw-list-page.html',
  styleUrl: './ptw-list-page.scss',
})
export class PtwListPage {
  private readonly servicio = inject(PermisoTrabajoService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly datePipe = inject(DatePipe);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly cargando = signal(true);
  protected readonly ptws = signal<PtwResumen[]>([]);
  protected readonly filtroFase = signal<FiltroFase>('todos');
  protected readonly busqueda = signal('');
  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_PTW_GESTIONAR));

  protected readonly opcionesFiltro = computed(() => [
    { value: 'todos', label: 'Todos', count: this.ptws().length },
    ...FASES_PTW.map((f) => ({
      value: f,
      label: FASE_PTW_ETIQUETA[f],
      count: this.ptws().filter((p) => p.fase === f).length,
    })),
  ]);

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'PTW', sortable: true },
    { key: 'dia', header: 'Día de operación', sortable: true },
    { key: 'pedido', header: 'Pedido', sortable: true },
    { key: 'ticket', header: 'Ticket' },
    { key: 'cliente', header: 'Cliente' },
    { key: 'campo', header: 'Campo / Pozo' },
    { key: 'faseBadge', header: 'Fase', type: 'badge' },
  ];

  private readonly fechaDe = (dia: string): string =>
    this.datePipe.transform(`${dia}T12:00:00`, 'dd/MM/yyyy') ?? dia;

  private readonly visibles = computed(() => {
    const filtro = this.filtroFase();
    const q = this.busqueda().trim().toLowerCase();
    return this.ptws()
      .filter((p) => filtro === 'todos' || p.fase === filtro)
      .filter(
        (p) =>
          !q ||
          [
            p.codigo,
            p.pedidoCodigo,
            p.cliente ?? '',
            p.campo ?? '',
            p.pozo ?? '',
            String(p.ticketNumero ?? ''),
          ].some((v) => v.toLowerCase().includes(q)),
      );
  });

  protected readonly filas = computed(() =>
    this.visibles().map((p) => ({
      id: p.id,
      codigo: p.codigo,
      dia: this.fechaDe(p.diaOperacion),
      pedido: p.pedidoCodigo,
      ticket: p.ticketNumero ?? '—',
      cliente: p.cliente ?? '—',
      campo: `${p.campo ?? '—'} / ${p.pozo ?? '—'}`,
      faseBadge: { text: FASE_PTW_ETIQUETA[p.fase], tone: TONO[p.fase] },
    })),
  );

  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.filas().map((f) => ({
      id: f.id,
      eyebrow: f.codigo,
      title: f.pedido,
      subtitle: `${f.dia} · Ticket ${f.ticket}`,
      status: f.faseBadge,
      fields: [
        { label: 'Cliente', value: f.cliente },
        { label: 'Campo / Pozo', value: f.campo },
      ],
      actions: [{ icon: 'eye', label: 'Abrir', primary: true, run: () => this.abrir(f.id) }],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  protected abrir(id: string): void {
    const ref = this.dialogos.open<PtwDetalleDialog, PtwDetalleDialogData>({
      title: 'Permiso de trabajo',
      content: PtwDetalleDialog,
      data: { ptwId: id },
      footer: false,
      width: '720px',
    });
    ref.afterClose.subscribe((huboCambio) => {
      if (huboCambio) this.recargar();
    });
  }

  protected nuevo(): void {
    const ref = this.dialogos.open<PtwAbrirDialog>({
      title: 'Abrir PTW',
      content: PtwAbrirDialog,
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe((creado) => {
      if (!creado) return;
      this.recargar();
      this.abrir((creado as PtwDetalle).id);
    });
  }

  private recargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.ptws.set(lista);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error(
          'Error',
          mensajeDeError(err, 'No se pudieron cargar los permisos de trabajo.'),
        );
      },
    });
  }
}
