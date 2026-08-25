import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillChecklistComponent,
  type DynadrillChecklistItem,
  DynadrillContextCardComponent,
  DynadrillDialogService,
  DynadrillScreenHeaderComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import { SWA_ESTADO_LABELS, SWA_ZERO_RETALIATION_NOTICE, SwaEvento, swaNotificacionCompleta } from '../../models/swa.model';
import { SwaService } from '../../services/swa.service';
import { EmergenciaAlertDialog, EmergenciaAlertDialogData } from '../../../emergencias/components/emergencia-alert-dialog';

/** HSE-SEGUIMIENTO-003 — gestión del evento: notificación → evaluación → reanudación. */
@Component({
  selector: 'app-swa-detail-page',
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillContextCardComponent,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillChecklistComponent,
    DynadrillCheckboxComponent,
    DynadrillTagComponent,
    DynadrillTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './swa-detail-page.html',
  styleUrl: './swa-detail-page.scss',
})
export class SwaDetailPage {
  private readonly swaService = inject(SwaService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly zeroRetaliationNotice = SWA_ZERO_RETALIATION_NOTICE;
  protected readonly estadoLabels = SWA_ESTADO_LABELS;

  protected readonly loading = signal(true);
  protected readonly evento = signal<SwaEvento | null>(null);
  protected readonly evaluacionNota = signal('');

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const e = this.evento();
    if (!e) return [];
    return [
      { label: 'Evento', value: e.code },
      { label: 'Tipo de peligro', value: e.tipoPeligro },
      { label: 'Ubicación', value: e.ubicacion || '—' },
      { label: 'Activado por', value: e.activadoPorNombre },
      { label: 'Estado', value: SWA_ESTADO_LABELS[e.estado] },
    ];
  });

  protected readonly notificacionCompleta = computed(() => {
    const e = this.evento();
    return !!e && swaNotificacionCompleta(e);
  });

  protected readonly checklistItems = computed<DynadrillChecklistItem[]>(() => this.evento()?.checklistReanudacion ?? []);

  protected readonly puedeReanudar = computed(() => {
    const e = this.evento();
    return !!e && e.riesgoReal !== null && e.checklistReanudacion.every(i => i.checked) && e.estado !== 'cerrado';
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.swaService.get(id).subscribe({
      next: e => {
        this.evento.set(e);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private patch(changes: Partial<SwaEvento>): void {
    const current = this.evento();
    if (!current) return;
    this.evento.set({ ...current, ...changes });
    this.swaService.update(current.id, changes).subscribe();
  }

  protected notificarRol(rol: string): void {
    const e = this.evento();
    if (!e) return;
    const notificaciones = e.notificaciones.map(n => (n.rol === rol && !n.notificadoAt ? { ...n, notificadoAt: new Date().toISOString() } : n));
    this.patch({ notificaciones });
  }

  protected evaluar(riesgoReal: boolean): void {
    this.patch({ riesgoReal, evaluacionNota: this.evaluacionNota() || undefined, evaluadoAt: new Date().toISOString(), estado: 'evaluado' });
  }

  protected toggleChecklist(index: number): void {
    const e = this.evento();
    if (!e) return;
    const checklistReanudacion = e.checklistReanudacion.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item));
    this.patch({ checklistReanudacion });
  }

  protected toggleHeroe(checked: boolean): void {
    this.patch({ heroeSeguridad: checked });
  }

  protected reanudar(): void {
    if (!this.puedeReanudar()) return;
    this.patch({ estado: 'cerrado', reanudadoAt: new Date().toISOString() });
  }

  /** HSE-MASTER-001: si el riesgo no se controla, escala a Emergencia Mayor (HSE-TRIAGE-001). */
  protected escalarAEmergencia(): void {
    const e = this.evento();
    if (!e) return;
    const ref = this.dialogService.open<EmergenciaAlertDialog, EmergenciaAlertDialogData>({
      title: 'Escalar a Emergencia Mayor — HSE-TRIAGE-001',
      content: EmergenciaAlertDialog,
      data: {
        origenSwaId: e.id,
        tipoSugerido: e.tipoPeligro,
        descripcionSugerida: `Escalado desde SWA ${e.code}: ${e.descripcion}`,
      },
      footer: false,
    });
    ref.afterClose.subscribe(evento => {
      if (evento) this.patch({ emergenciaId: evento.id });
    });
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/swa']);
  }
}
