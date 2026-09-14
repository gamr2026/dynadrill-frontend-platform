import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { ItemEstimado } from '../../../facturacion/models/pedido.model';

interface LineaDraft {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  valorUnitario: string;
  descuentoPorcentaje: string;
}

const LINEA_VACIA: LineaDraft = { codigo: '', descripcion: '', unidad: '', cantidad: '1', valorUnitario: '0', descuentoPorcentaje: '0' };

function aDraft(it: ItemEstimado): LineaDraft {
  return {
    codigo: it.codigo,
    descripcion: it.descripcion,
    unidad: it.unidad,
    cantidad: String(it.cantidad),
    valorUnitario: String(it.valorUnitario),
    descuentoPorcentaje: it.descuentoPorcentaje != null ? String(it.descuentoPorcentaje) : '0',
  };
}

export interface SolicitarCambioItemsDialogData {
  pedidoCode: string;
  cliente: string;
  itemsActuales: ItemEstimado[];
}

export interface SolicitarCambioItemsDialogResult {
  itemsPropuestos: ItemEstimado[];
  motivo: string;
}

/**
 * "El operador dispone todo el tiempo de una opción para visualizar y
 * solicitar la edición de los ítems del pedido ya definido por Ventas" — se
 * abre precargado con los ítems ACTUALES del pedido (Ventas), el Operador
 * los edita/agrega y explica el motivo; queda pendiente de aprobación del
 * Supervisor (ver aprobaciones-page.ts), que es quien de verdad actualiza el
 * pedido en Facturación.
 */
@Component({
  selector: 'app-solicitar-cambio-items-dialog',
  imports: [
    DecimalPipe,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
    DynadrillInputComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitar-cambio-items-dialog.html',
  styleUrl: './solicitar-cambio-items-dialog.scss',
})
export class SolicitarCambioItemsDialog {
  private readonly modalRef = inject(NzModalRef<SolicitarCambioItemsDialog, SolicitarCambioItemsDialogResult | undefined>);
  protected readonly data = inject<SolicitarCambioItemsDialogData>(NZ_MODAL_DATA);

  protected readonly lineas = signal<LineaDraft[]>(
    this.data.itemsActuales.length ? this.data.itemsActuales.map(aDraft) : [{ ...LINEA_VACIA }],
  );
  protected readonly motivo = signal('');

  protected readonly total = computed(() =>
    Math.round(this.lineas().reduce((s, l) => s + Number(l.cantidad) * Number(l.valorUnitario), 0) * 100) / 100,
  );

  private lineaValida(l: LineaDraft): boolean {
    return !!l.codigo.trim() && !!l.descripcion.trim() && Number(l.cantidad) > 0 && Number(l.valorUnitario) > 0;
  }

  protected readonly puedeEnviar = computed(
    () => this.motivo().trim().length > 0 && this.lineas().every(l => this.lineaValida(l)),
  );

  protected onCampoChange<K extends keyof LineaDraft>(index: number, campo: K, valor: LineaDraft[K]): void {
    this.lineas.update(ls => ls.map((l, i) => (i === index ? { ...l, [campo]: valor } : l)));
  }

  protected agregarLinea(): void {
    this.lineas.update(ls => [...ls, { ...LINEA_VACIA }]);
  }

  protected quitarLinea(index: number): void {
    this.lineas.update(ls => (ls.length > 1 ? ls.filter((_, i) => i !== index) : ls));
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) return;
    const itemsPropuestos: ItemEstimado[] = this.lineas().map(l => ({
      codigo: l.codigo.trim(),
      descripcion: l.descripcion.trim(),
      unidad: l.unidad.trim(),
      cantidad: Number(l.cantidad),
      valorUnitario: Number(l.valorUnitario),
      descuentoPorcentaje: Number(l.descuentoPorcentaje) || 0,
    }));
    this.modalRef.close({ itemsPropuestos, motivo: this.motivo().trim() });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
