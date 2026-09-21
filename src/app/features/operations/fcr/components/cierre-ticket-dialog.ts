import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillTextComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';

export interface CierreTicketDialogData {
  ticketCode: string;
  clientName: string;
  toolsReturnedSummary: string;
  /** "4 de 6" — solo los documentos con archivo real (ver `closureStats`/`closureOtherDocuments` en ticket-detail-page.ts). */
  documentsSummary: string;
  /** "3 de 3 enviados" — checklists de inspección de herramientas. */
  checklistsSummary: string;
}

export interface CierreTicketDialogResult {
  closed: boolean;
}

@Component({
  selector: 'app-cierre-ticket-dialog',
  imports: [DynadrillTextComponent, DynadrillContextCardComponent, DynadrillBannerComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cierre-ticket-dialog.html',
  styleUrl: './cierre-ticket-dialog.scss',
})
export class CierreTicketDialog {
  private readonly modalRef = inject(NzModalRef<CierreTicketDialog, CierreTicketDialogResult | undefined>);
  protected readonly data = inject<CierreTicketDialogData>(NZ_MODAL_DATA);

  protected readonly summaryItems: DynadrillContextCardItem[] = [
    { label: 'Ticket', value: this.data.ticketCode },
    { label: 'Cliente', value: this.data.clientName },
    { label: 'Herramientas', value: this.data.toolsReturnedSummary },
    { label: 'Documentos', value: this.data.documentsSummary },
    { label: 'Checklists de inspección', value: this.data.checklistsSummary },
  ];

  protected close(): void {
    this.modalRef.close({ closed: true });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
