import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillCardAccent,
  DynadrillCardComponent,
  DynadrillChartComponent,
  DynadrillChartSeries,
  DynadrillDialogService,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillKpiRowItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { StopCard, StopTipo, STOP_TIPO_LABELS } from '../../models/stop-card.model';
import { StopCardService } from '../../services/stop-card.service';
import { StopCardDialog } from '../../components/stop-card-dialog';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const TIPO_ACCENT: Record<StopTipo, DynadrillTagVariant & DynadrillCardAccent> = {
  acto_inseguro: 'warning',
  condicion_insegura: 'error',
};

/** HSE-SEGUIMIENTO-002 — bandeja + dashboard de tendencias (Pareto por categoría). */
@Component({
  selector: 'app-stop-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillButtonComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillSpinnerComponent,
    DynadrillChartComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stop-list-page.html',
  styleUrl: './stop-list-page.scss',
})
export class StopListPage {
  private readonly stopService = inject(StopCardService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly cards = signal<StopCard[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.cards();
    const mesActual = new Date().getMonth();
    const esteMes = all.filter(c => new Date(c.createdAt).getMonth() === mesActual).length;
    return [
      { label: 'Total registradas', value: all.length },
      { label: 'Este mes', value: esteMes },
      { label: 'Actos inseguros', value: all.filter(c => c.tipo === 'acto_inseguro').length },
      { label: 'Condiciones inseguras', value: all.filter(c => c.tipo === 'condicion_insegura').length },
    ];
  });

  /** Pareto — categorías más observadas, ordenadas de mayor a menor. */
  protected readonly paretoCategorias = computed(() => {
    const counts = new Map<string, number>();
    for (const c of this.cards()) {
      for (const cat of c.categorias) counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  });

  protected readonly paretoChartCategories = computed(() => this.paretoCategorias().map(([cat]) => cat));
  protected readonly paretoChartSeries = computed<DynadrillChartSeries[]>(() => [
    { name: 'Observaciones', data: this.paretoCategorias().map(([, count]) => count) },
  ]);

  protected readonly viewCards = computed(() =>
    this.cards().map(c => ({
      id: c.id,
      code: c.code,
      fecha: formatDate(c.createdAt),
      tipoLabel: STOP_TIPO_LABELS[c.tipo],
      accent: TIPO_ACCENT[c.tipo],
      categoriasLabel: c.categorias.join(', '),
      ubicacion: c.ubicacion || '—',
      observadorNombre: c.observadorNombre,
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
    const ref = this.dialogService.open<StopCardDialog>({ title: 'Nueva Tarjeta STOP', content: StopCardDialog, footer: false });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }
}
