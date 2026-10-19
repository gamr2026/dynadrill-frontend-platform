import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { FcrObservation } from '../models/fcr.model';

export interface ObservacionesTimelineDialogData {
  ticketCode: string;
  observations: FcrObservation[];
}

export interface ObservacionesTimelineDialogResult {
  added: boolean;
  message?: string;
}

/**
 * A diferencia de `SolicitarCorreccionDialog` (atado a rechazar 'revision_inicial'),
 * este diálogo es de propósito general: se puede abrir desde cualquier fase para ver
 * el historial completo de `ticket.observations` y agregar una nueva, sin disparar
 * ninguna otra acción de negocio.
 */
@Component({
  selector: 'app-observaciones-timeline-dialog',
  /** Bottom sheet en móvil (Overlay/BottomSheet en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillTextComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './observaciones-timeline-dialog.html',
  styleUrl: './observaciones-timeline-dialog.scss',
})
export class ObservacionesTimelineDialog {
  private readonly modalRef = inject(
    NzModalRef<ObservacionesTimelineDialog, ObservacionesTimelineDialogResult | undefined>,
  );
  protected readonly data = inject<ObservacionesTimelineDialogData>(NZ_MODAL_DATA);

  protected readonly message = signal('');
  protected readonly canSend = computed(() => this.message().trim() !== '');

  protected agregar(): void {
    this.modalRef.close({ added: true, message: this.message().trim() });
  }

  protected cerrar(): void {
    this.modalRef.close({ added: false });
  }
}
