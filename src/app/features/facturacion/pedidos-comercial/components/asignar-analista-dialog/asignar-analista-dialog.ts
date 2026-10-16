import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillNotificationService, DynadrillSelectComponent, DynadrillTextComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { RolesService } from '../../../../users/services/users.service';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import { mensajeDeError, type PedidoDetalle } from '../../models/pedido-comercial.model';

export interface AsignarAnalistaDialogData {
  pedidoId: string;
  codigo: string | null;
  analistaActual: string | null;
}

/** Asigna o reasigna el analista de facturación (usuarios con el rol Facturación). */
@Component({
  selector: 'app-asignar-analista-dialog',
  imports: [DynadrillSelectComponent, DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="asignar">
      <dynadrill-text variant="body">
        {{ data.analistaActual ? 'Analista actual: ' + data.analistaActual + '.' : 'El pedido todavía no tiene analista de facturación.' }}
      </dynadrill-text>
      <dynadrill-select label="Analista de facturación" placeholder="Elija un analista" [options]="opciones()" [value]="elegido()" [searchable]="true" (valueChange)="elegido.set($any($event))" />
    </div>
    <footer class="asignar__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!elegido() || enviando()" (clicked)="asignar()">{{ enviando() ? 'Asignando…' : 'Asignar' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .asignar { display: flex; flex-direction: column; gap: 14px; }
    .asignar__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class AsignarAnalistaDialog {
  private readonly servicio = inject(PedidosComercialService);
  private readonly roles = inject(RolesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<AsignarAnalistaDialog, PedidoDetalle | undefined>);
  protected readonly data = inject<AsignarAnalistaDialogData>(NZ_MODAL_DATA);

  protected readonly analistas = signal<{ id: string; name: string }[]>([]);
  protected readonly elegido = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly opciones = computed<DynadrillSelectOption[]>(() => this.analistas().map(a => ({ label: a.name, value: a.id })));

  constructor() {
    this.roles.usuariosPorRol('facturacion').subscribe({
      next: u => this.analistas.set(u),
      error: err => this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar los analistas de facturación.')),
    });
  }

  protected asignar(): void {
    const analistaId = this.elegido();
    if (!analistaId || this.enviando()) return;
    this.enviando.set(true);
    this.servicio.asignarAnalista(this.data.pedidoId, analistaId).subscribe({
      next: p => {
        this.notify.success('Analista asignado', `${p.responsables.analistaFacturacion.nombre ?? 'El analista'} atenderá el pedido ${p.codigo ?? ''}.`.trim());
        this.modalRef.close(p);
      },
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo asignar', mensajeDeError(err, 'No se pudo asignar el analista.'));
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
