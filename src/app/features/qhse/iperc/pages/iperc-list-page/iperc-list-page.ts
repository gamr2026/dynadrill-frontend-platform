import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillPhaseTrackComponent,
  DynadrillScreenHeaderComponent,
  dynadrillRiskLevel,
  type DynadrillKpiRowItem,
  type DynadrillRiskLevel,
} from '@digitec-it-projects/dynadrill-ui';
import { IPERC_STATUS_LABELS, IpercMatrix, IpercStatus } from '../../models/iperc.model';
import { IpercService } from '../../services/iperc.service';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { IpercMatrixDialog } from '../../components/iperc-matrix-dialog';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';

const STATUS_BADGES: Record<IpercStatus, { text: string; tone: BadgeTone }> = {
  borrador: { text: 'Borrador', tone: 'neutral' },
  en_evaluacion: { text: 'En evaluación', tone: 'info' },
  en_revision: { text: 'En revisión', tone: 'warning' },
  aprobada: { text: 'Aprobada', tone: 'success' },
  rechazada: { text: 'Rechazada', tone: 'error' },
};

const RISK_BADGES: Record<DynadrillRiskLevel, { text: string; tone: BadgeTone }> = {
  bajo: { text: 'Bajo', tone: 'success' },
  medio: { text: 'Medio', tone: 'warning' },
  alto: { text: 'Alto', tone: 'error' },
};

const STATUS_FILTERS = Object.entries(IPERC_STATUS_LABELS).map(([value, text]) => ({ text, value }));

/** HSE-PLAN-001: Preparación → Identificación/Evaluación → Controles/Reevaluación → Documentación y aprobación. */
const FASE_STEPS = 4;
const FASE_LABELS = ['Preparación', 'Identificación/Evaluación', 'Controles/Reevaluación', 'Documentación y aprobación'];
const STATUS_INDEX: Record<IpercStatus, number> = {
  borrador: 0,
  en_evaluacion: 1,
  en_revision: 2,
  aprobada: 3,
  rechazada: 2,
};

@Component({
  selector: 'app-iperc-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
    DynadrillButtonComponent,
    DynadrillPhaseTrackComponent,
  ],
  templateUrl: './iperc-list-page.html',
  styleUrl: './iperc-list-page.scss',
})
export class IpercListPage {
  private readonly ipercService = inject(IpercService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly matrices = signal<IpercMatrix[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.matrices();
    return [
      { label: 'Total IPERC', value: all.length },
      { label: 'En evaluación', value: all.filter(m => m.status === 'en_evaluacion').length },
      { label: 'En revisión', value: all.filter(m => m.status === 'en_revision').length },
      { label: 'Aprobadas', value: all.filter(m => m.status === 'aprobada').length },
    ];
  });

  protected readonly narrowViewport = injectNarrowViewport();

  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Código', sortable: true, searchable: true, fixed: this.narrowViewport() ? 'left' : undefined },
    { key: 'actividad', header: 'Actividad', searchable: true },
    { key: 'ubicacion', header: 'Ubicación', searchable: true },
    { key: 'statusBadge', header: 'Fase', type: 'badge', filters: STATUS_FILTERS },
    { key: 'riesgoBadge', header: 'Riesgo residual más alto', type: 'badge', fixed: this.narrowViewport() ? 'right' : undefined },
    { key: 'leccionBadge', header: 'Lección aprendida', type: 'badge' },
  ]);

  protected readonly tableScrollX = computed(() => (this.narrowViewport() ? '760px' : undefined));

  protected readonly faseSteps = FASE_STEPS;
  protected readonly faseLabels = FASE_LABELS;

  protected readonly rows = computed(() =>
    this.matrices().map(m => ({
      id: m.id,
      code: m.code,
      actividad: m.actividad,
      ubicacion: m.ubicacion,
      statusBadge: STATUS_BADGES[m.status],
      faseIndex: STATUS_INDEX[m.status],
      faseBlocked: m.status === 'rechazada',
      faseBlockedReason: 'Rechazada',
      riesgoBadge: this.highestResidualBadge(m),
      leccionBadge: m.leccionAprendidaPendiente
        ? { text: 'Pendiente de revisar', tone: 'warning' as BadgeTone }
        : { text: '—', tone: 'neutral' as BadgeTone },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.ipercService.list().subscribe({
      next: matrices => {
        this.matrices.set(matrices);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected nuevaMatriz(): void {
    const ref = this.dialogService.open<IpercMatrixDialog>({ title: 'Nueva matriz IPERC', content: IpercMatrixDialog, footer: false });
    ref.afterClose.subscribe(created => {
      if (created) this.router.navigate([created.id], { relativeTo: this.route });
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }

  private highestResidualBadge(matrix: IpercMatrix): { text: string; tone: BadgeTone } {
    const values = matrix.tasks
      .flatMap(t => t.hazards)
      .map(h =>
        h.probabilidadResidual != null && h.severidadResidual != null
          ? h.probabilidadResidual * h.severidadResidual
          : null,
      )
      .filter((v): v is number => v != null);

    if (values.length === 0) return { text: 'Sin evaluar', tone: 'neutral' };
    return RISK_BADGES[dynadrillRiskLevel(Math.max(...values))];
  }
}
