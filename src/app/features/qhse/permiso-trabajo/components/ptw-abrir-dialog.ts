import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import { fechaIso, type PedidoDocumental } from '../../documentos-pedido/models/documento-pedido';
import { DocumentosPedidoService } from '../../documentos-pedido/services/documentos-pedido.service';
import type { PtwDetalle } from '../models/permiso-trabajo';
import { PermisoTrabajoService } from '../services/permiso-trabajo.service';

/** Abre el PTW de un día de operación de un ticket (uno vigente por pedido y día). Nace en gabinete. */
@Component({
  selector: 'app-ptw-abrir-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillButtonComponent,
    DynadrillDatetimePickerComponent,
    DynadrillSelectComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pa">
      <dynadrill-text variant="body"
        >Elija el ticket y el día de operación. Solo puede haber un PTW por pedido y
        día.</dynadrill-text
      >
      <dynadrill-select
        label="Ticket"
        placeholder="Elija un ticket"
        [options]="opciones()"
        [value]="ticketId()"
        [searchable]="true"
        (valueChange)="ticketId.set($any($event))"
      />
      <dynadrill-datetime-picker
        mode="date"
        label="Día de operación"
        [value]="dia()!"
        (valueChange)="dia.set($event)"
      />
    </div>
    <footer class="pa__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!ticketId() || !dia() || enviando()" (clicked)="abrir()">{{
        enviando() ? 'Abriendo…' : 'Abrir PTW'
      }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .pa {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .pa__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class PtwAbrirDialog {
  private readonly servicio = inject(PermisoTrabajoService);
  private readonly pedidos = inject(DocumentosPedidoService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<PtwAbrirDialog, PtwDetalle | undefined>);

  private readonly conocidos = signal<PedidoDocumental[]>([]);
  protected readonly ticketId = signal('');
  protected readonly dia = signal<Date | null>(new Date());
  protected readonly enviando = signal(false);
  protected readonly opciones = computed<DynadrillSelectOption[]>(() =>
    this.conocidos().flatMap((p) =>
      p.tickets.map((t) => ({
        value: t.ticketId,
        label: `Ticket ${t.numero ?? '—'} · ${p.pedidoCodigo}${p.cliente ? ` · ${p.cliente}` : ''}`,
      })),
    ),
  );

  constructor() {
    this.pedidos.pedidos().subscribe({
      next: (p) => this.conocidos.set(p),
      error: (err) =>
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la lista de tickets.')),
    });
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected abrir(): void {
    const dia = this.dia();
    if (!this.ticketId() || !dia || this.enviando()) return;
    this.enviando.set(true);
    this.servicio.abrir(this.ticketId(), fechaIso(dia)).subscribe({
      next: (p) => this.modalRef.close(p),
      error: (err) => {
        this.enviando.set(false);
        this.notify.error('No se pudo abrir', mensajeDeError(err, 'No se pudo abrir el PTW.'));
      },
    });
  }
}
