import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { ActaEntregaRecepcion, FacturacionTicket, Otq } from '../models/facturacion.model';

export interface TicketPdfDialogData {
  ticket: FacturacionTicket;
  /** Datos del contrato/pozo — vienen de la OTQ vinculada (AS2 el día que se conecte). */
  otq?: Otq;
  /** Fechas reales de inicio/fin del trabajo — del acta de entrega-recepción. */
  acta?: ActaEntregaRecepcion;
}

/**
 * Vista imprimible de la Prefactura / Ticket de Facturación, con el mismo
 * layout que la plantilla real DYN-AFN-RE-11B. Mismo patrón que
 * [[OtqPdfDialog]]: imprime con window.print(), sin librería de PDF — el
 * navegador resuelve "Guardar como PDF".
 */
@Component({
  selector: 'app-ticket-pdf-dialog',
  imports: [DecimalPipe, DatePipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-pdf-dialog.html',
  styleUrl: './ticket-pdf-dialog.scss',
})
export class TicketPdfDialog {
  protected readonly data = inject<TicketPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<TicketPdfDialog>);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });

  print(): void {
    window.print();
  }

  close(): void {
    this.modalRef.close();
  }
}
