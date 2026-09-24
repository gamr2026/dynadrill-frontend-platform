import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextareaComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';

export interface MotivoDialogData {
  /** Pregunta/contexto arriba del textarea — ej. "¿Por qué se rechaza este checklist?". */
  mensaje: string;
  label?: string;
}

/**
 * Diálogo genérico "escribí un motivo" — reemplaza el patrón de un
 * `dynadrill-input` suelto dentro de una fila de íconos de acciones (se veía
 * roto en celdas angostas). Devuelve el motivo (string no vacío) al cerrar
 * con "Confirmar", o `undefined` si se cancela.
 */
@Component({
  selector: 'app-motivo-dialog',
  imports: [DynadrillTextareaComponent, DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motivo-dialog.html',
  styleUrl: './motivo-dialog.scss',
})
export class MotivoDialog {
  private readonly data = inject<MotivoDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<MotivoDialog, string | undefined>);

  protected readonly mensaje = this.data.mensaje;
  protected readonly label = this.data.label ?? 'Motivo';
  protected readonly motivo = signal('');

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected confirmar(): void {
    const m = this.motivo().trim();
    if (!m) return;
    this.modalRef.close(m);
  }
}
