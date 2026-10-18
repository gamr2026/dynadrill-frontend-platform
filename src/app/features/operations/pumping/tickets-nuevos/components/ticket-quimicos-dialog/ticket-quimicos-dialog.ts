import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { concat, last } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeErrorTicket, validarMovimientoQuimicos, type FilaMovimientoQuimico, type QuimicoTicket, type QuimicosTicket } from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketQuimicosDialogData {
  ticketId: string;
  /** `consumo`: el Operador registra lo usado; `devolucion`: el Supervisor devuelve lo que sobró a una bodega de la que salió. */
  modo: 'consumo' | 'devolucion';
  quimicos: QuimicoTicket[];
}

/** Registra el consumo o la devolución de los químicos de un ticket. Solo se ofrecen los que todavía están a cargo del ticket. */
@Component({
  selector: 'app-ticket-quimicos-dialog',
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="tq">
      <dynadrill-text variant="body">{{ explicacion }}</dynadrill-text>
      @for (f of filas(); track f.articuloId; let i = $index) {
        <div class="tq__fila" [class.tq__fila--devolucion]="data.modo === 'devolucion'">
          <div class="tq__quimico">
            <strong>{{ f.codigo }}</strong>
            <span class="tq__meta">{{ f.nombre }} · a cargo del ticket: {{ f.pendiente }} {{ f.unidad }}</span>
          </div>
          @if (data.modo === 'devolucion') {
            <dynadrill-select label="Devolver a" placeholder="Bodega" [options]="opcionesBodega(f)" [value]="f.bodegaId" (valueChange)="cambiarBodega(i, $any($event))" />
          }
          <dynadrill-input [label]="data.modo === 'consumo' ? 'Cantidad usada' : 'Cantidad a devolver'" type="number" placeholder="0" [value]="f.cantidad === null ? '' : f.cantidad.toString()" (valueChange)="cambiarCantidad(i, $event)" />
        </div>
      } @empty {
        <dynadrill-text variant="caption">No hay químicos a cargo del ticket.</dynadrill-text>
      }
      @if (problema(); as p) {
        <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
      }
    </div>
    <footer class="tq__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!!problema() || enviando()" (clicked)="registrar()">{{ enviando() ? 'Registrando…' : data.modo === 'consumo' ? 'Registrar consumo' : 'Devolver a bodega' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .tq { display: flex; flex-direction: column; gap: 14px; }
    .tq__fila { display: grid; grid-template-columns: 1fr 140px; gap: 10px; align-items: end; }
    .tq__fila--devolucion { grid-template-columns: 1fr 200px 140px; }
    .tq__quimico { display: flex; flex-direction: column; gap: 2px; }
    .tq__meta { font-size: 12px; color: #5c5870; }
    .tq__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class TicketQuimicosDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketQuimicosDialog, QuimicosTicket | undefined>);
  protected readonly data = inject<TicketQuimicosDialogData>(NZ_MODAL_DATA);

  protected readonly explicacion =
    this.data.modo === 'consumo'
      ? 'Indique cuánto usó de cada químico. El consumo no mueve el stock: lo que no se use se devuelve a bodega en el control de retorno.'
      : 'Indique cuánto devuelve de cada químico a la bodega de la que salió. Lo usado no se devuelve.';

  protected readonly filas = signal<Array<FilaMovimientoQuimico & QuimicoTicket>>(
    this.data.quimicos
      .filter(q => q.pendiente > 0)
      .map(q => ({ ...q, cantidad: null, bodegaId: q.bodegas.length === 1 ? q.bodegas[0].bodegaId : null })),
  );
  protected readonly enviando = signal(false);
  protected readonly problema = computed(() => validarMovimientoQuimicos(this.filas(), this.data.modo === 'devolucion'));

  protected opcionesBodega(f: QuimicoTicket): DynadrillSelectOption[] {
    return f.bodegas.map(b => ({ label: b.bodega, value: b.bodegaId }));
  }
  protected cambiarCantidad(i: number, valor: string): void {
    const n = Number(valor);
    this.filas.update(l => l.map((f, k) => (k === i ? { ...f, cantidad: valor.trim() === '' || Number.isNaN(n) ? null : n } : f)));
  }
  protected cambiarBodega(i: number, bodegaId: string | null): void {
    this.filas.update(l => l.map((f, k) => (k === i ? { ...f, bodegaId } : f)));
  }

  protected registrar(): void {
    if (this.problema() || this.enviando()) return;
    const con = this.filas().filter(f => f.cantidad && f.cantidad > 0);
    this.enviando.set(true);
    const peticion$ =
      this.data.modo === 'consumo'
        ? concat(...con.map(f => this.servicio.consumirQuimico(this.data.ticketId, f.articuloId, f.cantidad as number))).pipe(last())
        : this.servicio.devolverQuimicos(
            this.data.ticketId,
            con.map(f => ({ articuloId: f.articuloId, bodegaId: f.bodegaId as string, cantidad: f.cantidad as number })),
          );
    peticion$.subscribe({
      next: r => {
        this.notify.success(this.data.modo === 'consumo' ? 'Consumo registrado' : 'Devolución registrada');
        this.modalRef.close(r);
      },
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo registrar', mensajeErrorTicket(err, 'No se pudo registrar. Intente de nuevo.'));
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
