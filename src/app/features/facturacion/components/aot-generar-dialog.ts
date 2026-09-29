import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { Aot } from '../models/aot.model';
import { AotService } from '../services/pedido.service';

export interface AotGenerarDialogData {
  prefacturaId: number;
  descripcionSugerida: string;
  representanteSugerido: { nombre: string; cargo: string };
}

/** FACT-004 — genera la AOT de una prefactura firmada. */
@Component({
  selector: 'app-aot-generar-dialog',
  imports: [DynadrillInputComponent, DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aot-generar-dialog.html',
  styleUrl: './aot-generar-dialog.scss',
  host: { class: 'app-dialog-sheet-mobile' },
})
export class AotGenerarDialog {
  private readonly aotService = inject(AotService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<AotGenerarDialog, Aot | undefined>);
  protected readonly data = inject<AotGenerarDialogData>(NZ_MODAL_DATA);

  protected readonly ciudad = signal('UIO');
  protected readonly descripcion = signal(this.data.descripcionSugerida);
  protected readonly repNombre = signal(this.data.representanteSugerido.nombre);
  protected readonly repCargo = signal(this.data.representanteSugerido.cargo);
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(
    () => this.ciudad().trim().length > 0 && this.descripcion().trim().length > 0 && this.repNombre().trim().length > 0,
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected generar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);
    this.aotService
      .generar(
        this.data.prefacturaId,
        {
          ciudad: this.ciudad().trim().toUpperCase(),
          descripcionRequerimiento: this.descripcion().trim(),
          representanteCliente: { nombre: this.repNombre().trim(), cargo: this.repCargo().trim() },
        },
        this.auth.currentUser()?.name ?? 'Facturación',
      )
      .subscribe({
        next: aot => {
          this.notify.success('AOT generada', aot.numeroOpr);
          this.modalRef.close(aot);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo generar la AOT.');
        },
      });
  }
}
