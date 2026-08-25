import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillPhaseTrackComponent,
  DynadrillScreenHeaderComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { PTW_FASE_LABELS, PTW_FASE_ORDER, PTW_FASE_STEPS, PtwFase, PtwMatrix, ptwCerrado } from '../../models/ptw.model';
import { PtwService } from '../../services/ptw.service';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';

const FASE_BADGES: Record<PtwFase, { text: string; tone: BadgeTone }> = {
  gabinete: { text: PTW_FASE_LABELS['gabinete'], tone: 'neutral' },
  ingreso: { text: PTW_FASE_LABELS['ingreso'], tone: 'info' },
  verificaciones: { text: PTW_FASE_LABELS['verificaciones'], tone: 'warning' },
  formalizacion: { text: PTW_FASE_LABELS['formalizacion'], tone: 'warning' },
  ejecucion: { text: PTW_FASE_LABELS['ejecucion'], tone: 'info' },
  gestion_documental: { text: PTW_FASE_LABELS['gestion_documental'], tone: 'info' },
};

const CERRADO_BADGE: { text: string; tone: BadgeTone } = { text: 'Cerrado', tone: 'success' };

@Component({
  selector: 'app-ptw-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
    DynadrillPhaseTrackComponent,
  ],
  templateUrl: './ptw-list-page.html',
  styleUrl: './ptw-list-page.scss',
})
export class PtwListPage {
  private readonly ptwService = inject(PtwService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly records = signal<PtwMatrix[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.records();
    return [
      { label: 'Total PTW', value: all.length },
      { label: 'En preparación', value: all.filter(p => p.fase === 'gabinete' || p.fase === 'ingreso').length },
      { label: 'En verificación/formalización', value: all.filter(p => p.fase === 'verificaciones' || p.fase === 'formalizacion').length },
      { label: 'Cerrados', value: all.filter(p => ptwCerrado(p)).length },
    ];
  });

  protected readonly narrowViewport = injectNarrowViewport();

  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Código', sortable: true, searchable: true, fixed: this.narrowViewport() ? 'left' : undefined },
    { key: 'ipercCode', header: 'IPERC origen', searchable: true },
    { key: 'actividad', header: 'Actividad', searchable: true },
    { key: 'ubicacion', header: 'Ubicación', searchable: true },
    { key: 'faseBadge', header: 'Fase actual', type: 'badge', fixed: this.narrowViewport() ? 'right' : undefined },
  ]);

  protected readonly tableScrollX = computed(() => (this.narrowViewport() ? '640px' : undefined));

  protected readonly faseSteps = PTW_FASE_ORDER.length;
  protected readonly faseLabels = PTW_FASE_STEPS;

  protected readonly rows = computed(() =>
    this.records().map(p => ({
      id: p.id,
      code: p.code,
      ipercCode: p.ipercCode,
      actividad: p.actividad,
      ubicacion: p.ubicacion,
      faseBadge: ptwCerrado(p) ? CERRADO_BADGE : FASE_BADGES[p.fase],
      faseIndex: ptwCerrado(p) ? PTW_FASE_ORDER.length : PTW_FASE_ORDER.indexOf(p.fase),
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.ptwService.list().subscribe({
      next: records => {
        this.records.set(records);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }
}
