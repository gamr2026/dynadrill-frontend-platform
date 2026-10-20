import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../core/utils/narrow-viewport.util';
import { KpiStat, type KpiStatTone } from '../../../../shared/components/kpi-stat/kpi-stat';
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../shared/components/motivo-dialog/motivo-dialog';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import {
  MntCompactList,
  type MntCompactItem,
} from '../../../maintenance/components/mnt-compact-card';
import { QhseFiltros } from '../../../qhse/shared/components/qhse-filtros';
import {
  ViajeDetalleDialog,
  type ViajeDetalleDialogData,
} from '../../components/viaje-detalle-dialog';
import {
  NIVEL_LABEL,
  TIPO_VIAJE_LABEL,
  type EstadoViaje,
  type NivelRiesgo,
  type UmbralRiesgo,
  type ViajeResumen,
} from '../../models/viaje-flota.model';
import { FlotaViajesService } from '../../services/flota-viajes.service';
import { formatoFecha, mensajeDeError } from '../../utils/flota.util';

const ESTADO_TEXTO: Record<EstadoViaje, string> = {
  pendiente: 'Pendiente de autorización',
  autorizado: 'Aprobado',
  rechazado: 'Rechazado',
};
const ESTADO_TONE: Record<EstadoViaje, DynadrillTagVariant> = {
  pendiente: 'warning',
  autorizado: 'success',
  rechazado: 'error',
};
const PERMISO_MAYOR = 'flota.viajes.autorizar_mayor';

type Fila = {
  id: string;
  code: string;
  tipo: string;
  fecha: string;
  origen: string;
  destino: string;
  riskLevel: string;
  estado: EstadoViaje;
  estadoBadge: { text: string; tone: DynadrillTagVariant };
  puedeGestionar: boolean;
  viaje: ViajeResumen;
};

/**
 * Bandeja del Gerenciamiento de Viaje (DYN-SGI-RE-049), con el diseño de la demo. Quien autoriza ve las solicitudes y los botones de
 * autorizar/rechazar solo en las de riesgo que su permiso le deja (`puedeDecidir`, lo calcula el servidor, que igual lo hace cumplir).
 * Un conductor ve únicamente las suyas.
 */
@Component({
  selector: 'app-viajes-page',
  imports: [
    PageHeader,
    KpiStat,
    QhseFiltros,
    MntCompactList,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './viajes-page.html',
  styleUrl: './viajes-page.scss',
})
export class ViajesPage {
  private readonly api = inject(FlotaViajesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly viajes = signal<ViajeResumen[]>([]);
  private readonly umbrales = signal<UmbralRiesgo[]>([]);
  protected readonly filtro = signal<EstadoViaje | 'todos'>('pendiente');

  protected readonly opcionesFiltro = [
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'autorizado', label: 'Aprobados' },
    { value: 'rechazado', label: 'Rechazados' },
    { value: 'todos', label: 'Todos' },
  ];

  private readonly puedeAutorizar = computed(
    () => this.auth.can('flota.viajes.aprobar') || this.auth.can(PERMISO_MAYOR),
  );

  /** Niveles de riesgo que autoriza cada permiso, según los umbrales del servidor ("BAJO y MEDIO" / "ALTO"). */
  private nivelesDe(permiso: string): NivelRiesgo[] {
    return this.umbrales()
      .filter((u) => (permiso === PERMISO_MAYOR) === (u.permisoAutoriza === PERMISO_MAYOR))
      .sort((a, b) => a.desdePuntos - b.desdePuntos)
      .map((u) => u.nivel);
  }
  private unir(niveles: NivelRiesgo[]): string {
    return niveles.map((n) => NIVEL_LABEL[n]).join(' y ');
  }

  protected readonly subtitulo = computed(() => {
    const menor = this.unir(this.nivelesDe('flota.viajes.aprobar'));
    const mayor = this.unir(this.nivelesDe(PERMISO_MAYOR));
    return menor && mayor
      ? `DYN-SGI-RE-049 — ${menor} lo autoriza el Supervisor de Pumping, ${mayor} el Jefe de Base`
      : 'DYN-SGI-RE-049 — Evaluación de riesgos de viajes y Plan de gestión de viajes';
  });

  /** Quien solo autoriza el riesgo menor lo sabe desde el principio (banner azul de la demo). */
  protected readonly avisoNiveles = computed(() => {
    if (!this.puedeAutorizar() || this.auth.can(PERMISO_MAYOR)) return '';
    const niveles = this.unir(this.nivelesDe('flota.viajes.aprobar'));
    const rol = this.auth.currentUser()?.roleName ?? 'su rol';
    return niveles ? `Como ${rol} solo puedes autorizar viajes de riesgo ${niveles}.` : '';
  });

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.viajes();
    const cuenta = (e: EstadoViaje) => all.filter((v) => v.estado === e).length;
    return [
      { label: 'Total', value: all.length, tone: 'neutral' },
      { label: 'Pendientes', value: cuenta('pendiente'), tone: 'warning' },
      { label: 'Aprobados', value: cuenta('autorizado'), tone: 'success' },
      { label: 'Rechazados', value: cuenta('rechazado'), tone: 'error' },
    ];
  });

  protected readonly filtrados = computed(() => {
    const f = this.filtro();
    return f === 'todos' ? this.viajes() : this.viajes().filter((v) => v.estado === f);
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'tipo', header: 'Tipo' },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'origen', header: 'Origen', searchable: true },
    { key: 'destino', header: 'Destino', searchable: true },
    { key: 'riskLevel', header: 'Riesgo' },
    {
      key: 'estadoBadge',
      header: 'Estado',
      type: 'badge',
      filters: Object.values(ESTADO_TEXTO).map((text) => ({ text, value: text })),
    },
  ];

  protected readonly rows = computed<Fila[]>(() =>
    this.filtrados().map((v) => ({
      id: v.id,
      code: v.codigo,
      tipo: TIPO_VIAJE_LABEL[v.tipo],
      fecha: formatoFecha(v.fecha),
      origen: v.origen,
      destino: v.destino,
      riskLevel: NIVEL_LABEL[v.nivel],
      estado: v.estado,
      estadoBadge: { text: ESTADO_TEXTO[v.estado], tone: ESTADO_TONE[v.estado] },
      puedeGestionar: v.puedeDecidir,
      viaje: v,
    })),
  );

  /** Filas compactas en móvil: ver, autorizar (✓) y rechazar (✗). */
  protected readonly itemsMovil = computed<MntCompactItem[]>(() =>
    this.rows().map((r) => {
      const v = r.viaje;
      const riesgoTone = v.nivel === 'bajo' ? 'success' : v.nivel === 'medio' ? 'warning' : 'error';
      return {
        id: r.id,
        title: `${v.codigo} · ${r.fecha}`,
        lines: [`${v.origen} → ${v.destino} · ${v.puntajeTotal} pts`],
        chips: [
          { text: r.riskLevel, tone: riesgoTone as 'success' | 'warning' | 'error' },
          { text: r.estadoBadge.text, tone: r.estadoBadge.tone as 'warning' | 'success' | 'error' },
        ],
        actions: [
          { icon: 'eye', label: 'Ver detalle', run: () => this.verDetalle(r) },
          ...(v.estado === 'pendiente' && r.puedeGestionar
            ? [
                { icon: 'check', label: 'Autorizar', run: () => this.aprobar(r) },
                { icon: 'close', label: 'Rechazar', run: () => this.rechazar(r) },
              ]
            : []),
        ],
      };
    }),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.api.umbrales().subscribe((u) => this.umbrales.set(u));
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.api.listar().subscribe({
      next: (v) => {
        this.viajes.set(v);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los gerenciamientos de viaje.');
      },
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    const v = row['viaje'] as ViajeResumen;
    this.dialog
      .open<ViajeDetalleDialog, ViajeDetalleDialogData>({
        title: `Gerenciamiento de Viaje — ${v.codigo}`,
        content: ViajeDetalleDialog,
        data: { viajeId: v.id },
        size: 'large',
        footer: false,
      })
      .afterClose.subscribe((r) => r && this.reload());
  }

  protected aprobar(row: Record<string, unknown>): void {
    const v = row['viaje'] as ViajeResumen;
    this.api.autorizar(v.id).subscribe({
      next: () => {
        this.notify.success('Autorizado', `${v.codigo} autorizado.`);
        this.reload();
      },
      error: (e) =>
        this.notify.error(
          'Error',
          mensajeDeError(e, 'No se pudo autorizar el gerenciamiento de viaje.'),
        ),
    });
  }

  protected rechazar(row: Record<string, unknown>): void {
    const v = row['viaje'] as ViajeResumen;
    const ref = this.dialog.open<MotivoDialog, MotivoDialogData>({
      title: 'Rechazar Gerenciamiento de Viaje',
      content: MotivoDialog,
      data: {
        mensaje: `¿Por qué se rechaza el gerenciamiento de viaje ${v.codigo}?`,
        label: 'Motivo del rechazo',
      },
      footer: false,
    });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (!motivo) return;
      this.api.rechazar(v.id, motivo).subscribe({
        next: () => {
          this.notify.success('Rechazado', `${v.codigo} rechazado.`);
          this.reload();
        },
        error: (e) =>
          this.notify.error(
            'Error',
            mensajeDeError(e, 'No se pudo rechazar el gerenciamiento de viaje.'),
          ),
      });
    });
  }
}
