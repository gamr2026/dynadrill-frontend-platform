import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { Aot } from '../models/aot.model';

export interface AotPdfDialogData {
  aot: Aot;
}

/**
 * Vista imprimible de la AOT — "ORDEN DE TRABAJO / RESUMEN DE COSTOS",
 * formato de la pestaña OTQ de `COMP. 4130`. Firmas físicas.
 */
@Component({
  selector: 'app-aot-pdf-dialog',
  imports: [DecimalPipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aot-pdf-dialog.html',
  styleUrl: './aot-pdf-dialog.scss',
})
export class AotPdfDialog {
  protected readonly data = inject<AotPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<AotPdfDialog>);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  print(): void {
    window.print();
  }

  close(): void {
    this.modalRef.close();
  }
}
