import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { CAUSA_FALTANTE_LABELS, type CausaFaltante } from '../models/ticket-fcr';

export interface TicketFcrFaltanteDialogData {
  herramienta: string;
}
export interface FaltanteResultado {
  causa: CausaFaltante;
  detalle: string;
}

/** Bodega da una herramienta por faltante: la causa es de una lista y el detalle de lo ocurrido es obligatorio. */
@Component({
  selector: 'app-ticket-fcr-faltante-dialog',
  imports: [
    DynadrillButtonComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="d">
      <dynadrill-text variant="body"
        >La herramienta «{{ data.herramienta }}» no volvió al retorno. Indique la causa y qué
        ocurrió.</dynadrill-text
      >
      <dynadrill-select
        label="Causa"
        placeholder="Elija la causa"
        [options]="opciones"
        [value]="causa()"
        (valueChange)="causa.set($any($event))"
      />
      <dynadrill-textarea
        label="Detalle de lo ocurrido"
        [rows]="4"
        [value]="detalle()"
        (valueChange)="detalle.set($event)"
      />
    </div>
    <footer class="d__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!valido()" (clicked)="confirmar()"
        >Dar por faltante</dynadrill-button
      >
    </footer>
  `,
  styles: `
    .d {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .d__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class TicketFcrFaltanteDialog {
  private readonly modalRef = inject(
    NzModalRef<TicketFcrFaltanteDialog, FaltanteResultado | undefined>,
  );
  protected readonly data = inject<TicketFcrFaltanteDialogData>(NZ_MODAL_DATA);
  protected readonly opciones: DynadrillSelectOption[] = (
    Object.keys(CAUSA_FALTANTE_LABELS) as CausaFaltante[]
  ).map((c) => ({ label: CAUSA_FALTANTE_LABELS[c], value: c }));
  protected readonly causa = signal<CausaFaltante | null>(null);
  protected readonly detalle = signal('');
  protected readonly valido = computed(() => !!this.causa() && this.detalle().trim().length >= 3);

  protected confirmar(): void {
    const causa = this.causa();
    if (!causa || !this.valido()) return;
    this.modalRef.close({ causa, detalle: this.detalle().trim() });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
