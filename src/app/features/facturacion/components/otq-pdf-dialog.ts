import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { Otq, otqTotal } from '../models/facturacion.model';

export interface OtqPdfDialogData {
  otq: Otq;
}

/**
 * FACT-001, Fase 3 — "Generación de PDF del ticket para archivo", con
 * quién lo activó y cuándo. Mismo patrón que el informe de Mantenimiento
 * (DYN-MNT-RE-008): imprime la vista con window.print(), sin librería de
 * generación de PDF — el navegador ya resuelve "Guardar como PDF".
 */
@Component({
  selector: 'app-otq-pdf-dialog',
  imports: [DecimalPipe, DatePipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otq-pdf-dialog.html',
  styleUrl: './otq-pdf-dialog.scss',
})
export class OtqPdfDialog {
  protected readonly data = inject<OtqPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<OtqPdfDialog>);

  protected readonly otqTotal = otqTotal;

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  print(): void {
    window.print();
  }

  close(): void {
    this.modalRef.close();
  }
}
