import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import { QhseFiltros } from '../../../shared/components/qhse-filtros';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../../shared/components/qhse-registros-movil';
import {
  StopDetalleDialog,
  type StopDetalleDialogData,
} from '../../components/stop-detalle-dialog';
import { StopRegistrarDialog } from '../../components/stop-registrar-dialog';
import {
  ESTADO_STOP_ETIQUETA,
  ESTADO_STOP_TONO,
  ESTADOS_STOP,
  porcentajesDePareto,
  type EstadoStop,
  type StopResumen,
  type Tendencias,
} from '../../models/stop';
import { StopService } from '../../services/stop.service';

type FiltroEstado = EstadoStop | 'todos';

/** Bandeja de tarjetas STOP y tendencias (Pareto por subcategoría: dónde se concentran los ítems inseguros). */
@Component({
  selector: 'app-stop-plataforma-list-page',
  imports: [
    DatePipe,
    PageHeader,
    KpiStat,
    QhseFiltros,
    QhseRegistrosMovil,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillIconButtonComponent,
    DynadrillDataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
  templateUrl: './stop-list-page.html',
  styleUrl: './stop-list-page.scss',
})
export class StopListPage {
  private readonly servicio = inject(StopService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly datePipe = inject(DatePipe);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly cargando = signal(true);
  protected readonly tarjetas = signal<StopResumen[]>([]);
  protected readonly tendencias = signal<Tendencias | null>(null);
  protected readonly filtroEstado = signal<FiltroEstado>('todos');
  protected readonly busqueda = signal('');

  protected readonly opcionesFiltro = computed(() => [
    { value: 'todos', label: 'Todas', count: this.tarjetas().length },
    ...ESTADOS_STOP.map((e) => ({
      value: e,
      label: ESTADO_STOP_ETIQUETA[e],
      count: this.tarjetas().filter((t) => t.estado === e).length,
    })),
  ]);

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const t = this.tarjetas();
    return [
      { label: 'Registradas', value: t.length, tone: 'neutral' },
      {
        label: 'Abiertas — por atender',
        value: t.filter((x) => x.estado === 'abierto').length,
        tone: 'warning',
      },
      {
        label: 'Con hallazgos en Acciones',
        value: t.filter((x) => x.inseguroEnAcciones).length,
        tone: 'warning',
      },
      {
        label: 'Con hallazgos en Condiciones',
        value: t.filter((x) => x.inseguroEnCondiciones).length,
        tone: 'warning',
      },
    ];
  });

  /** Pareto: subcategorías con más ítems inseguros, con el ancho de cada barra relativo a la mayor. */
  protected readonly pareto = computed(() => {
    const filas = (this.tendencias()?.porSubcategoria ?? []).filter((f) => f.inseguros > 0);
    const pct = porcentajesDePareto(filas);
    return filas.map((f, i) => ({ ...f, pct: pct[i] }));
  });

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'Tarjeta', sortable: true },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'observador', header: 'Observador', sortable: true },
    { key: 'lugar', header: 'Lugar' },
    { key: 'hallazgos', header: 'Inseguros' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private readonly visibles = computed(() => {
    const f = this.filtroEstado();
    const q = this.busqueda().trim().toLowerCase();
    return this.tarjetas()
      .filter((t) => f === 'todos' || t.estado === f)
      .filter(
        (t) =>
          !q ||
          [
            t.codigo,
            t.observador,
            t.observado ?? '',
            t.campo ?? '',
            t.operadora ?? '',
            t.lugar ?? '',
          ].some((v) => v.toLowerCase().includes(q)),
      );
  });

  protected readonly filas = computed(() =>
    this.visibles().map((t) => ({
      id: t.id,
      codigo: t.codigo,
      fecha: this.datePipe.transform(`${t.fecha}T12:00:00`, 'dd/MM/yyyy') ?? t.fecha,
      observador: t.observador,
      lugar: [t.operadora, t.campo, t.lugar].filter(Boolean).join(' · ') || '—',
      hallazgos: t.inseguros,
      estadoBadge: {
        text: ESTADO_STOP_ETIQUETA[t.estado],
        tone: ESTADO_STOP_TONO[t.estado] as DynadrillTagVariant,
      },
    })),
  );

  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.filas().map((f) => ({
      id: f.id,
      eyebrow: f.codigo,
      title: f.observador,
      subtitle: `${f.fecha} · ${f.lugar}`,
      status: f.estadoBadge,
      fields: [{ label: 'Ítems inseguros', value: String(f.hallazgos) }],
      actions: [{ icon: 'eye', label: 'Abrir', primary: true, run: () => this.abrir(f.id) }],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  protected abrir(id: string): void {
    const ref = this.dialogos.open<StopDetalleDialog, StopDetalleDialogData>({
      title: 'Tarjeta STOP',
      content: StopDetalleDialog,
      data: { stopId: id },
      footer: false,
      width: '720px',
    });
    ref.afterClose.subscribe((huboCambio) => {
      if (huboCambio) this.recargar();
    });
  }

  protected nueva(): void {
    const ref = this.dialogos.open<StopRegistrarDialog>({
      title: 'Tarjeta STOP — DYN-SGI-RE-008',
      content: StopRegistrarDialog,
      footer: false,
      width: '760px',
    });
    ref.afterClose.subscribe((r) => {
      if (r) this.recargar();
    });
  }

  private recargar(): void {
    this.cargando.set(true);
    forkJoin({
      lista: this.servicio.listar(),
      tend: this.servicio.tendencias().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ lista, tend }) => {
        this.tarjetas.set(lista);
        this.tendencias.set(tend);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar las tarjetas STOP.'));
      },
    });
  }
}
