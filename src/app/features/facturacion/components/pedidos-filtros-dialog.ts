import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { ESTADO_PEDIDO_LABELS, EstadoPedido, LINEA_SERVICIO_LABELS, LineaServicio } from '../models/pedido.model';

export interface PedidosFiltros {
  linea: LineaServicio | null;
  estado: EstadoPedido | null;
  origen: 'as2' | 'portal' | null;
}

const TODAS = 'Todas';
const TODOS = 'Todos';
const ORIGEN_LABELS = { as2: 'AS2', portal: 'Portal' } as const;

/**
 * Filtros de la lista de Pedidos en móvil (Figma "Pedidos · Filtros (bottom
 * sheet)"). Devuelve el nuevo estado de filtros al cerrar con "Aplicar" o
 * "Limpiar"; cerrar con la X no cambia nada.
 */
@Component({
  selector: 'app-pedidos-filtros-dialog',
  imports: [DynadrillButtonComponent, DynadrillChipGroupComponent, DynadrillSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedidos-filtros-dialog.html',
  styleUrl: './pedidos-filtros-dialog.scss',
  host: { 'data-bottom-sheet': '' },
})
export class PedidosFiltrosDialog {
  private readonly modalRef = inject(NzModalRef<PedidosFiltrosDialog, PedidosFiltros>);
  private readonly inicial = inject<PedidosFiltros>(NZ_MODAL_DATA);

  protected readonly linea = signal<LineaServicio | null>(this.inicial.linea);
  protected readonly estado = signal<EstadoPedido | null>(this.inicial.estado);
  protected readonly origen = signal<'as2' | 'portal' | null>(this.inicial.origen);

  /** dynadrill-chip-group trabaja con textos: el label es el valor y se traduce a la clave al elegir. */
  protected readonly lineaChips = [TODAS, ...Object.values(LINEA_SERVICIO_LABELS)];
  protected readonly origenChips = [TODOS, ...Object.values(ORIGEN_LABELS)];
  protected readonly estadoOptions: DynadrillSelectOption[] = (Object.entries(ESTADO_PEDIDO_LABELS) as [EstadoPedido, string][]).map(
    ([value, label]) => ({ label, value }),
  );

  protected readonly lineaSeleccionada = computed(() => [this.linea() ? LINEA_SERVICIO_LABELS[this.linea()!] : TODAS]);
  protected readonly origenSeleccionado = computed(() => [this.origen() ? ORIGEN_LABELS[this.origen()!] : TODOS]);

  protected onLinea(selected: string[]): void {
    const label = selected[0];
    const entry = (Object.entries(LINEA_SERVICIO_LABELS) as [LineaServicio, string][]).find(([, l]) => l === label);
    this.linea.set(entry?.[0] ?? null);
  }

  protected onOrigen(selected: string[]): void {
    const label = selected[0];
    const entry = (Object.entries(ORIGEN_LABELS) as ['as2' | 'portal', string][]).find(([, l]) => l === label);
    this.origen.set(entry?.[0] ?? null);
  }

  protected limpiar(): void {
    this.modalRef.close({ linea: null, estado: null, origen: null } satisfies PedidosFiltros);
  }

  protected aplicar(): void {
    this.modalRef.close({ linea: this.linea(), estado: this.estado(), origen: this.origen() } satisfies PedidosFiltros);
  }
}
