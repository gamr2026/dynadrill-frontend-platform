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
  CLASIFICACION_LABELS,
  PERMISO_ASPECTOS_GESTIONAR,
  type AspectoResumen,
  type Clasificacion,
} from '../../models/aspecto-ambiental.model';
import { AspectoAmbientalService } from '../../services/aspecto-ambiental.service';
import { AspectoAmbientalDialog } from '../../components/aspecto-ambiental-dialog';
import {
  AspectoAmbientalDetailDialog,
  AspectoAmbientalDetailDialogData,
} from '../../components/aspecto-ambiental-detail-dialog';

const CLASIFICACION_TONE: Record<Clasificacion, DynadrillTagVariant> = {
  bajo: 'success',
  moderado: 'warning',
  alto: 'error',
};

/** Matriz de Aspectos e Impactos Ambientales (MATRIZ DE ASPECTOS AMBIENTALES Rev00). */
@Component({
  selector: 'app-aspecto-ambiental-list-page',
  imports: [
    PageHeader,
    KpiStat,
    QhseRegistrosMovil,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillDataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aspecto-ambiental-list-page.html',
  styleUrl: './aspecto-ambiental-list-page.scss',
})
export class AspectoAmbientalListPage {
  private readonly service = inject(AspectoAmbientalService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly aspectos = signal<AspectoResumen[]>([]);
  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_ASPECTOS_GESTIONAR));

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.aspectos();
    return [
      { label: 'Total registrados', value: all.length, tone: 'neutral' },
      {
        label: 'Bajo',
        value: all.filter((a) => a.clasificacion === 'bajo').length,
        tone: 'success',
      },
      {
        label: 'Moderado',
        value: all.filter((a) => a.clasificacion === 'moderado').length,
        tone: 'warning',
      },
      { label: 'Alto', value: all.filter((a) => a.clasificacion === 'alto').length, tone: 'error' },
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
      filters: Object.values(CLASIFICACION_LABELS).map((text) => ({ text, value: text })),
    },
  ];

  protected readonly rows = computed(() =>
    this.aspectos().map((a) => ({
      id: a.id,
      code: a.codigo,
      proceso: a.proceso.nombre ?? '—',
      actividad: a.actividad,
      aspectoAmbiental: a.aspecto,
      nivel: a.nivelRiesgo,
      clasificacionBadge: {
        text: CLASIFICACION_LABELS[a.clasificacion],
        tone: CLASIFICACION_TONE[a.clasificacion],
      },
      aspecto: a,
    })),
  );

  /** Tarjetas de la lista en móvil (Figma "M · Aspectos e Impactos Ambientales"). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.rows().map((r) => ({
      id: r.id,
      eyebrow: r.code,
      title: r.actividad,
      subtitle: `${r.proceso} · ${r.aspectoAmbiental}`,
      status: r.clasificacionBadge,
      fields: [
        { label: 'Nivel de riesgo', value: String(r.nivel) },
        { label: 'Proceso', value: r.proceso },
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
        this.aspectos.set(bandeja.items);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(
          'Error',
          mensajeDeError(e, 'No se pudieron cargar los aspectos ambientales.'),
        );
      },
    });
  }

  protected nuevoAspecto(): void {
    const ref = this.dialogService.open<AspectoAmbientalDialog>({
      title: 'Nuevo aspecto ambiental',
      content: AspectoAmbientalDialog,
      footer: false,
      width: '760px',
    });
    ref.afterClose.subscribe((result) => {
      if (result) this.reload();
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    const aspecto = row['aspecto'] as AspectoResumen;
    const ref = this.dialogService.open<
      AspectoAmbientalDetailDialog,
      AspectoAmbientalDetailDialogData
    >({
      title: `Aspecto ambiental — ${aspecto.codigo}`,
      content: AspectoAmbientalDetailDialog,
      data: { id: aspecto.id },
      footer: false,
      width: '640px',
    });
    // el detalle puede registrar seguimiento, cambiar el control o dar de baja: la matriz se actualiza al cerrarlo
    ref.afterClose.subscribe(() => this.reload());
  }
}
