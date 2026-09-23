import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { Pedido, itemsEstimadosDe } from '../models/pedido.model';
import { SolicitudDespachoItem, TipoItemDespacho } from '../models/solicitud-despacho-bodega.model';
import { PedidoService } from '../services/pedido.service';
import { AuthService } from '../../../core/services/auth.service';

export interface SolicitarDespachoDialogData {
  pedido: Pedido;
}

const TIPO_ITEM_OPTIONS: DynadrillSelectOption[] = [
  { value: 'material', label: 'Material' },
  { value: 'herramienta', label: 'Herramienta' },
];

/**
 * Facturación pide a Bodega el despacho de materiales/herramientas del
 * pedido — correlación con "Orden Salida Material" de AS2 (ver
 * `SolicitudDespachoBodega`). El pedido queda `por_despachar_bodega` hasta
 * que Bodega la resuelva desde su bandeja.
 */
@Component({
  selector: 'app-solicitar-despacho-dialog',
  imports: [
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitar-despacho-dialog.html',
  styleUrl: './solicitar-despacho-dialog.scss',
})
export class SolicitarDespachoDialog {
  private readonly pedidoService = inject(PedidoService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<SolicitarDespachoDialog, boolean | undefined>);
  protected readonly data = inject<SolicitarDespachoDialogData>(NZ_MODAL_DATA);

  protected readonly tipoItemOptions = TIPO_ITEM_OPTIONS;

  protected readonly bodegaOrigen = signal(this.data.pedido.bodega ?? '');
  protected readonly fechaRequerida = signal<Date | null>(new Date());
  protected readonly nota = signal('');

  /** Precargados de lo que Ventas estimó al abrir el pedido — Facturación los ajusta/amplía según lo que realmente se necesita despachar. */
  protected readonly items = signal<SolicitudDespachoItem[]>(
    itemsEstimadosDe(this.data.pedido).map(i => ({
      codigo: i.codigo,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad: i.unidad,
      tipo: (i.esHerramienta ? 'herramienta' : 'material') as TipoItemDespacho,
    })),
  );
  protected readonly draft = signal<SolicitudDespachoItem>({ codigo: '', descripcion: '', cantidad: 0, unidad: '', tipo: 'material' });
  protected readonly submitting = signal(false);

  protected readonly puedeEnviar = computed(
    () => this.bodegaOrigen().trim().length > 0 && !!this.fechaRequerida() && this.items().length > 0,
  );

  protected updateDraft<K extends keyof SolicitudDespachoItem>(field: K, value: SolicitudDespachoItem[K]): void {
    this.draft.update(d => ({ ...d, [field]: value }));
  }

  protected agregarItem(): void {
    const d = this.draft();
    if (!d.codigo.trim() || !d.descripcion.trim() || d.cantidad <= 0) return;
    this.items.update(list => [...list, d]);
    this.draft.set({ codigo: '', descripcion: '', cantidad: 0, unidad: '', tipo: 'material' });
  }

  protected quitarItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  protected solicitar(): void {
    if (!this.puedeEnviar() || this.submitting()) return;
    this.submitting.set(true);
    const usuario = this.auth.currentUser()?.name ?? 'Facturación';
    this.pedidoService
      .solicitarDespacho(this.data.pedido.id, usuario, {
        bodegaOrigen: this.bodegaOrigen().trim(),
        fechaRequerida: this.fechaRequerida()!.toISOString(),
        items: this.items(),
        nota: this.nota().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.notify.success('Solicitud enviada', `Se pidió a Bodega el despacho del pedido ${this.data.pedido.code}.`);
          this.modalRef.close(true);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo enviar la solicitud de despacho.');
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
