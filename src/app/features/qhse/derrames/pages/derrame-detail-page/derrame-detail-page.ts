import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillChecklistComponent,
  type DynadrillChecklistItem,
  DynadrillContextCardComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillTagComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import {
  DERRAME_ESTADO_LABELS,
  DERRAME_UBICACION_LABELS,
  DERRAME_VOLUMEN_LABELS,
  DerrameEvento,
  derrameActivaEmergenciaMayor,
  derrameRequiereNotificacionMae,
} from '../../models/derrame.model';
import { DerrameService } from '../../services/derrame.service';

/** HSE-AMBIENTAL-002 — checklist de contención, notificación a MAE, cierre e integración con desechos. */
@Component({
  selector: 'app-derrame-detail-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillContextCardComponent,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillChecklistComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './derrame-detail-page.html',
  styleUrl: './derrame-detail-page.scss',
})
export class DerrameDetailPage {
  private readonly derrameService = inject(DerrameService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly estadoLabels = DERRAME_ESTADO_LABELS;
  protected readonly volumenLabels = DERRAME_VOLUMEN_LABELS;
  protected readonly ubicacionLabels = DERRAME_UBICACION_LABELS;

  protected readonly loading = signal(true);
  protected readonly evento = signal<DerrameEvento | null>(null);
  protected readonly generandoDesecho = signal(false);

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const e = this.evento();
    if (!e) return [];
    return [
      { label: 'Evento', value: e.code },
      { label: 'Volumen', value: this.volumenLabels[e.volumen] },
      { label: 'Ubicación', value: this.ubicacionLabels[e.ubicacion] },
      { label: 'Activado por', value: e.activadoPorNombre },
      { label: 'Estado', value: DERRAME_ESTADO_LABELS[e.estado] },
    ];
  });

  protected readonly esEmergenciaMayor = computed(() => {
    const e = this.evento();
    return !!e && derrameActivaEmergenciaMayor(e);
  });

  protected readonly requiereMae = computed(() => {
    const e = this.evento();
    return !!e && derrameRequiereNotificacionMae(e);
  });

  protected readonly checklistItems = computed<DynadrillChecklistItem[]>(() => this.evento()?.checklistContencion ?? []);

  protected readonly puedeContener = computed(() => {
    const e = this.evento();
    return !!e && e.checklistContencion.every(i => i.checked) && e.estado === 'activo';
  });

  protected readonly puedeCerrar = computed(() => {
    const e = this.evento();
    if (!e || e.estado !== 'contenido') return false;
    return !derrameRequiereNotificacionMae(e) || e.notificadoMae;
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.derrameService.get(id).subscribe({
      next: e => {
        this.evento.set(e);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private patch(changes: Partial<DerrameEvento>): void {
    const current = this.evento();
    if (!current) return;
    this.evento.set({ ...current, ...changes });
    this.derrameService.update(current.id, changes).subscribe();
  }

  protected toggleChecklist(index: number): void {
    const e = this.evento();
    if (!e) return;
    const checklistContencion = e.checklistContencion.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item));
    this.patch({ checklistContencion });
  }

  protected marcarContenido(): void {
    if (!this.puedeContener()) return;
    this.patch({ estado: 'contenido', contenidoAt: new Date().toISOString() });
  }

  protected notificarMae(): void {
    this.patch({ notificadoMae: true, notificadoMaeAt: new Date().toISOString() });
  }

  protected generarDesecho(): void {
    const e = this.evento();
    if (!e || this.generandoDesecho()) return;
    this.generandoDesecho.set(true);
    this.derrameService.generarDesecho(e.id).subscribe({
      next: updated => {
        this.evento.set(updated);
        this.generandoDesecho.set(false);
        this.notify.success('Registrado', 'Se generó un registro de desecho peligroso a partir de este derrame.');
      },
      error: () => {
        this.generandoDesecho.set(false);
        this.notify.error('Error', 'No se pudo generar el registro de desecho.');
      },
    });
  }

  protected cerrar(): void {
    if (!this.puedeCerrar()) return;
    this.patch({ estado: 'cerrado', cerradoAt: new Date().toISOString() });
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/derrames']);
  }
}
