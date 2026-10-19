import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';

export interface SolicitarCorreccionDialogData {
  ticketCode: string;
  proposalVersion: number;
}

export interface SolicitarCorreccionDialogResult {
  requested: boolean;
  observations?: string;
}

@Component({
  selector: 'app-solicitar-correccion-dialog',
  /** Bottom sheet en móvil (Overlay/BottomSheet en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillTextComponent,
    DynadrillTagComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitar-correccion-dialog.html',
  styleUrl: './solicitar-correccion-dialog.scss',
})
export class SolicitarCorreccionDialog {
  private readonly modalRef = inject(
    NzModalRef<SolicitarCorreccionDialog, SolicitarCorreccionDialogResult | undefined>,
  );
  protected readonly data = inject<SolicitarCorreccionDialogData>(NZ_MODAL_DATA);

  protected readonly versionLabel = `Versión V${this.data.proposalVersion}`;
  protected readonly observations = signal('');
  protected readonly canSend = computed(() => this.observations().trim() !== '');

  protected send(): void {
    this.modalRef.close({ requested: true, observations: this.observations() });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
