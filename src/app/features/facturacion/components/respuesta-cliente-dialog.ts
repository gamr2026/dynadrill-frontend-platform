import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { Prefactura } from '../models/prefactura.model';
import { PrefacturaService } from '../services/pedido.service';

export interface RespuestaClienteDialogData {
  prefacturaId: number;
}

/** FACT-004 — el cliente firma o rechaza la prefactura. */
@Component({
  selector: 'app-respuesta-cliente-dialog',
  imports: [
    DynadrillSelectComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './respuesta-cliente-dialog.html',
  styleUrl: './respuesta-cliente-dialog.scss',
  host: { 'data-bottom-sheet': '' },
})
export class RespuestaClienteDialog {
  private readonly prefacturaService = inject(PrefacturaService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<RespuestaClienteDialog, Prefactura | undefined>);
  protected readonly data = inject<RespuestaClienteDialogData>(NZ_MODAL_DATA);

  protected readonly respuesta = signal<'firma' | 'rechazo'>('firma');
  protected readonly respuestaOptions: DynadrillSelectOption[] = [
    { label: 'El cliente firmó la prefactura', value: 'firma' },
    { label: 'El cliente rechazó la prefactura', value: 'rechazo' },
  ];

  // Firma
  protected readonly nombre = signal('');
  protected readonly cargo = signal('Ingeniero de Operaciones');

  // Rechazo
  protected readonly motivo = signal('');
  protected readonly razonRetraso = signal('');
  protected readonly devueltoA = signal('');

  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(() =>
    this.respuesta() === 'firma'
      ? this.nombre().trim().length > 0 && this.cargo().trim().length > 0
      : this.motivo().trim().length > 0 && this.devueltoA().trim().length > 0,
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);
    const usuario = this.auth.currentUser()?.name ?? 'Facturación';

    const req$ =
      this.respuesta() === 'firma'
        ? this.prefacturaService.registrarFirma(this.data.prefacturaId, this.nombre().trim(), this.cargo().trim(), usuario)
        : this.prefacturaService.registrarRechazo(
            this.data.prefacturaId,
            {
              motivo: this.motivo().trim(),
              razonRetraso: this.razonRetraso().trim() || undefined,
              devueltoA: this.devueltoA().trim(),
            },
            usuario,
          );

    req$.subscribe({
      next: pf => {
        this.notify.success(
          this.respuesta() === 'firma' ? 'Firma registrada' : 'Rechazo registrado',
          this.respuesta() === 'firma' ? 'La prefactura queda firmada.' : 'El pedido vuelve a corrección.',
        );
        this.modalRef.close(pf);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar la respuesta del cliente.');
      },
    });
  }
}
