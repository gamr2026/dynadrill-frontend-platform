import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCardAccent,
  DynadrillCardComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillTagComponent,
  type DynadrillKpiRowItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import {
  accionesPendientes,
  INCIDENTE_RESULTADO_LABELS,
  Investigacion,
  PLAZOS_POR_RESULTADO,
  plazoFinalVencido,
  plazoInicioVencido,
} from '../../models/investigacion.model';
import { InvestigacionService } from '../../services/investigacion.service';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** HSE-TRIAGE-002 — bandeja de investigaciones de incidentes y casi accidentes. */
@Component({
  selector: 'app-investigacion-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillBannerComponent,
  ],
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

  protected readonly cards = computed(() =>
    this.investigaciones().map(i => {
      const vencida = i.estado === 'abierta' && (plazoInicioVencido(i) || plazoFinalVencido(i));
      const accent: DynadrillTagVariant & DynadrillCardAccent = i.estado === 'cerrada' ? 'success' : vencida ? 'error' : 'warning';

      /** Días restantes reales al plazo final (fechaIncidente + finalDias) — solo si abierta y todavía no vencido. dynadrill-timer no aplica a esta escala (semanas, no minutos). */
      const diasRestantes =
        i.estado === 'abierta' && !vencida
          ? Math.max(
              0,
              Math.ceil(
                (new Date(i.fechaIncidente).getTime() + PLAZOS_POR_RESULTADO[i.resultado].finalDias * 86_400_000 - Date.now()) / 86_400_000,
              ),
            )
          : null;

      const plazoLabel = i.estado === 'cerrada' ? 'Cerrada' : vencida ? 'Plazo vencido' : `${diasRestantes} días restantes`;

      return {
        id: i.id,
        code: i.code,
        resultadoLabel: INCIDENTE_RESULTADO_LABELS[i.resultado],
        ubicacion: i.ubicacion || '—',
        fechaIncidente: formatDate(i.fechaIncidente),
        estadoLabel: i.estado === 'abierta' ? 'Abierta' : 'Cerrada',
        accent,
        plazoLabel,
        accionesPendientes: accionesPendientes(i.acciones),
      };
    }),
  );

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

  protected viewDetail(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }
}
