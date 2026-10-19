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
  DynadrillTabsComponent,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../../shared/components/qhse-registros-movil';
import { IpercActividadNuevaDialog } from '../../components/iperc-actividad-nueva-dialog';
import { IpercCoberturaPanel } from '../../components/iperc-cobertura-panel';
import {
  ESTADO_IPERC_ETIQUETA,
  ESTADO_IPERC_TONO,
  PERMISO_IPERC_GESTIONAR,
  insigniaVigencia,
  type ActividadResumen,
  type MatrizDetalle,
} from '../../models/iperc';
import { IpercMaestraService } from '../../services/iperc-maestra.service';

/**
 * Matriz IPERC maestra: una fila por actividad con su matriz aprobada (vigente, por vencer o vencida) y la versión en trabajo. Desde aquí se
 * abre una matriz, se agrega una actividad, se crea la versión nueva de la revisión anual y se configura la cobertura por tipo de servicio.
 */
@Component({
  selector: 'app-iperc-list-page',
  imports: [
    PageHeader,
    KpiStat,
    QhseRegistrosMovil,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillIconButtonComponent,
    DynadrillDataTableComponent,
    DynadrillTabsComponent,
    IpercCoberturaPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iperc-list-page.html',
  styleUrl: './iperc-list-page.scss',
})
export class IpercListPage {
  private readonly servicio = inject(IpercMaestraService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly tabs: DynadrillTab[] = [
    { label: 'Actividades' },
    { label: 'Cobertura por tipo de servicio' },
  ];
  protected readonly tabActiva = signal(0);
  protected readonly cargando = signal(true);
  protected readonly actividades = signal<ActividadResumen[]>([]);
  protected readonly busqueda = signal('');
  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_IPERC_GESTIONAR));

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const a = this.actividades();
    return [
      { label: 'Actividades', value: a.length, tone: 'neutral' },
      {
        label: 'Con matriz vigente',
        value: a.filter((x) => x.aprobada && !x.aprobada.vencida).length,
        tone: 'brand',
      },
      {
        label: 'Por vencer (30 días)',
        value: a.filter((x) => x.aprobada?.porVencer).length,
        tone: 'warning',
      },
      {
        label: 'Vencidas o sin aprobar',
        value: a.filter((x) => !x.aprobada || x.aprobada.vencida).length,
        tone: 'warning',
      },
    ];
  });

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'proceso', header: 'Proceso', sortable: true },
    { key: 'zona', header: 'Zona' },
    { key: 'actividad', header: 'Actividad', sortable: true },
    { key: 'vigenciaBadge', header: 'Matriz aprobada', type: 'badge' },
    { key: 'vigenteHasta', header: 'Vigente hasta' },
    { key: 'trabajoBadge', header: 'Versión en trabajo', type: 'badge' },
    { key: 'servicios', header: 'Servicios que la exigen' },
  ];

  private readonly visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.actividades().filter(
      (a) =>
        !q || [a.nombre, a.proceso.nombre, a.zona.nombre].some((v) => v.toLowerCase().includes(q)),
    );
  });

  protected readonly filas = computed(() =>
    this.visibles().map((a) => ({
      id: a.id,
      proceso: a.proceso.nombre,
      zona: a.zona.nombre,
      actividad: a.nombre,
      vigenciaBadge: insigniaVigencia(a),
      vigenteHasta: a.aprobada?.vigenteHasta
        ? a.aprobada.vigenteHasta.split('-').reverse().join('/')
        : '—',
      trabajoBadge: a.enTrabajo
        ? {
            text: `v${a.enTrabajo.version} · ${ESTADO_IPERC_ETIQUETA[a.enTrabajo.estado]}`,
            tone: ESTADO_IPERC_TONO[a.enTrabajo.estado],
          }
        : { text: '—', tone: 'neutral' },
      servicios: a.tiposServicio.length ? String(a.tiposServicio.length) : 'Ninguno',
    })),
  );

  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.filas().map((f) => ({
      id: f.id,
      eyebrow: `${f.proceso} · ${f.zona}`,
      title: f.actividad,
      status: f.vigenciaBadge,
      fields: [
        { label: 'Vigente hasta', value: f.vigenteHasta },
        { label: 'Versión en trabajo', value: f.trabajoBadge.text },
      ],
      actions: [{ icon: 'eye', label: 'Abrir', primary: true, run: () => this.abrir(f.id) }],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  private actividad(id: string): ActividadResumen | undefined {
    return this.actividades().find((a) => a.id === id);
  }

  /** Abre la versión en trabajo si la hay (es la que se está preparando) y, si no, la aprobada. */
  protected abrir(id: string): void {
    const a = this.actividad(id);
    const matrizId = a?.enTrabajo?.matrizId ?? a?.aprobada?.matrizId;
    if (matrizId) void this.router.navigate(['/dashboard/qhse/iperc', matrizId]);
  }

  protected puedeNuevaVersion(id: string): boolean {
    const a = this.actividad(id);
    return this.puedeGestionar() && !!a?.aprobada && !a.enTrabajo;
  }

  /** Revisión anual: crea la versión nueva (copia de la aprobada) y la abre; la aprobada sigue valiendo mientras se aprueba la nueva. */
  protected nuevaVersion(id: string): void {
    this.servicio.nuevaVersion(id).subscribe({
      next: (m) => {
        this.notify.success(
          'Versión nueva',
          `Se creó la versión ${m.version}; la aprobada sigue vigente mientras se aprueba.`,
        );
        void this.router.navigate(['/dashboard/qhse/iperc', m.id]);
      },
      error: (err) =>
        this.notify.error(
          'No se pudo crear',
          mensajeDeError(err, 'No se pudo crear la versión nueva.'),
        ),
    });
  }

  protected nueva(): void {
    const ref = this.dialogos.open<IpercActividadNuevaDialog>({
      title: 'Nueva actividad',
      content: IpercActividadNuevaDialog,
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe((m) => {
      if (m) void this.router.navigate(['/dashboard/qhse/iperc', (m as MatrizDetalle).id]);
    });
  }

  private recargar(): void {
    this.cargando.set(true);
    this.servicio.actividades().subscribe({
      next: (lista) => {
        this.actividades.set(lista);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar las actividades.'));
      },
    });
  }
}
