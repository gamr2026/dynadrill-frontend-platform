import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
import { EmergenciaActivarDialog } from '../../components/emergencia-activar-dialog';
import {
  ESTADO_EMERGENCIA_ETIQUETA,
  ESTADOS_EMERGENCIA,
  type EmergenciaResumen,
  type EstadoEmergencia,
  type TableroEmergencias,
} from '../../models/emergencia';
import { EmergenciaService } from '../../services/emergencia.service';

type FiltroEstado = EstadoEmergencia | 'todos';

const TONO: Record<EstadoEmergencia, DynadrillTagVariant> = {
  activa: 'error',
  controlada: 'warning',
  cerrada: 'success',
};

const ORIGEN: Record<'swa' | 'derrame', string> = { swa: 'SWA', derrame: 'Derrame' };

/** Bandeja de emergencias / MEDEVAC (HSE-TRIAGE-001) y tablero del año: estados, niveles, heridos por triage, MEDEVAC y Reporte Flash. */
@Component({
  selector: 'app-emergencia-plataforma-list-page',
  imports: [
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
  templateUrl: './emergencia-list-page.html',
  styleUrl: './emergencia-list-page.scss',
})
export class EmergenciaListPage {
  private readonly servicio = inject(EmergenciaService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly datePipe = inject(DatePipe);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly cargando = signal(true);
  protected readonly emergencias = signal<EmergenciaResumen[]>([]);
  protected readonly tablero = signal<TableroEmergencias | null>(null);
  protected readonly filtroEstado = signal<FiltroEstado>('todos');
  protected readonly busqueda = signal('');

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const t = this.tablero();
    if (!t) return [];
    return [
      { label: `Emergencias ${t.anio}`, value: t.total, tone: 'neutral' },
      {
        label: 'Activas',
        value: t.porEstado.activa,
        tone: t.porEstado.activa ? 'error' : 'neutral',
      },
      {
        label: 'Nivel 3 (mayores)',
        value: t.porNivel.nivel3,
        tone: t.porNivel.nivel3 ? 'error' : 'neutral',
      },
      {
        label: 'Heridos en rojo',
        value: t.heridosPorTriage.rojo,
        tone: t.heridosPorTriage.rojo ? 'error' : 'neutral',
      },
      { label: 'MEDEVAC activados', value: t.medevacActivados, tone: 'warning' },
      {
        label: 'Reporte Flash pendiente',
        value: t.reporteFlashPendientes,
        tone: t.reporteFlashPendientes ? 'warning' : 'neutral',
      },
    ];
  });

  protected readonly opcionesFiltro = computed(() => [
    { value: 'todos', label: 'Todas', count: this.emergencias().length },
    ...ESTADOS_EMERGENCIA.map((e) => ({
      value: e,
      label: ESTADO_EMERGENCIA_ETIQUETA[e],
      count: this.emergencias().filter((x) => x.estado === e).length,
    })),
  ]);

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'Emergencia', sortable: true },
    { key: 'fecha', header: 'Activada', sortable: true },
    { key: 'tipo', header: 'Tipo' },
    { key: 'descripcion', header: 'Descripción' },
    { key: 'origen', header: 'Origen' },
    { key: 'servicio', header: 'Servicio' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private readonly visibles = computed(() => {
    const filtro = this.filtroEstado();
    const q = this.busqueda().trim().toLowerCase();
    return this.emergencias()
      .filter((e) => filtro === 'todos' || e.estado === filtro)
      .filter(
        (e) =>
          !q ||
          [e.codigo, e.descripcion, e.tipo.nombre, e.ubicacion ?? '', e.pedidoCodigo ?? ''].some(
            (v) => v.toLowerCase().includes(q),
          ),
      );
  });

  protected readonly filas = computed(() =>
    this.visibles().map((e) => ({
      id: e.id,
      codigo: e.codigo,
      fecha: this.datePipe.transform(e.activadoAt, 'dd/MM/yyyy HH:mm') ?? '',
      tipo: e.tipo.nombre,
      descripcion: e.descripcion,
      origen: e.origen ? `Escalada desde ${ORIGEN[e.origen]}` : 'Directa',
      servicio: e.ticketId ? `${e.pedidoCodigo ?? ''} · Ticket ${e.ticketNumero ?? '—'}` : '—',
      estadoBadge: { text: ESTADO_EMERGENCIA_ETIQUETA[e.estado], tone: TONO[e.estado] },
    })),
  );

  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.filas().map((f) => ({
      id: f.id,
      eyebrow: f.codigo,
      title: f.tipo,
      subtitle: f.fecha,
      status: f.estadoBadge,
      fields: [
        { label: 'Descripción', value: f.descripcion },
        { label: 'Origen', value: f.origen },
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
    void this.router.navigate(['/dashboard/qhse/emergencias', id]);
  }

  protected activar(): void {
    const ref = this.dialogos.open<EmergenciaActivarDialog>({
      title: 'Activar emergencia',
      content: EmergenciaActivarDialog,
      footer: false,
      width: '560px',
    });
    ref.afterClose.subscribe((r) => {
      if (r) this.recargar();
    });
  }

  private recargar(): void {
    this.cargando.set(true);
    forkJoin({
      lista: this.servicio.listar(),
      tablero: this.servicio.tablero().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ lista, tablero }) => {
        this.emergencias.set(lista);
        this.tablero.set(tablero);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar las emergencias.'));
      },
    });
  }
}
