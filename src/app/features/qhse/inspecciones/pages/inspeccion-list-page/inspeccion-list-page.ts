import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { QhseRegistrosMovil, type RegistroMovil } from '../../../shared/components/qhse-registros-movil';
import { QhseChip } from '../../../shared/components/qhse-chip';
import {
  INSPECCION_FRECUENCIA_LABEL,
  InspeccionEquipo,
  TIPO_EQUIPO_LABELS,
  inspeccionEnCuarentena,
  inspeccionPeriodicaVencida,
  inspeccionVencida,
  proximaInspeccionDebida,
} from '../../models/inspeccion-equipo.model';
import { InspeccionEquipoService } from '../../services/inspeccion-equipo.service';
import { InspeccionEquipoDialog } from '../../components/inspeccion-equipo-dialog';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** HSE-SEGUIMIENTO-001 — bandeja de inspecciones, vigencias y cuarentena. */
@Component({
  selector: 'app-inspeccion-list-page',
  imports: [
    PageHeader, KpiStat, QhseRegistrosMovil, QhseChip,
    DynadrillButtonComponent,
    DynadrillDataTableComponent,
    ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspeccion-list-page.html',
  styleUrl: './inspeccion-list-page.scss',
})
export class InspeccionListPage {
  private readonly inspeccionService = inject(InspeccionEquipoService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly inspecciones = signal<InspeccionEquipo[]>([]);

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.inspecciones();
    return [
      { label: 'Total registradas', value: all.length, tone: 'neutral' },
      { label: 'Vigentes', value: all.filter(i => !inspeccionEnCuarentena(i) && !inspeccionVencida(i)).length, tone: 'success' },
      { label: 'Vencidas', value: all.filter(i => !inspeccionEnCuarentena(i) && inspeccionVencida(i)).length, tone: 'warning' },
    ];
  });

  /** Sin fixed:'left'/'right' ni scrollX — ver nota en iperc-list-page.ts (mismo criterio contra el pipeline de columnas fijas de nz-table). */
  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'equipoCodigo', header: 'Equipo', searchable: true },
    {
      key: 'tipoLabel',
      header: 'Tipo',
      filters: Object.entries(TIPO_EQUIPO_LABELS).map(([, text]) => ({ text, value: text })),
    },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'vigenciaHasta', header: 'Vigente hasta', sortable: true },
    {
      key: 'estadoBadge',
      header: 'Estado',
      type: 'badge',
      filters: [
        { text: 'Vigente', value: 'Vigente' },
        { text: 'Vencida', value: 'Vencida' },
        { text: 'En cuarentena', value: 'En cuarentena' },
      ],
    },
    { key: 'mantenimientoBadge', header: 'Mantenimiento', type: 'badge' },
  ]);

  protected readonly rows = computed(() =>
    this.inspecciones().map(i => {
      let estado: { text: string; tone: DynadrillTagVariant };
      if (inspeccionEnCuarentena(i)) estado = { text: 'En cuarentena', tone: 'error' };
      else if (inspeccionVencida(i)) estado = { text: 'Vencida', tone: 'warning' };
      else estado = { text: 'Vigente', tone: 'success' };

      // El seguimiento post-derivación (clasificar, ejecutar, cerrar) vive
      // en la Orden/Sub-orden de Mantenimiento, no acá — ver bandeja de
      // Mantenimiento para el estado real de la reparación.
      const mantenimiento: { text: string; tone: DynadrillTagVariant } = i.requiereMantenimiento
        ? { text: 'Derivada a Mantenimiento', tone: 'warning' }
        : { text: '—', tone: 'neutral' };

      return {
        id: i.id,
        code: i.code,
        equipoCodigo: i.equipoCodigo,
        tipoLabel: TIPO_EQUIPO_LABELS[i.tipo],
        fecha: formatDate(i.fecha),
        vigenciaHasta: formatDate(i.vigenciaHasta),
        estadoBadge: estado,
        mantenimientoBadge: mantenimiento,
      };
    }),
  );

  /** Tarjetas de la lista en móvil (Figma "M · Inspecciones de campo"). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.rows().map(r => ({
      id: r.id,
      eyebrow: r.code,
      title: `${r.tipoLabel} ${r.equipoCodigo}`,
      subtitle: `${r.tipoLabel} · ${r.fecha}`,
      status: r.estadoBadge,
      fields: [
        { label: 'Vigente hasta', value: r.vigenciaHasta },
        { label: 'Mantenimiento', value: r.mantenimientoBadge.text },
      ],
      actions: [],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  // ── Cronograma: control periódico por equipo (HSE-SEGUIMIENTO-001, "planificar inspecciones del período") ──

  protected readonly cronogramaColumns: DynadrillDataTableColumn[] = [
    { key: 'equipoCodigo', header: 'Equipo', sortable: true, searchable: true },
    { key: 'tipoLabel', header: 'Tipo' },
    { key: 'frecuenciaLabel', header: 'Frecuencia requerida' },
    { key: 'ultimaFecha', header: 'Última inspección', sortable: true },
    { key: 'proximaFecha', header: 'Próxima debida', sortable: true },
    { key: 'cronogramaBadge', header: 'Estado', type: 'badge' },
  ];

  /** Último registro por equipoCodigo+tipo — no existe un inventario de equipos separado, así que el cronograma se deriva del propio historial. */
  protected readonly cronograma = computed(() => {
    const ultimoPorEquipo = new Map<string, InspeccionEquipo>();
    for (const i of this.inspecciones()) {
      const key = `${i.equipoCodigo}__${i.tipo}`;
      const actual = ultimoPorEquipo.get(key);
      if (!actual || new Date(i.fecha) > new Date(actual.fecha)) ultimoPorEquipo.set(key, i);
    }
    return [...ultimoPorEquipo.values()]
      .map(i => {
        const proxima = proximaInspeccionDebida(i.fecha, i.tipo);
        const vencida = inspeccionPeriodicaVencida(i.fecha, i.tipo);
        const diasParaVencer = Math.ceil((new Date(proxima).getTime() - Date.now()) / 86_400_000);
        const badge: { text: string; tone: DynadrillTagVariant } = vencida
          ? { text: 'Vencida', tone: 'error' }
          : diasParaVencer <= 1
            ? { text: 'Por vencer', tone: 'warning' }
            : { text: 'Al día', tone: 'success' };
        return {
          equipoCodigo: i.equipoCodigo,
          tipoLabel: TIPO_EQUIPO_LABELS[i.tipo],
          frecuenciaLabel: INSPECCION_FRECUENCIA_LABEL[i.tipo],
          ultimaFecha: formatDate(i.fecha),
          proximaFecha: formatDate(proxima),
          cronogramaBadge: badge,
          _vencida: vencida,
        };
      })
      .sort((a, b) => (a._vencida === b._vencida ? 0 : a._vencida ? -1 : 1));
  });

  protected readonly cronogramaRowKeyFn = (row: Record<string, unknown>): string => String(row['equipoCodigo']);

  protected readonly cronogramaKpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.cronograma();
    return [
      { label: 'Equipos con historial', value: all.length, tone: 'neutral' },
      { label: 'Vencidos según cronograma', value: all.filter(c => c._vencida).length, tone: 'error' },
    ];
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.inspeccionService.list().subscribe({
      next: inspecciones => {
        this.inspecciones.set(inspecciones);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar las inspecciones.');
      },
    });
  }

  protected nuevaInspeccion(): void {
    const ref = this.dialogService.open<InspeccionEquipoDialog>({ title: 'Nueva inspección de equipo', content: InspeccionEquipoDialog, footer: false });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }
}
