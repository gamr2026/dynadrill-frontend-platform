import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
export interface ReporteriaFiltros {
  /** Código del estado del pedido (null = todos). */
  estado: string | null;
  /** Los estados que tienen pedidos, con su nombre: lo que se ofrece en el select. */
  opciones?: { value: string; label: string }[];
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
        <dynadrill-select
          label="Estado"
          placeholder="Todos los estados"
          [options]="estadoOptions"
          [value]="estado()"
          (valueChange)="estado.set($any($event) || null)"
        />
      </section>

      <div class="filtros__footer">
        <dynadrill-button variant="secondary" (clicked)="limpiar()">Limpiar</dynadrill-button>
        <dynadrill-button (clicked)="aplicar()">Aplicar</dynadrill-button>
      </div>
    </div>
  `,
  styleUrl: './reporteria-filtros-dialog.scss',
  host: { class: 'app-dialog-sheet-mobile' },
})
export class ReporteriaFiltrosDialog {
  private readonly modalRef = inject(NzModalRef<ReporteriaFiltrosDialog, ReporteriaFiltros>);
  private readonly inicial = inject<ReporteriaFiltros>(NZ_MODAL_DATA);

  protected readonly estado = signal<string | null>(this.inicial.estado);
  protected readonly estadoOptions: DynadrillSelectOption[] = (this.inicial.opciones ?? []).map(
    ({ value, label }) => ({ label, value }),
  );

  protected limpiar(): void {
    this.modalRef.close({ estado: null } satisfies ReporteriaFiltros);
  }

  protected aplicar(): void {
    this.modalRef.close({
      estado: this.estado(),
      opciones: this.inicial.opciones,
    } satisfies ReporteriaFiltros);
  }
}
