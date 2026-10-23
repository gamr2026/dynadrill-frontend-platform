import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import { QhseFiltros } from '../../../shared/components/qhse-filtros';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../../shared/components/qhse-registros-movil';
import { DerrameAlertaDialog } from '../../components/derrame-alerta-dialog';
import {
  ESTADO_DERRAME_ETIQUETA,
  ESTADOS_DERRAME,
  PERMISO_DERRAMES_CONFIGURAR,
  formatoBarriles,
  type DerrameResumen,
  type EstadoDerrame,
  type TableroDerrames,
} from '../../models/derrame';
import { DerrameService } from '../../services/derrame.service';

type FiltroEstado = EstadoDerrame | 'todos';

const TONO: Record<EstadoDerrame, DynadrillTagVariant> = {
  activo: 'error',
  contenido: 'warning',
  cerrado: 'success',
};

/** Bandeja de derrames (HSE-AMBIENTAL-002) con el tablero del año (volumen real derramado y notificaciones al MAE pendientes). */
@Component({
  selector: 'app-derrame-list-page',
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
  templateUrl: './derrame-list-page.html',
  styleUrl: './derrame-list-page.scss',
})
export class DerrameListPage {
  private readonly servicio = inject(DerrameService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly datePipe = inject(DatePipe);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly cargando = signal(true);
  protected readonly derrames = signal<DerrameResumen[]>([]);
  protected readonly tablero = signal<TableroDerrames | null>(null);
  protected readonly filtroEstado = signal<FiltroEstado>('todos');
  protected readonly busqueda = signal('');
  protected readonly puedeConfigurar = computed(() => this.auth.can(PERMISO_DERRAMES_CONFIGURAR));

  protected readonly opcionesFiltro = computed(() => [
    { value: 'todos', label: 'Todos', count: this.derrames().length },
    ...ESTADOS_DERRAME.map((e) => ({
      value: e,
      label: ESTADO_DERRAME_ETIQUETA[e],
      count: this.derrames().filter((d) => d.estado === e).length,
    })),
  ]);

  protected readonly kpis = computed<
    { label: string; value: string | number; tone: KpiStatTone; caption: string }[]
  >(() => {
    const t = this.tablero();
    if (!t) return [];
    return [
      {
        label: `Derrames ${t.anio}`,
        value: t.total,
        tone: 'neutral',
        caption: `${t.porEstado.activo} activos`,
      },
      {
        label: 'Volumen real derramado',
        value: formatoBarriles(t.volumenRealBarriles),
        tone: 'info',
        caption: t.sinVolumenConfirmado ? `${t.sinVolumenConfirmado} sin volumen confirmado` : '',
      },
      {
        label: 'Notificación al MAE pendiente',
        value: t.maePendientes,
        tone: t.maePendientes ? 'error' : 'success',
        caption: '',
      },
      {
        label: `Contenidos en ${t.plazoContencionMinutos} min`,
        value: `${t.contenidosEnPlazo} de ${t.contenidos}`,
        tone: 'brand',
        caption: '',
      },
    ];
  });

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'Derrame', sortable: true },
    { key: 'fecha', header: 'Activado', sortable: true },
    { key: 'ubicacion', header: 'Dónde' },
    { key: 'volumen', header: 'Volumen' },
    { key: 'descripcion', header: 'Descripción' },
    { key: 'servicio', header: 'Servicio' },
    { key: 'mae', header: 'MAE' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private readonly visibles = computed(() => {
    const filtro = this.filtroEstado();
    const q = this.busqueda().trim().toLowerCase();
    return this.derrames()
      .filter((d) => filtro === 'todos' || d.estado === filtro)
      .filter(
        (d) =>
          !q ||
          [d.codigo, d.descripcion, d.ubicacion.nombre, d.banda.nombre, d.pedidoCodigo ?? ''].some(
            (v) => v.toLowerCase().includes(q),
          ),
      );
  });

  protected readonly filas = computed(() =>
    this.visibles().map((d) => ({
      id: d.id,
      codigo: d.codigo,
      fecha: this.datePipe.transform(d.activadoAt, 'dd/MM/yyyy HH:mm') ?? '',
      ubicacion: d.ubicacion.nombre,
      volumen:
        d.volumenRealBarriles !== null ? formatoBarriles(d.volumenRealBarriles) : d.banda.nombre,
      descripcion: d.descripcion,
      servicio: d.ticketId ? `${d.pedidoCodigo ?? ''} · Ticket ${d.ticketNumero ?? '—'}` : '—',
      mae: d.requiereNotificacionMae ? 'Obligatoria' : '—',
      estadoBadge: { text: ESTADO_DERRAME_ETIQUETA[d.estado], tone: TONO[d.estado] },
    })),
  );

  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.filas().map((f) => ({
      id: f.id,
      eyebrow: f.codigo,
      title: f.ubicacion,
      subtitle: `${f.fecha} · ${f.volumen}`,
      status: f.estadoBadge,
      fields: [
        { label: 'Descripción', value: f.descripcion },
        { label: 'Servicio', value: f.servicio },
        { label: 'Notificación al MAE', value: f.mae },
      ],
      actions: [{ icon: 'eye', label: 'Abrir', primary: true, run: () => this.abrir(f.id) }],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  protected abrir(id: string): void {
    void this.router.navigate(['/dashboard/qhse/derrames', id]);
  }

  protected reportar(): void {
    const ref = this.dialogos.open<DerrameAlertaDialog>({
      title: 'Derrame detectado — activar la alerta',
      content: DerrameAlertaDialog,
      footer: false,
      width: '560px',
    });
    ref.afterClose.subscribe((r) => {
      if (r) this.recargar();
    });
  }

  protected configurarBandas(): void {
    void this.router.navigate(['/dashboard/qhse/derrames/bandas']);
  }

  private recargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.derrames.set(lista);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar los derrames.'));
      },
    });
    this.servicio.tablero().subscribe({
      next: (t) => this.tablero.set(t),
      error: () => this.tablero.set(null),
    });
  }
}
