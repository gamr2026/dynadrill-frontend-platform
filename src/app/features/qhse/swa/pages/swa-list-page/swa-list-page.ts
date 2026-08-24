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
import { SWA_ESTADO_LABELS, SwaEvento } from '../../models/swa.model';
import { SwaService } from '../../services/swa.service';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ESTADO_TONE: Record<SwaEvento['estado'], DynadrillTagVariant> = {
  activo: 'error',
  evaluado: 'warning',
  cerrado: 'success',
};

/** HSE-SEGUIMIENTO-003 — bandeja de eventos Stop Work Authority. */
@Component({
  selector: 'app-swa-list-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillDataTableComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './swa-list-page.html',
  styleUrl: './swa-list-page.scss',
})
export class SwaListPage {
  private readonly swaService = inject(SwaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly eventos = signal<SwaEvento[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.eventos();
    return [
      { label: 'Total eventos', value: all.length },
      { label: 'Trabajo detenido', value: all.filter(e => e.estado === 'activo').length },
      { label: 'En evaluación', value: all.filter(e => e.estado === 'evaluado').length },
      { label: 'Reconocidos "Héroe de Seguridad"', value: all.filter(e => e.heroeSeguridad).length },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'tipoPeligro', header: 'Tipo de peligro', searchable: true },
    { key: 'ubicacion', header: 'Ubicación' },
    { key: 'activadoPorNombre', header: 'Activado por' },
    { key: 'activadoAt', header: 'Fecha/hora', sortable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.eventos().map(e => ({
      id: e.id,
      code: e.code,
      tipoPeligro: e.tipoPeligro,
      ubicacion: e.ubicacion || '—',
      activadoPorNombre: e.activadoPorNombre,
      activadoAt: formatDateTime(e.activadoAt),
      estadoBadge: { text: SWA_ESTADO_LABELS[e.estado], tone: ESTADO_TONE[e.estado] },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.swaService.list().subscribe({
      next: eventos => {
        this.eventos.set(eventos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los eventos SWA.');
      },
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }
}
