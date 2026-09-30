import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCardComponent,
  DynadrillChartComponent,
  DynadrillChartSeries,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { QhseRegistrosMovil, type RegistroMovil } from '../../../shared/components/qhse-registros-movil';
import { StopCard, STOP_ESTADO_LABELS, stopCardInseguros, stopCardTieneInseguroEn } from '../../models/stop-card.model';
import { StopCardService } from '../../services/stop-card.service';
import { StopCardDialog } from '../../components/stop-card-dialog';
import { StopCardDetailDialog, StopCardDetailDialogData } from '../../components/stop-card-detail-dialog';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** HSE-SEGUIMIENTO-002 — bandeja + dashboard de tendencias (Pareto por subcategoría). */
@Component({
  selector: 'app-stop-list-page',
  imports: [
    PageHeader,
    KpiStat,
    QhseRegistrosMovil,
    DynadrillButtonComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillIconComponent,
    DynadrillSpinnerComponent,
    DynadrillChartComponent,
    DynadrillTextComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stop-list-page.html',
  styleUrl: './stop-list-page.scss',
})
export class StopListPage {
  private readonly stopService = inject(StopCardService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly cards = signal<StopCard[]>([]);

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.cards();
    const mesActual = new Date().getMonth();
    const esteMes = all.filter(c => new Date(c.createdAt).getMonth() === mesActual).length;
    return [
      { label: 'Total registradas', value: all.length, tone: 'neutral' },
      { label: 'Este mes', value: esteMes, tone: 'brand' },
      { label: 'Con hallazgos en Acciones', value: all.filter(c => stopCardTieneInseguroEn(c, 'acciones')).length, tone: 'warning' },
      { label: 'Con hallazgos en Condiciones', value: all.filter(c => stopCardTieneInseguroEn(c, 'condiciones')).length, tone: 'error' },
    ];
  });

  /** Pareto — subcategorías con más ítems marcados "Inseguro", ordenadas de mayor a menor. */
  protected readonly paretoSubcategorias = computed(() => {
    const counts = new Map<string, number>();
    for (const c of this.cards()) {
      for (const item of stopCardInseguros(c)) counts.set(item.subcategoria, (counts.get(item.subcategoria) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  });

  protected readonly paretoChartCategories = computed(() => this.paretoSubcategorias().map(([sub]) => sub));
  protected readonly paretoChartSeries = computed<DynadrillChartSeries[]>(() => [
    { name: 'Ítems inseguros', data: this.paretoSubcategorias().map(([, count]) => count) },
  ]);

  protected readonly estadoLabels = STOP_ESTADO_LABELS;

  protected readonly viewCards = computed(() =>
    this.cards().map(c => {
      const inseguros = stopCardInseguros(c);
      const accent: DynadrillTagVariant = inseguros.length === 0 ? 'success' : stopCardTieneInseguroEn(c, 'condiciones') ? 'error' : 'warning';
      return {
        id: c.id,
        code: c.code,
        fecha: formatDate(c.createdAt),
        accent,
        resumenLabel: inseguros.length === 0 ? 'Sin hallazgos' : `${inseguros.length} ítem(s) inseguro(s)`,
        locacion: c.locacion,
        observadorNombre: c.observadorNombre,
        estado: c.estado,
        estadoLabel: this.estadoLabels[c.estado],
      };
    }),
  );

  /** Tarjetas de la lista en móvil (Figma "M · Tarjetas STOP"). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.viewCards().map(c => ({
      id: c.id,
      eyebrow: c.code,
      title: c.locacion,
      subtitle: `${c.observadorNombre} · ${c.fecha}`,
      status: { text: c.estadoLabel, tone: c.estado === 'cerrado' ? ('neutral' as const) : c.estado === 'abierto' ? ('warning' as const) : ('success' as const) },
      fields: [{ label: 'Resumen', value: c.resumenLabel, tone: c.accent === 'success' ? ('success' as const) : c.accent === 'error' ? ('error' as const) : ('warning' as const) }],
      actions: [{ icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.verDetalle(c.id) }],
    })),
  );

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.stopService.list().subscribe({
      next: cards => {
        this.cards.set(cards);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar las tarjetas STOP.');
      },
    });
  }

  protected nuevaTarjeta(): void {
    const ref = this.dialogService.open<StopCardDialog>({ title: 'Nueva Tarjeta STOP', content: StopCardDialog, footer: false, width: '640px' });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  protected verDetalle(id: number): void {
    const card = this.cards().find(c => c.id === id);
    if (!card) return;
    const ref = this.dialogService.open<StopCardDetailDialog, StopCardDetailDialogData>({
      title: `Tarjeta STOP — ${card.code}`,
      content: StopCardDetailDialog,
      data: { card },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }
}
