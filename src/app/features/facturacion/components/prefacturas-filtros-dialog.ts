import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillChipGroupComponent } from '@digitec-it-projects/dynadrill-ui';
import { EstadoPrefactura } from '../models/prefactura.model';

export interface PrefacturasFiltros {
  estado: EstadoPrefactura | null;
}

export const ESTADO_PREFACTURA_LABELS: Record<EstadoPrefactura, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  generada: 'Generada',
  enviada_para_firmas: 'Enviada para firmas',
  firmada: 'Firmada',
  rechazada: 'Rechazada',
};

const TODOS = 'Todos';

/**
 * Filtros de la lista de Prefacturas en móvil (mismo patrón bottom sheet que
 * los filtros de Pedidos). Devuelve el nuevo estado al cerrar con "Aplicar" o
 * "Limpiar"; cerrar con la X no cambia nada.
 */
@Component({
  selector: 'app-prefacturas-filtros-dialog',
  imports: [DynadrillButtonComponent, DynadrillChipGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filtros">
      <section class="filtros__group">
        <h3 class="filtros__label">Estado</h3>
        <dynadrill-chip-group mode="single" [options]="estadoChips" [selected]="estadoSeleccionado()" (selectedChange)="onEstado($event)" />
      </section>

      <div class="filtros__footer">
        <dynadrill-button variant="secondary" (clicked)="limpiar()">Limpiar</dynadrill-button>
        <dynadrill-button (clicked)="aplicar()">Aplicar</dynadrill-button>
      </div>
    </div>
  `,
  styleUrl: './prefacturas-filtros-dialog.scss',
  host: { 'data-bottom-sheet': '' },
})
export class PrefacturasFiltrosDialog {
  private readonly modalRef = inject(NzModalRef<PrefacturasFiltrosDialog, PrefacturasFiltros>);
  private readonly inicial = inject<PrefacturasFiltros>(NZ_MODAL_DATA);

  protected readonly estado = signal<EstadoPrefactura | null>(this.inicial.estado);

  /** dynadrill-chip-group trabaja con textos: el label es el valor y se traduce a la clave al elegir. */
  protected readonly estadoChips = [TODOS, ...Object.values(ESTADO_PREFACTURA_LABELS)];
  protected readonly estadoSeleccionado = computed(() => [this.estado() ? ESTADO_PREFACTURA_LABELS[this.estado()!] : TODOS]);

  protected onEstado(selected: string[]): void {
    const entry = (Object.entries(ESTADO_PREFACTURA_LABELS) as [EstadoPrefactura, string][]).find(([, l]) => l === selected[0]);
    this.estado.set(entry?.[0] ?? null);
  }

  protected limpiar(): void {
    this.modalRef.close({ estado: null } satisfies PrefacturasFiltros);
  }

  protected aplicar(): void {
    this.modalRef.close({ estado: this.estado() } satisfies PrefacturasFiltros);
  }
}
