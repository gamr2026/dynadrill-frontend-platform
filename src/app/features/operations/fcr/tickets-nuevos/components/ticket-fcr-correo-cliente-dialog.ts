import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';

export interface TicketFcrCorreoClienteDialogData {
  /** Nombre del cliente, para que quien cierra sepa a quién le llegará la encuesta. */
  cliente?: string | null;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pide el correo del cliente al cerrar el ticket: ahí se envía la encuesta de satisfacción. Cierra con el correo. */
@Component({
  selector: 'app-ticket-fcr-correo-cliente-dialog',
  imports: [DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="d">
      <dynadrill-text variant="body"
        >Para cerrar el ticket indique el correo del cliente
        @if (data.cliente) {
          ({{ data.cliente }})
        }
        al que se enviará la encuesta de satisfacción. El enlace de la encuesta vale por un
        día.</dynadrill-text
      >
      <label class="d__campo">
        <span>Correo del cliente</span>
        <input
          type="email"
          autocomplete="off"
          maxlength="254"
          [value]="correo()"
          (input)="correo.set($any($event.target).value)"
          (keydown.enter)="confirmar()"
        />
      </label>
      @if (correo().trim() && !valido()) {
        <dynadrill-text variant="caption" role="status"
          >Escriba un correo válido, por ejemplo cliente&#64;empresa.com.</dynadrill-text
        >
      }
    </div>
    <footer class="d__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!valido()" (clicked)="confirmar()"
        >Cerrar ticket y enviar encuesta</dynadrill-button
      >
    </footer>
  `,
  styles: `
    .d {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .d__campo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: #5c5870;
    }
    .d__campo input {
      padding: 8px 10px;
      border: 1px solid #ccc9d9;
      border-radius: 8px;
      font: inherit;
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
export class TicketFcrCorreoClienteDialog {
  private readonly modalRef = inject(NzModalRef<TicketFcrCorreoClienteDialog, string | undefined>);
  protected readonly data = inject<TicketFcrCorreoClienteDialogData>(NZ_MODAL_DATA);
  protected readonly correo = signal('');
  protected readonly valido = computed(() => CORREO.test(this.correo().trim()));

  protected confirmar(): void {
    if (this.valido()) this.modalRef.close(this.correo().trim());
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
