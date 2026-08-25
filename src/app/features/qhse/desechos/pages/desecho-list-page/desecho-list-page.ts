import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { DESECHO_ESTADO_LABELS, Desecho } from '../../models/desecho.model';
import { DesechoService } from '../../services/desecho.service';
import { DesechoDialog } from '../../components/desecho-dialog';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ESTADO_TONE: Record<Desecho['estado'], DynadrillTagVariant> = {
  almacenado: 'neutral',
  con_manifiesto: 'info',
  dispuesto: 'success',
};

/** HSE-AMBIENTAL-001 — bandeja de desechos, vencimientos AM 142. */
@Component({
  selector: 'app-desecho-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillDataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './desecho-list-page.html',
  styleUrl: './desecho-list-page.scss',
})
export class DesechoListPage {
  private readonly desechoService = inject(DesechoService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly desechos = signal<Desecho[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.desechos();
    return [
      { label: 'Total registrados', value: all.length },
      { label: 'Peligrosos', value: all.filter(d => d.clasificacion === 'peligroso').length },
      { label: 'Dispuestos', value: all.filter(d => d.estado === 'dispuesto').length },
    ];
  });

  protected readonly narrowViewport = injectNarrowViewport();

  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Código', sortable: true, searchable: true, fixed: this.narrowViewport() ? 'left' : undefined },
    { key: 'descripcion', header: 'Descripción', searchable: true },
    {
      key: 'clasificacionLabel',
      header: 'Clasificación',
      filters: [
        { text: 'Peligroso', value: 'Peligroso' },
        { text: 'No peligroso', value: 'No peligroso' },
      ],
    },
    { key: 'pesoKg', header: 'Peso (kg)', sortable: true },
    { key: 'limiteAlmacenamiento', header: 'Límite almacenamiento', sortable: true },
    {
      key: 'estadoBadge',
      header: 'Estado',
      type: 'badge',
      fixed: this.narrowViewport() ? 'right' : undefined,
      filters: Object.entries(DESECHO_ESTADO_LABELS).map(([, text]) => ({ text, value: text })),
    },
  ]);

  protected readonly tableScrollX = computed(() => (this.narrowViewport() ? '680px' : undefined));

  protected readonly rows = computed(() =>
    this.desechos().map(d => ({
      id: d.id,
      code: d.code,
      descripcion: d.descripcion,
      clasificacionLabel: d.clasificacion === 'peligroso' ? 'Peligroso' : 'No peligroso',
      pesoKg: d.pesoKg,
      limiteAlmacenamiento: formatDate(d.limiteAlmacenamientoHasta),
      estadoBadge: { text: DESECHO_ESTADO_LABELS[d.estado], tone: ESTADO_TONE[d.estado] },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.desechoService.list().subscribe({
      next: desechos => {
        this.desechos.set(desechos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los desechos.');
      },
    });
  }

  protected nuevoDesecho(): void {
    const ref = this.dialogService.open<DesechoDialog>({ title: 'Registrar desecho', content: DesechoDialog, footer: false });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }
}
