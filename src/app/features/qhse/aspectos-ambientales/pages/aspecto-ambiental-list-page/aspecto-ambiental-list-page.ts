import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  type DynadrillKpiRowItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AspectoAmbiental, CLASIFICACION_LABELS, Clasificacion, nivelRiesgo } from '../../models/aspecto-ambiental.model';
import { AspectoAmbientalService } from '../../services/aspecto-ambiental.service';
import { AspectoAmbientalDialog } from '../../components/aspecto-ambiental-dialog';
import { AspectoAmbientalDetailDialog, AspectoAmbientalDetailDialogData } from '../../components/aspecto-ambiental-detail-dialog';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const CLASIFICACION_TONE: Record<Clasificacion, DynadrillTagVariant> = {
  BAJO: 'success',
  MODERADO: 'warning',
  ALTO: 'error',
};

/** Matriz de Aspectos e Impactos Ambientales — 131 registros reales en el documento fuente (MATRIZ DE ASPECTOS AMBIENTALES Rev00). */
@Component({
  selector: 'app-aspecto-ambiental-list-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillButtonComponent, DynadrillIconButtonComponent, DynadrillDataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aspecto-ambiental-list-page.html',
  styleUrl: './aspecto-ambiental-list-page.scss',
})
export class AspectoAmbientalListPage {
  private readonly service = inject(AspectoAmbientalService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly aspectos = signal<AspectoAmbiental[]>([]);
  protected readonly clasificacionLabels = CLASIFICACION_LABELS;

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.aspectos();
    return [
      { label: 'Total registrados', value: all.length },
      { label: 'Bajo', value: all.filter(a => a.clasificacion === 'BAJO').length, tone: 'success' },
      { label: 'Moderado', value: all.filter(a => a.clasificacion === 'MODERADO').length, tone: 'warning' },
      { label: 'Alto', value: all.filter(a => a.clasificacion === 'ALTO').length, tone: 'error' },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'proceso', header: 'Proceso', searchable: true },
    { key: 'actividad', header: 'Actividad', searchable: true },
    { key: 'aspectoAmbiental', header: 'Aspecto ambiental', searchable: true },
    { key: 'nivel', header: 'Nivel de riesgo', sortable: true },
    {
      key: 'clasificacionBadge',
      header: 'Clasificación',
      type: 'badge',
      filters: Object.entries(CLASIFICACION_LABELS).map(([, text]) => ({ text, value: text })),
    },
  ];

  protected readonly rows = computed(() =>
    this.aspectos().map(a => ({
      id: a.id,
      code: a.code,
      proceso: a.proceso,
      actividad: a.actividad,
      aspectoAmbiental: a.aspectoAmbiental,
      nivel: nivelRiesgo(a),
      clasificacionBadge: { text: this.clasificacionLabels[a.clasificacion], tone: CLASIFICACION_TONE[a.clasificacion] },
      aspecto: a,
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: aspectos => {
        this.aspectos.set(aspectos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los aspectos ambientales.');
      },
    });
  }

  protected nuevoAspecto(): void {
    const ref = this.dialogService.open<AspectoAmbientalDialog>({ title: 'Nuevo aspecto ambiental', content: AspectoAmbientalDialog, footer: false, width: '760px' });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    const aspecto = row['aspecto'] as AspectoAmbiental;
    this.dialogService.open<AspectoAmbientalDetailDialog, AspectoAmbientalDetailDialogData>({
      title: `Aspecto ambiental — ${aspecto.code}`,
      content: AspectoAmbientalDetailDialog,
      data: { aspecto },
      footer: false,
      width: '640px',
    });
  }
}
