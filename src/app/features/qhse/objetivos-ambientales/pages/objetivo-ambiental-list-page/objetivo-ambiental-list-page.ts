import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { QhseRegistrosMovil, type RegistroMovil } from '../../../shared/components/qhse-registros-movil';
import { ESTADO_OBJETIVO_LABELS, EstadoObjetivoAmbiental, ObjetivoAmbiental, estadoObjetivoAmbiental } from '../../models/objetivo-ambiental.model';
import { ObjetivoAmbientalService } from '../../services/objetivo-ambiental.service';
import { ObjetivoAmbientalDialog } from '../../components/objetivo-ambiental-dialog';
import { ObjetivoAmbientalDetailDialog, ObjetivoAmbientalDetailDialogData } from '../../components/objetivo-ambiental-detail-dialog';

const ESTADO_TONE: Record<EstadoObjetivoAmbiental, DynadrillTagVariant> = {
  vigente: 'success',
  por_vencer: 'warning',
  vencido: 'error',
  sin_plazo: 'neutral',
};

/** Objetivos del Sistema de Gestión Ambiental — revisión anual (ver OBJETIVOS AMBIENTALES.xlsx). */
@Component({
  selector: 'app-objetivo-ambiental-list-page',
  imports: [PageHeader, KpiStat, QhseRegistrosMovil, DynadrillButtonComponent, DynadrillIconButtonComponent, DynadrillDataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './objetivo-ambiental-list-page.html',
  styleUrl: './objetivo-ambiental-list-page.scss',
})
export class ObjetivoAmbientalListPage {
  private readonly service = inject(ObjetivoAmbientalService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly objetivos = signal<ObjetivoAmbiental[]>([]);
  protected readonly estadoLabels = ESTADO_OBJETIVO_LABELS;

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.objetivos();
    const estados = all.map(o => estadoObjetivoAmbiental(o.plazo));
    return [
      { label: 'Total objetivos', value: all.length, tone: 'neutral' },
      { label: 'Vigentes', value: estados.filter(e => e === 'vigente').length, tone: 'success' },
      { label: 'Por vencer', value: estados.filter(e => e === 'por_vencer').length, tone: 'warning' },
      { label: 'Vencidos', value: estados.filter(e => e === 'vencido').length, tone: 'error' },
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
      filters: Object.entries(ESTADO_OBJETIVO_LABELS).map(([, text]) => ({ text, value: text })),
    },
  ];

  protected readonly rows = computed(() =>
    this.objetivos().map(o => {
      const estado = estadoObjetivoAmbiental(o.plazo);
      return {
        id: o.id,
        code: o.code,
        titulo: o.titulo,
        meta: o.meta,
        plazo: o.plazo || '—',
        estadoBadge: { text: this.estadoLabels[estado], tone: ESTADO_TONE[estado] },
        objetivo: o,
      };
    }),
  );

  /** Tarjetas de la lista en móvil (Figma "M · Objetivos Ambientales"). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.rows().map(r => ({
      id: r.id,
      eyebrow: r.code,
      title: r.titulo,
      subtitle: `Meta: ${r.meta}`,
      status: r.estadoBadge,
      fields: [
        { label: 'Plazo', value: r.plazo },
        { label: 'Indicador', value: r.objetivo.indicador || '—' },
      ],
      actions: [{ icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.verDetalle(r) }],
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: objetivos => {
        this.objetivos.set(objetivos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los objetivos ambientales.');
      },
    });
  }

  protected nuevoObjetivo(): void {
    const ref = this.dialogService.open<ObjetivoAmbientalDialog>({ title: 'Nuevo objetivo ambiental', content: ObjetivoAmbientalDialog, footer: false, width: '760px' });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    const objetivo = row['objetivo'] as ObjetivoAmbiental;
    this.dialogService.open<ObjetivoAmbientalDetailDialog, ObjetivoAmbientalDetailDialogData>({
      title: `Objetivo ambiental — ${objetivo.code}`,
      content: ObjetivoAmbientalDetailDialog,
      data: { objetivo },
      footer: false,
      width: '640px',
    });
  }
}
