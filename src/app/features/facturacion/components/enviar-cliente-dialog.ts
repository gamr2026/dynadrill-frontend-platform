import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  DynadrillUploadZoneComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { Prefactura } from '../models/prefactura.model';
import { PrefacturaService } from '../services/pedido.service';

export interface EnviarClienteDialogData {
  prefacturaId: number;
  /** Adjuntos que ya se arman por defecto (Prefactura + reportes). */
  adjuntosBase: string[];
}

/** FACT-004 — envío del paquete de la prefactura al cliente. */
@Component({
  selector: 'app-enviar-cliente-dialog',
  imports: [DynadrillSelectComponent, DynadrillUploadZoneComponent, DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './enviar-cliente-dialog.html',
  styleUrl: './enviar-cliente-dialog.scss',
  host: { 'data-bottom-sheet': '' },
})
export class EnviarClienteDialog {
  private readonly prefacturaService = inject(PrefacturaService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<EnviarClienteDialog, Prefactura | undefined>);
  protected readonly data = inject<EnviarClienteDialogData>(NZ_MODAL_DATA);

  protected readonly medio = signal('email');
  protected readonly medioOptions: DynadrillSelectOption[] = [
    { label: 'Correo electrónico', value: 'email' },
    { label: 'Portal del cliente', value: 'portal' },
  ];

  protected readonly adjuntosExtra = signal<string[]>([]);
  protected readonly adjuntos = computed(() => [...this.data.adjuntosBase, ...this.adjuntosExtra()]);
  protected readonly submitting = signal(false);

  protected onArchivo(file: NzUploadFile): void {
    if (file.name) this.adjuntosExtra.update(l => [...l, file.name!]);
  }

  protected quitarExtra(i: number): void {
    this.adjuntosExtra.update(l => l.filter((_, idx) => idx !== i));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected enviar(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.prefacturaService.enviarAlCliente(this.data.prefacturaId, this.medio(), this.adjuntos(), this.auth.currentUser()?.name ?? 'Facturación').subscribe({
      next: pf => {
        this.notify.success('Enviado al cliente', 'La prefactura queda a la espera de firma.');
        this.modalRef.close(pf);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo enviar la prefactura.');
      },
    });
  }
}
