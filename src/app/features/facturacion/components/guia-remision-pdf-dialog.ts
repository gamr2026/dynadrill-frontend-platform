import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { GuiaRemision } from '../models/guia-remision.model';
import { Pedido } from '../models/pedido.model';

export interface GuiaRemisionPdfDialogData {
  guia: GuiaRemision;
  pedido: Pedido;
}

/** Vista imprimible de la Guía de Remisión — mismo formato que la hoja GUIA de los tickets reales. */
@Component({
  selector: 'app-guia-remision-pdf-dialog',
  imports: [DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guia-remision-pdf-dialog.html',
  styleUrl: './guia-remision-pdf-dialog.scss',
})
export class GuiaRemisionPdfDialog {
  protected readonly data = inject<GuiaRemisionPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<GuiaRemisionPdfDialog>);

  print(): void {
    window.print();
  }

  close(): void {
    this.modalRef.close();
  }
}
