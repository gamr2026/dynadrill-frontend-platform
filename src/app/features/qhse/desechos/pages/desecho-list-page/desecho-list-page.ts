import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { DESECHO_ESTADO_LABELS, Desecho, desechoTotalGalones } from '../../models/desecho.model';
import { DesechoService } from '../../services/desecho.service';
import { DesechoDialog } from '../../components/desecho-dialog';

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
    PageHeader, KpiStat, QhseRegistrosMovil,
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

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly desechos = signal<Desecho[]>([]);

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.desechos();
    return [
      { label: 'Total registrados', value: all.length, tone: 'neutral' },
      { label: 'Peligrosos', value: all.filter(d => d.clasificacion === 'peligroso').length, tone: 'neutral' },
      { label: 'Dispuestos', value: all.filter(d => d.estado === 'dispuesto').length, tone: 'neutral' },
    ];
  });

  /** Sin fixed:'left'/'right' ni scrollX — ver nota en iperc-list-page.ts (mismo criterio contra el pipeline de columnas fijas de nz-table). */
  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'descripcion', header: 'Descripción', searchable: true },
    {
      key: 'clasificacionLabel',
      header: 'Clasificación',
      filters: [
        { text: 'Peligroso', value: 'Peligroso' },
        { text: 'No peligroso', value: 'No peligroso' },
      ],
    },
    { key: 'itemsCount', header: 'Ítems', sortable: true },
    { key: 'totalGalones', header: 'Total (gal)', sortable: true },
    { key: 'limiteAlmacenamiento', header: 'Límite almacenamiento', sortable: true },
    {
      key: 'estadoBadge',
      header: 'Estado',
      type: 'badge',
      filters: Object.entries(DESECHO_ESTADO_LABELS).map(([, text]) => ({ text, value: text })),
    },
  ]);

  protected readonly rows = computed(() =>
    this.desechos().map(d => ({
      id: d.id,
      code: d.code,
      descripcion: d.descripcion,
      clasificacionLabel: d.clasificacion === 'peligroso' ? 'Peligroso' : 'No peligroso',
      itemsCount: d.items.length,
      totalGalones: desechoTotalGalones(d.items),
      limiteAlmacenamiento: formatDate(d.limiteAlmacenamientoHasta),
      estadoBadge: { text: DESECHO_ESTADO_LABELS[d.estado], tone: ESTADO_TONE[d.estado] },
    })),
  );

  /** Tarjetas de la lista en móvil (Figma "M · Gestión de Desechos"). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.rows().map(r => ({
      id: r.id,
      eyebrow: r.code,
      title: r.descripcion,
      subtitle: `${r.clasificacionLabel} · ${r.itemsCount} ${r.itemsCount === 1 ? 'ítem' : 'ítems'} · ${r.totalGalones} gal`,
      status: r.estadoBadge,
      fields: [
        { label: 'Límite almacenamiento', value: r.limiteAlmacenamiento },
        { label: 'Clasificación', value: r.clasificacionLabel },
      ],
      actions: [{ icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.viewDetail({ id: r.id }) }],
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
