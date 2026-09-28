import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillSelectComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { ESTADO_PEDIDO_LABELS, EstadoPedido } from '../models/pedido.model';

export interface ReporteriaFiltros {
  estado: EstadoPedido | null;
}

/**
 * Filtros de "Secuencial TK" en móvil (ícono de embudo del Figma "M · Reportería
 * · Secuencial TK"). Devuelve el nuevo estado al cerrar con "Aplicar" o
 * "Limpiar"; cerrar con la X no cambia nada.
 */
@Component({
  selector: 'app-reporteria-filtros-dialog',
  imports: [DynadrillButtonComponent, DynadrillSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filtros">
      <section class="filtros__group">
        <dynadrill-select label="Estado" placeholder="Todos los estados" [options]="estadoOptions" [value]="estado()" (valueChange)="estado.set($any($event) || null)" />
      </section>

      <div class="filtros__footer">
        <dynadrill-button variant="secondary" (clicked)="limpiar()">Limpiar</dynadrill-button>
        <dynadrill-button (clicked)="aplicar()">Aplicar</dynadrill-button>
      </div>
    </div>
  `,
  styleUrl: './reporteria-filtros-dialog.scss',
  host: { 'data-bottom-sheet': '' },
})
export class ReporteriaFiltrosDialog {
  private readonly modalRef = inject(NzModalRef<ReporteriaFiltrosDialog, ReporteriaFiltros>);
  private readonly inicial = inject<ReporteriaFiltros>(NZ_MODAL_DATA);

  protected readonly estado = signal<EstadoPedido | null>(this.inicial.estado);
  protected readonly estadoOptions: DynadrillSelectOption[] = (Object.entries(ESTADO_PEDIDO_LABELS) as [EstadoPedido, string][]).map(
    ([value, label]) => ({ label, value }),
  );

  protected limpiar(): void {
    this.modalRef.close({ estado: null } satisfies ReporteriaFiltros);
  }

  protected aplicar(): void {
    this.modalRef.close({ estado: this.estado() } satisfies ReporteriaFiltros);
  }
}
