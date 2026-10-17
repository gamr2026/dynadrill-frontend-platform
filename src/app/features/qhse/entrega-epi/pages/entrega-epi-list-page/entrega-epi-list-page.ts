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
  DynadrillTabsComponent,
  type DynadrillTab,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { QhseFiltros } from '../../../shared/components/qhse-filtros';
import { QhseRegistrosMovil, type RegistroMovil } from '../../../shared/components/qhse-registros-movil';
import { AceptacionesTerminosPanel } from '../../components/aceptaciones-terminos-panel';
import { EntregaEpiDetalleDialog, type EntregaEpiDetalleDialogData } from '../../components/entrega-epi-detalle-dialog';
import { EntregaEpiNuevaDialog } from '../../components/entrega-epi-nueva-dialog';
import {
  ESTADO_EPI_ETIQUETA,
  PERMISO_EPI_CREAR,
  mensajeErrorEpi,
  type EntregaEpiResumen,
  type EstadoEpi,
} from '../../models/entrega-epi';
import { EntregaEpiService } from '../../services/entrega-epi.service';

type FiltroEstado = EstadoEpi | 'todos';

const TONO: Record<EstadoEpi, DynadrillTagVariant> = { solicitado: 'warning', aprobado: 'brand', despachado: 'success', rechazado: 'error' };

/** Bandeja de entregas de EPI (DYN-SGI-RE-032): solicitado → aprobado → despachado, y el historial de términos y condiciones de Pumping. */
@Component({
  selector: 'app-entrega-epi-list-page',
  imports: [
    PageHeader,
    KpiStat,
    QhseFiltros,
    QhseRegistrosMovil,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillIconButtonComponent,
    DynadrillDataTableComponent,
    DynadrillTabsComponent,
    AceptacionesTerminosPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
  templateUrl: './entrega-epi-list-page.html',
  styleUrl: './entrega-epi-list-page.scss',
})
export class EntregaEpiListPage {
  private readonly servicio = inject(EntregaEpiService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly datePipe = inject(DatePipe);
  protected readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly tabs: DynadrillTab[] = [{ label: 'Entregas de EPI' }, { label: 'Términos y condiciones (Pumping)' }];
  protected readonly tabActiva = signal(0);
  protected readonly cargando = signal(true);
  protected readonly entregas = signal<EntregaEpiResumen[]>([]);
  protected readonly filtroEstado = signal<FiltroEstado>('todos');
  protected readonly busqueda = signal('');
  protected readonly puedeCrear = computed(() => this.auth.can(PERMISO_EPI_CREAR));

  private readonly filtros: { value: FiltroEstado; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'solicitado', label: 'Solicitado' },
    { value: 'aprobado', label: 'Aprobado' },
    { value: 'despachado', label: 'Despachado' },
    { value: 'rechazado', label: 'Rechazado' },
  ];

  protected readonly conteos = computed(() => {
    const c: Record<FiltroEstado, number> = { todos: 0, solicitado: 0, aprobado: 0, despachado: 0, rechazado: 0 };
    for (const e of this.entregas()) {
      c.todos++;
      c[e.estado]++;
    }
    return c;
  });

  protected readonly opcionesFiltro = computed(() => this.filtros.map(f => ({ ...f, count: this.conteos()[f.value] })));

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const c = this.conteos();
    const sinFirmaTh = this.entregas().filter(e => e.estado === 'despachado' && !e.firmadaPorTalentoHumano).length;
    return [
      { label: 'Solicitadas — por revisar', value: c.solicitado, tone: 'warning' },
      { label: 'Aprobadas — por despachar', value: c.aprobado, tone: 'brand' },
      { label: 'Despachadas', value: c.despachado, tone: 'neutral' },
      { label: 'Sin recibe conforme de Talento Humano', value: sinFirmaTh, tone: 'warning' },
    ];
  });

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'ID', sortable: true },
    { key: 'trabajador', header: 'Persona', sortable: true },
    { key: 'cedula', header: 'Cédula' },
    { key: 'ticket', header: 'Ticket' },
    { key: 'lugar', header: 'Lugar' },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'renglones', header: 'Elementos' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private readonly fechaDe = (iso: string): string => this.datePipe.transform(iso, 'dd/MM/yyyy') ?? '';

  private readonly visibles = computed(() => {
    const filtro = this.filtroEstado();
    const q = this.busqueda().trim().toLowerCase();
    return this.entregas()
      .filter(e => filtro === 'todos' || e.estado === filtro)
      .filter(e => !q || [e.codigo, e.trabajador.nombre, e.trabajador.cedula ?? '', e.lugar?.nombre ?? '', e.ticket?.pedidoCodigo ?? '', String(e.ticket?.numero ?? '')].some(v => v.toLowerCase().includes(q)));
  });

  protected readonly filas = computed(() =>
    this.visibles().map(e => ({
      id: e.id,
      codigo: e.codigo,
      trabajador: e.trabajador.nombre,
      cedula: e.trabajador.cedula ?? '—',
      ticket: e.ticket ? `${e.ticket.numero ?? '—'} · ${e.ticket.pedidoCodigo}` : 'Sin ticket',
      lugar: e.lugar?.nombre ?? '—',
      fecha: this.fechaDe(e.createdAt),
      renglones: e.renglones,
      estadoBadge: { text: ESTADO_EPI_ETIQUETA[e.estado], tone: TONO[e.estado] },
    })),
  );

  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.filas().map(f => ({
      id: f.id,
      eyebrow: f.codigo,
      title: f.trabajador,
      subtitle: `${f.ticket} · ${f.fecha}`,
      status: f.estadoBadge,
      fields: [
        { label: 'Lugar', value: f.lugar },
        { label: 'Elementos', value: String(f.renglones) },
      ],
      actions: [{ icon: 'eye', label: 'Abrir', primary: true, run: () => this.abrir(f.id) }],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  protected abrir(id: string): void {
    const ref = this.dialogos.open<EntregaEpiDetalleDialog, EntregaEpiDetalleDialogData>({
      title: 'Entrega de EPI',
      content: EntregaEpiDetalleDialog,
      data: { entregaId: id },
      footer: false,
      width: '760px',
    });
    ref.afterClose.subscribe(huboCambio => {
      if (huboCambio) this.recargar();
    });
  }

  protected nueva(): void {
    const ref = this.dialogos.open<EntregaEpiNuevaDialog>({ title: 'Nueva entrega de EPI', content: EntregaEpiNuevaDialog, footer: false, width: '520px' });
    ref.afterClose.subscribe(creada => {
      if (!creada) return;
      this.recargar();
      this.abrir((creada as { id: string }).id);
    });
  }

  private recargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: lista => {
        this.entregas.set(lista);
        this.cargando.set(false);
      },
      error: err => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeErrorEpi(err, 'No se pudieron cargar las entregas de EPI.'));
      },
    });
  }
}
