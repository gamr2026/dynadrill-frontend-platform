import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../../shared/components/qhse-registros-movil';
import {
  ESTADO_OBJETIVO_LABELS,
  ESTADO_OBJETIVO_TONO,
  PERMISO_OBJETIVOS_GESTIONAR,
  estadoVisible,
  type ObjetivoResumen,
} from '../../models/objetivo-ambiental.model';
import { ObjetivoAmbientalService } from '../../services/objetivo-ambiental.service';
import { ObjetivoAmbientalDialog } from '../../components/objetivo-ambiental-dialog';
import {
  ObjetivoAmbientalDetailDialog,
  ObjetivoAmbientalDetailDialogData,
} from '../../components/objetivo-ambiental-detail-dialog';

/** Objetivos del Sistema de Gestión Ambiental — revisión anual (ver OBJETIVOS AMBIENTALES.xlsx). */
@Component({
  selector: 'app-objetivo-ambiental-list-page',
  imports: [
    PageHeader,
    KpiStat,
    QhseRegistrosMovil,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillDataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './objetivo-ambiental-list-page.html',
  styleUrl: './objetivo-ambiental-list-page.scss',
})
export class ObjetivoAmbientalListPage {
  private readonly service = inject(ObjetivoAmbientalService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly objetivos = signal<ObjetivoResumen[]>([]);
  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_OBJETIVOS_GESTIONAR));

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.objetivos();
    const estados = all.map((o) => estadoVisible(o));
    return [
      { label: 'Total objetivos', value: all.length, tone: 'neutral' },
      { label: 'Vigentes', value: estados.filter((e) => e === 'vigente').length, tone: 'success' },
      {
        label: 'Por vencer',
        value: estados.filter((e) => e === 'por_vencer').length,
        tone: 'warning',
      },
      { label: 'Vencidos', value: estados.filter((e) => e === 'vencido').length, tone: 'error' },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'titulo', header: 'Título', searchable: true },
    { key: 'meta', header: 'Meta', searchable: true },
    { key: 'plazo', header: 'Plazo', sortable: true },
    {
      key: 'estadoBadge',
      header: 'Estado',
      type: 'badge',
      filters: Object.values(ESTADO_OBJETIVO_LABELS).map((text) => ({ text, value: text })),
    },
  ];

  protected readonly rows = computed(() =>
    this.objetivos().map((o) => {
      const estado = estadoVisible(o);
      return {
        id: o.id,
        code: o.codigo,
        titulo: o.titulo,
        meta: o.meta,
        plazo: o.plazo || '—',
        estadoBadge: { text: ESTADO_OBJETIVO_LABELS[estado], tone: ESTADO_OBJETIVO_TONO[estado] },
        objetivo: o,
      };
    }),
  );

  /** Tarjetas de la lista en móvil (Figma "M · Objetivos Ambientales"). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.rows().map((r) => ({
      id: r.id,
      eyebrow: r.code,
      title: r.titulo,
      subtitle: `Meta: ${r.meta}`,
      status: r.estadoBadge,
      fields: [
        { label: 'Plazo', value: r.plazo },
        { label: 'Indicador', value: r.objetivo.indicador || '—' },
        {
          label: 'Avance',
          value: r.objetivo.avanceActual === null ? '—' : `${r.objetivo.avanceActual}%`,
        },
      ],
      actions: [
        { icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.verDetalle(r) },
      ],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (bandeja) => {
        this.objetivos.set(bandeja.items);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(
          'Error',
          mensajeDeError(e, 'No se pudieron cargar los objetivos ambientales.'),
        );
      },
    });
  }

  protected nuevoObjetivo(): void {
    const ref = this.dialogService.open<ObjetivoAmbientalDialog>({
      title: 'Nuevo objetivo ambiental',
      content: ObjetivoAmbientalDialog,
      footer: false,
      width: '760px',
    });
    ref.afterClose.subscribe((result) => {
      if (result) this.reload();
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    const objetivo = row['objetivo'] as ObjetivoResumen;
    const ref = this.dialogService.open<
      ObjetivoAmbientalDetailDialog,
      ObjetivoAmbientalDetailDialogData
    >({
      title: `Objetivo ambiental — ${objetivo.codigo}`,
      content: ObjetivoAmbientalDetailDialog,
      data: { id: objetivo.id },
      footer: false,
      width: '640px',
    });
    // el detalle puede registrar seguimiento o cerrar el objetivo: la bandeja se actualiza al cerrar el diálogo
    ref.afterClose.subscribe(() => this.reload());
  }
}
