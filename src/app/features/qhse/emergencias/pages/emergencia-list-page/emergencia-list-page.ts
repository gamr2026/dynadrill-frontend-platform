import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillCardAccent,
  DynadrillCardComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillTagComponent,
  DynadrillTimerComponent,
  type DynadrillKpiRowItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { EMERGENCIA_ESTADO_LABELS, EMERGENCIA_NIVEL_LABELS, EmergenciaEstado, EmergenciaEvento, reporteFlashVencido } from '../../models/emergencia.model';
import { EmergenciaService } from '../../services/emergencia.service';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ESTADO_TONE: Record<EmergenciaEstado, DynadrillTagVariant & DynadrillCardAccent> = {
  activa: 'error',
  controlada: 'warning',
  cerrada: 'success',
};

const DOS_HORAS_SEGUNDOS = 2 * 60 * 60;

/** HSE-TRIAGE-001 — bandeja de emergencias y MEDEVAC. */
@Component({
  selector: 'app-emergencia-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillTimerComponent,
    DynadrillButtonComponent,
  ],
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

  protected readonly cards = computed(() =>
    this.eventos().map(e => {
      const flashVencido = reporteFlashVencido(e);
      const flashEmitido = !!e.reporteFlash.emitidoAt;

      /** Cuenta regresiva real al plazo del Reporte Flash (activadoAt + 2h) — solo mientras siga pendiente y sin vencer. */
      const flashSegundosRestantes =
        !flashEmitido && !flashVencido
          ? Math.max(0, DOS_HORAS_SEGUNDOS - Math.floor((Date.now() - new Date(e.activadoAt).getTime()) / 1000))
          : null;

      return {
        id: e.id,
        code: e.code,
        tipo: e.tipo,
        nivelLabel: e.nivel ? EMERGENCIA_NIVEL_LABELS[e.nivel] : 'Sin declarar',
        ubicacion: e.ubicacion || '—',
        activadoAt: formatDateTime(e.activadoAt),
        estadoLabel: EMERGENCIA_ESTADO_LABELS[e.estado],
        accent: ESTADO_TONE[e.estado],
        flashLabel: flashEmitido ? 'Reporte Flash emitido' : flashVencido ? 'Reporte Flash vencido' : null,
        flashSegundosRestantes,
      };
    }),
  );

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

  protected viewDetail(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }
}
