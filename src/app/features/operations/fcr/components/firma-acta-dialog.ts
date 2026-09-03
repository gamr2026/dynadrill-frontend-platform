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

  protected readonly meetingDate = signal(new Date());
  protected readonly actaSigned = signal(false);
  protected readonly canConfirm = computed(() => this.actaSigned());

  protected confirm(): void {
    this.modalRef.close({ confirmed: true, meetingDate: this.meetingDate().toISOString() });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
