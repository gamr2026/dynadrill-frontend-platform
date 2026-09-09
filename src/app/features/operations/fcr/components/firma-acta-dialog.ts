import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDatetimePickerComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';

export interface FirmaActaDialogData {
  ticketCode: string;
}

export interface FirmaActaDialogResult {
  confirmed: boolean;
  meetingDate?: string;
}

@Component({
  selector: 'app-firma-acta-dialog',
  imports: [DynadrillTextComponent, DynadrillDatetimePickerComponent, DynadrillCheckboxComponent, DynadrillBannerComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './firma-acta-dialog.html',
  styleUrl: './firma-acta-dialog.scss',
})
export class FirmaActaDialog {
  private readonly modalRef = inject(NzModalRef<FirmaActaDialog, FirmaActaDialogResult | undefined>);
  protected readonly data = inject<FirmaActaDialogData>(NZ_MODAL_DATA);

  // Tipado `Date | null`: el picker permite limpiar el campo (allowClear) y emite null
  // pese a que su tipo declarado diga Date — canConfirm/confirm() lo validan.
  protected readonly meetingDate = signal<Date | null>(new Date());
  protected readonly actaSigned = signal(false);
  protected readonly canConfirm = computed(() => this.actaSigned() && this.meetingDate() !== null);

  protected confirm(): void {
    const meetingDate = this.meetingDate();
    if (!meetingDate) return;
    this.modalRef.close({ confirmed: true, meetingDate: meetingDate.toISOString() });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
