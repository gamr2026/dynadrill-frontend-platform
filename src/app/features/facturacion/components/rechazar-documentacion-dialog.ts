import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextareaComponent } from '@digitec-it-projects/dynadrill-ui';

export interface RechazarDocumentacionDialogData {
  fecha: string;
}

/** FACT-002 — "Rechazar → Devuelve a supervisor con observaciones": el motivo lo escribe Facturación, no un texto genérico fijo. */
@Component({
  selector: 'app-rechazar-documentacion-dialog',
  imports: [DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rechazar-documentacion-dialog.html',
  styleUrl: './rechazar-documentacion-dialog.scss',
})
export class RechazarDocumentacionDialog {
  protected readonly data = inject<RechazarDocumentacionDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<RechazarDocumentacionDialog, string | undefined>);

  protected readonly observaciones = signal('');
  protected readonly puedeRechazar = computed(() => this.observaciones().trim().length > 0);

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected confirmar(): void {
    if (!this.puedeRechazar()) return;
    this.modalRef.close(this.observaciones().trim());
  }
}
