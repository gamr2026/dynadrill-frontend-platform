import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillTextComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';

export interface GuiaSalidaBodegaDialogData {
  ticketCode: string;
  clientName: string;
  toolName: string;
}

export interface GuiaSalidaBodegaDialogResult {
  generated: boolean;
}

@Component({
  selector: 'app-guia-salida-bodega-dialog',
  /** Bottom sheet en móvil (Overlay/BottomSheet en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillTextComponent,
    DynadrillBannerComponent,
    DynadrillContextCardComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guia-salida-bodega-dialog.html',
  styleUrl: './guia-salida-bodega-dialog.scss',
})
export class GuiaSalidaBodegaDialog {
  private readonly modalRef = inject(
    NzModalRef<GuiaSalidaBodegaDialog, GuiaSalidaBodegaDialogResult | undefined>,
  );
  protected readonly data = inject<GuiaSalidaBodegaDialogData>(NZ_MODAL_DATA);

  protected readonly summaryItems: DynadrillContextCardItem[] = [
    { label: 'Herramienta', value: this.data.toolName },
    { label: 'Cliente', value: this.data.clientName },
    { label: 'Ticket', value: this.data.ticketCode },
  ];

  protected generate(): void {
    this.modalRef.close({ generated: true });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
