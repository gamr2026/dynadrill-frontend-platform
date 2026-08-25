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
import { DERRAME_ESTADO_LABELS, DERRAME_VOLUMEN_LABELS, DerrameEvento } from '../../models/derrame.model';
import { DerrameService } from '../../services/derrame.service';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ESTADO_TONE: Record<DerrameEvento['estado'], DynadrillTagVariant & DynadrillCardAccent> = {
  activo: 'error',
  contenido: 'warning',
  cerrado: 'success',
};

/** HSE-AMBIENTAL-002 — bandeja de eventos de derrame. */
@Component({
  selector: 'app-derrame-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './derrame-list-page.html',
  styleUrl: './derrame-list-page.scss',
})
export class DerrameListPage {
  private readonly derrameService = inject(DerrameService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly eventos = signal<DerrameEvento[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.eventos();
    return [
      { label: 'Total eventos', value: all.length },
      { label: 'Activos', value: all.filter(e => e.estado === 'activo').length },
      { label: 'Mayores', value: all.filter(e => e.volumen === 'mayor').length },
      { label: 'Notificados a MAE', value: all.filter(e => e.notificadoMae).length },
    ];
  });

  protected readonly cards = computed(() =>
    this.eventos().map(e => ({
      id: e.id,
      code: e.code,
      descripcion: e.descripcion,
      volumenLabel: DERRAME_VOLUMEN_LABELS[e.volumen],
      esMayor: e.volumen === 'mayor',
      activadoAt: formatDateTime(e.activadoAt),
      estadoLabel: DERRAME_ESTADO_LABELS[e.estado],
      accent: ESTADO_TONE[e.estado],
      notificadoMae: e.notificadoMae,
    })),
  );

  constructor() {
    this.derrameService.list().subscribe({
      next: eventos => {
        this.eventos.set(eventos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los derrames.');
      },
    });
  }

  protected viewDetail(id: number): void {
    this.router.navigate([id], { relativeTo: this.route });
  }
}
