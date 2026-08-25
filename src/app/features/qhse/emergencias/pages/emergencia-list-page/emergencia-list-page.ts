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
import { EMERGENCIA_ESTADO_LABELS, EMERGENCIA_NIVEL_LABELS, EmergenciaEstado, EmergenciaEvento, reporteFlashVencido } from '../../models/emergencia.model';
import { EmergenciaService } from '../../services/emergencia.service';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ESTADO_TONE: Record<EmergenciaEstado, DynadrillTagVariant> = {
  activa: 'error',
  controlada: 'warning',
  cerrada: 'success',
};

/** HSE-TRIAGE-001 — bandeja de emergencias y MEDEVAC. */
@Component({
  selector: 'app-emergencia-list-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillDataTableComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './emergencia-list-page.html',
  styleUrl: './emergencia-list-page.scss',
})
export class EmergenciaListPage {
  private readonly emergenciaService = inject(EmergenciaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly eventos = signal<EmergenciaEvento[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.eventos();
    return [
      { label: 'Total emergencias', value: all.length },
      { label: 'Activas', value: all.filter(e => e.estado === 'activa').length },
      { label: 'Nivel 3 (mayor)', value: all.filter(e => e.nivel === 3).length },
      { label: 'Reporte Flash vencido', value: all.filter(e => reporteFlashVencido(e)).length },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'tipo', header: 'Tipo', searchable: true },
    { key: 'nivelLabel', header: 'Nivel' },
    { key: 'ubicacion', header: 'Ubicación' },
    { key: 'activadoAt', header: 'Fecha/hora', sortable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
    { key: 'flashBadge', header: 'Reporte Flash', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.eventos().map(e => ({
      id: e.id,
      code: e.code,
      tipo: e.tipo,
      nivelLabel: e.nivel ? EMERGENCIA_NIVEL_LABELS[e.nivel] : 'Sin declarar',
      ubicacion: e.ubicacion || '—',
      activadoAt: formatDateTime(e.activadoAt),
      estadoBadge: { text: EMERGENCIA_ESTADO_LABELS[e.estado], tone: ESTADO_TONE[e.estado] },
      flashBadge: e.reporteFlash.emitidoAt
        ? { text: 'Emitido', tone: 'success' as DynadrillTagVariant }
        : reporteFlashVencido(e)
          ? { text: 'Vencido', tone: 'error' as DynadrillTagVariant }
          : { text: 'Pendiente', tone: 'warning' as DynadrillTagVariant },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.emergenciaService.list().subscribe({
      next: eventos => {
        this.eventos.set(eventos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar las emergencias.');
      },
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }
}
