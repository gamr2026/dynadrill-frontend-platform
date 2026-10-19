import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { FcrTool, MISSING_TOOL_REASON_LABELS, type MissingToolReason } from '../models/fcr.model';

export interface HerramientaFaltanteDialogData {
  ticketCode: string;
  tools: FcrTool[];
}

export interface HerramientaFaltanteDialogResult {
  registered: boolean;
  toolId?: number;
  reason?: string;
}

const REASON_OPTIONS: DynadrillSelectOption[] = Object.entries(MISSING_TOOL_REASON_LABELS).map(
  ([value, label]) => ({ label, value }),
);

@Component({
  selector: 'app-herramienta-faltante-dialog',
  /** Bottom sheet en móvil (Overlay/BottomSheet en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillTextComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './herramienta-faltante-dialog.html',
  styleUrl: './herramienta-faltante-dialog.scss',
})
export class HerramientaFaltanteDialog {
  private readonly modalRef = inject(
    NzModalRef<HerramientaFaltanteDialog, HerramientaFaltanteDialogResult | undefined>,
  );
  protected readonly data = inject<HerramientaFaltanteDialogData>(NZ_MODAL_DATA);

  protected readonly toolOptions: DynadrillSelectOption[] = this.data.tools.map((t) => ({
    label: t.name,
    value: t.id,
  }));
  protected readonly reasonOptions = REASON_OPTIONS;

  protected readonly selectedToolId = signal<number | null>(null);
  protected readonly selectedReason = signal<MissingToolReason | null>(null);
  protected readonly notes = signal('');

  protected readonly canRegister = computed(
    () => this.selectedToolId() !== null && this.selectedReason() !== null,
  );

  protected onToolChange(value: unknown): void {
    this.selectedToolId.set(value as number);
  }

  protected onReasonChange(value: unknown): void {
    this.selectedReason.set(value as MissingToolReason);
  }

  protected register(): void {
    const toolId = this.selectedToolId();
    const reasonKey = this.selectedReason();
    if (toolId === null || reasonKey === null) return;
    const reason = this.notes().trim()
      ? `${MISSING_TOOL_REASON_LABELS[reasonKey]} — ${this.notes().trim()}`
      : MISSING_TOOL_REASON_LABELS[reasonKey];
    this.modalRef.close({ registered: true, toolId, reason });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
