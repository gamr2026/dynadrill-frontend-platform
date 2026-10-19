import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';

export interface TicketFcrFechaDialogData {
  mensaje: string;
  etiqueta: string;
  /** Fecha propuesta (`AAAA-MM-DD`). */
  inicial?: string;
  /** Límites opcionales (las fechas del servicio del pedido). */
  desde?: string | null;
  hasta?: string | null;
  confirmar?: string;
}

/** Pide un día (acta de la reunión operativa, día nuevo de la bitácora o del uso de una herramienta). Cierra con `AAAA-MM-DD`. */
@Component({
  selector: 'app-ticket-fcr-fecha-dialog',
  imports: [DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="d">
      <dynadrill-text variant="body">{{ data.mensaje }}</dynadrill-text>
      <label class="d__campo">
        <span>{{ data.etiqueta }}</span>
        <input
          type="date"
          [value]="fecha()"
          [attr.min]="data.desde ?? null"
          [attr.max]="data.hasta ?? null"
          (input)="fecha.set($any($event.target).value)"
        />
      </label>
      @if (fuera()) {
        <dynadrill-text variant="caption" role="status"
          >El día debe estar dentro de las fechas del servicio ({{ data.desde ?? '…' }} a
          {{ data.hasta ?? '…' }}).</dynadrill-text
        >
      }
    </div>
    <footer class="d__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!valida()" (clicked)="confirmar()">{{
        data.confirmar ?? 'Aceptar'
      }}</dynadrill-button>
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
export class TicketFcrFechaDialog {
  private readonly modalRef = inject(NzModalRef<TicketFcrFechaDialog, string | undefined>);
  protected readonly data = inject<TicketFcrFechaDialogData>(NZ_MODAL_DATA);
  protected readonly fecha = signal(this.data.inicial ?? '');
  protected readonly fuera = computed(() => {
    const f = this.fecha();
    return (
      !!f &&
      ((!!this.data.desde && f < this.data.desde) || (!!this.data.hasta && f > this.data.hasta))
    );
  });
  protected readonly valida = computed(
    () => /^\d{4}-\d{2}-\d{2}$/.test(this.fecha()) && !this.fuera(),
  );

  protected confirmar(): void {
    if (this.valida()) this.modalRef.close(this.fecha());
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
