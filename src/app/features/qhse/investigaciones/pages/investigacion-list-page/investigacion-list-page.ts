import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  type DynadrillKpiRowItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import {
  accionesPendientes,
  INCIDENTE_RESULTADO_LABELS,
  Investigacion,
  InvestigacionEstado,
  plazoFinalVencido,
  plazoInicioVencido,
} from '../../models/investigacion.model';
import { InvestigacionService } from '../../services/investigacion.service';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ESTADO_TONE: Record<InvestigacionEstado, DynadrillTagVariant> = {
  abierta: 'warning',
  cerrada: 'success',
};

/** HSE-TRIAGE-002 — bandeja de investigaciones de incidentes y casi accidentes. */
@Component({
  selector: 'app-investigacion-list-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillDataTableComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './investigacion-list-page.html',
  styleUrl: './investigacion-list-page.scss',
})
export class InvestigacionListPage {
  private readonly investigacionService = inject(InvestigacionService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly investigaciones = signal<Investigacion[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.investigaciones();
    return [
      { label: 'Total', value: all.length },
      { label: 'Abiertas', value: all.filter(i => i.estado === 'abierta').length },
      { label: 'Plazo vencido', value: all.filter(i => plazoInicioVencido(i) || plazoFinalVencido(i)).length },
      { label: 'Acciones pendientes', value: all.reduce((sum, i) => sum + accionesPendientes(i.acciones), 0) },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'resultadoLabel', header: 'Clasificación', searchable: true },
    { key: 'ubicacion', header: 'Ubicación' },
    { key: 'fechaIncidente', header: 'Fecha', sortable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
    { key: 'plazoBadge', header: 'Plazo', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.investigaciones().map(i => ({
      id: i.id,
      code: i.code,
      resultadoLabel: INCIDENTE_RESULTADO_LABELS[i.resultado],
      ubicacion: i.ubicacion || '—',
      fechaIncidente: formatDate(i.fechaIncidente),
      estadoBadge: { text: i.estado === 'abierta' ? 'Abierta' : 'Cerrada', tone: ESTADO_TONE[i.estado] },
      plazoBadge:
        i.estado === 'cerrada'
          ? { text: 'Cerrada a tiempo', tone: 'success' as DynadrillTagVariant }
          : plazoInicioVencido(i) || plazoFinalVencido(i)
            ? { text: 'Vencido', tone: 'error' as DynadrillTagVariant }
            : { text: 'En plazo', tone: 'info' as DynadrillTagVariant },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.investigacionService.list().subscribe({
      next: investigaciones => {
        this.investigaciones.set(investigaciones);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar las investigaciones.');
      },
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }
}
