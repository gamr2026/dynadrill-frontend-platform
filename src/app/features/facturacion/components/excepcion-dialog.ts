import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillTextareaComponent } from '@digitec-it-projects/dynadrill-ui';
import { Excepcion } from '../models/facturacion.model';
import { ExcepcionService } from '../services/facturacion.service';

export interface ExcepcionDialogData {
  pedidoId: number;
  montoExcedenteSugerido: number;
}

/** FACT-003, Escenario A — sobrepaso detectado al 100% del presupuesto (FACT-002). La negociación con el cliente es externa; acá solo se registra el resultado. */
@Component({
  selector: 'app-excepcion-dialog',
  imports: [DynadrillInputComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './excepcion-dialog.html',
  styleUrl: './excepcion-dialog.scss',
})
export class ExcepcionDialog {
  private readonly excepcionService = inject(ExcepcionService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ExcepcionDialog, Excepcion | undefined>);
  protected readonly data = inject<ExcepcionDialogData>(NZ_MODAL_DATA);

  protected readonly montoExcedente = signal(Math.round(this.data.montoExcedenteSugerido * 100) / 100);
  protected readonly justificacion = signal('');
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(() => this.montoExcedente() > 0 && this.justificacion().trim().length > 0);

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    this.excepcionService
      .create({ pedidoId: this.data.pedidoId, tipo: 'sobrepaso', montoExcedente: this.montoExcedente(), justificacion: this.justificacion().trim() })
      .subscribe({
        next: e => {
          this.notify.success('Excepción registrada', 'Se activó la gestión de excepción — Ventas debe negociar el excedente con el cliente.');
          this.modalRef.close(e);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo registrar la excepción.');
        },
      });
  }
}
