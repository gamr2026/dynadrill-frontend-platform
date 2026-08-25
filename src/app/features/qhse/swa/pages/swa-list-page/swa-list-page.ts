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
  type DynadrillKpiRowItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { SWA_ESTADO_LABELS, SwaEvento } from '../../models/swa.model';
import { SwaService } from '../../services/swa.service';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ESTADO_TONE: Record<SwaEvento['estado'], DynadrillTagVariant & DynadrillCardAccent> = {
  activo: 'error',
  evaluado: 'warning',
  cerrado: 'success',
};

/** HSE-SEGUIMIENTO-003 — bandeja de eventos Stop Work Authority. */
@Component({
  selector: 'app-swa-list-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillCardComponent, DynadrillTagComponent, DynadrillButtonComponent],
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

  protected readonly cards = computed(() =>
    this.eventos().map(e => ({
      id: e.id,
      code: e.code,
      tipoPeligro: e.tipoPeligro,
      ubicacion: e.ubicacion || '—',
      activadoPorNombre: e.activadoPorNombre,
      activadoAt: formatDateTime(e.activadoAt),
      estadoLabel: SWA_ESTADO_LABELS[e.estado],
      accent: ESTADO_TONE[e.estado],
      heroeSeguridad: e.heroeSeguridad,
    })),
  );

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

  protected viewDetail(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }
}
