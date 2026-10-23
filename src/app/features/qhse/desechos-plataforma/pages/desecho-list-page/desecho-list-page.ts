import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
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
import { DesechoRegistrarDialog } from '../../components/desecho-registrar-dialog';
import {
  CLASIFICACION_ETIQUETA,
  ESTADO_DESECHO_ETIQUETA,
  ESTADO_DESECHO_TONO,
  ESTADOS_DESECHO,
  fechaCorta,
  textoLimite,
  tonoLimite,
  type DesechoResumen,
  type EstadoDesecho,
  type FiltroVencimiento,
  type TableroDesechos,
} from '../../models/desecho';
import { DesechoService } from '../../services/desecho.service';

type Filtro = 'todos' | EstadoDesecho | FiltroVencimiento;

/** HSE-AMBIENTAL-001 — bandeja de desechos y vencimientos del límite de almacenamiento de 12 meses (AM 142). */
@Component({
  selector: 'app-desecho-list-page',
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
  templateUrl: './desecho-list-page.html',
  styleUrl: './desecho-list-page.scss',
})
export class DesechoListPage {
  private readonly servicio = inject(DesechoService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly desechos = signal<DesechoResumen[]>([]);
  protected readonly tablero = signal<TableroDesechos | null>(null);
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly busqueda = signal('');

  private cantidadDe(estado: EstadoDesecho): number {
    return this.tablero()?.porEstado.find((e) => e.codigo === estado)?.cantidad ?? 0;
  }

  private readonly total = computed(
    () => this.tablero()?.porEstado.reduce((t, e) => t + e.cantidad, 0) ?? 0,
  );

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const t = this.tablero();
    return [
      { label: 'Total registrados', value: this.total(), tone: 'neutral' },
      { label: 'Dispuestos', value: this.cantidadDe('dispuesto'), tone: 'neutral' },
      {
        label: `Por vencer (${t?.diasAviso ?? 30} días)`,
        value: t?.porVencer ?? 0,
        tone: (t?.porVencer ?? 0) > 0 ? 'warning' : 'neutral',
      },
      {
        label: 'Vencidos (más de 12 meses)',
        value: t?.vencidos ?? 0,
        tone: (t?.vencidos ?? 0) > 0 ? 'error' : 'neutral',
      },
      { label: 'Galones sin disponer', value: t?.galonesSinDisponer ?? 0, tone: 'neutral' },
    ];
  });

  protected readonly opcionesFiltro = computed(() => [
    { value: 'todos', label: 'Todos', count: this.total() },
    ...ESTADOS_DESECHO.map((e) => ({
      value: e,
      label: ESTADO_DESECHO_ETIQUETA[e],
      count: this.cantidadDe(e),
    })),
    { value: 'por_vencer', label: 'Por vencer', count: this.tablero()?.porVencer ?? 0 },
    { value: 'vencidos', label: 'Vencidos', count: this.tablero()?.vencidos ?? 0 },
  ]);

  /** Sin fixed:'left'/'right' ni scrollX — ver nota en iperc-list-page.ts (mismo criterio contra el pipeline de columnas fijas de nz-table). */
  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'Código', sortable: true },
    { key: 'descripcion', header: 'Descripción' },
    {
      key: 'clasificacionLabel',
      header: 'Clasificación',
      filters: Object.values(CLASIFICACION_ETIQUETA).map((text) => ({ text, value: text })),
    },
    { key: 'itemsCount', header: 'Ítems', sortable: true },
    { key: 'limiteAlmacenamiento', header: 'Límite almacenamiento', sortable: true },
    { key: 'limiteBadge', header: 'Vencimiento', type: 'badge' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.desechos().filter(
      (d) =>
        !q ||
        [d.codigo, d.descripcion, d.ubicacion ?? '', d.contenedor.nombre, ...d.cretib].some((v) =>
          v.toLowerCase().includes(q),
        ),
    );
  });

  protected readonly rows = computed(() =>
    this.visibles().map((d) => ({
      id: d.id,
      codigo: d.codigo,
      descripcion: d.descripcion,
      clasificacionLabel: CLASIFICACION_ETIQUETA[d.clasificacion],
      itemsCount: d.items,
      limiteAlmacenamiento: fechaCorta(d.limiteAlmacenamientoHasta),
      limiteBadge: {
        text: textoLimite(d),
        tone: tonoLimite(d, this.tablero()?.diasAviso),
      },
      estadoBadge: {
        text: ESTADO_DESECHO_ETIQUETA[d.estado.codigo],
        tone: ESTADO_DESECHO_TONO[d.estado.codigo],
      },
    })),
  );

  /** Tarjetas de la lista en móvil (Figma «M · Gestión de Desechos»). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.rows().map((r) => ({
      id: r.id,
      eyebrow: r.codigo,
      title: r.descripcion,
      subtitle: `${r.clasificacionLabel} · ${r.itemsCount} ${r.itemsCount === 1 ? 'ítem' : 'ítems'}`,
      status: r.estadoBadge,
      fields: [
        { label: 'Límite almacenamiento', value: r.limiteAlmacenamiento },
        { label: 'Vencimiento', value: r.limiteBadge.text },
      ],
      actions: [
        { icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.verDetalle(r.id) },
      ],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  protected elegir(valor: string): void {
    this.filtro.set(valor as Filtro);
    this.cargarLista();
  }

  protected nuevoDesecho(): void {
    const ref = this.dialogos.open<DesechoRegistrarDialog>({
      title: 'Registrar desecho',
      content: DesechoRegistrarDialog,
      footer: false,
    });
    ref.afterClose.subscribe((r) => {
      if (r) this.recargar();
    });
  }

  protected verDetalle(id: string): void {
    this.router.navigate([id], { relativeTo: this.route });
  }

  protected abrir(row: Record<string, unknown>): void {
    this.verDetalle(String(row['id']));
  }

  private recargar(): void {
    this.servicio.tablero().subscribe({
      next: (t) => this.tablero.set(t),
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeDeError(err, 'No se pudo cargar el resumen de desechos.'),
        ),
    });
    this.cargarLista();
  }

  private cargarLista(): void {
    this.loading.set(true);
    const f = this.filtro();
    const filtro =
      f === 'todos'
        ? {}
        : f === 'vencidos' || f === 'por_vencer'
          ? { vencimiento: f }
          : { estado: f };
    this.servicio.listar(filtro).subscribe({
      next: (lista) => {
        this.desechos.set(lista);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar los desechos.'));
      },
    });
  }
}
