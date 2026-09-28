import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { CreateGuiaRemisionInput, GuiaRemision, GuiaRemisionItem } from '../models/guia-remision.model';
import { GuiaRemisionService } from '../services/pedido.service';

export interface GuiaRemisionDialogData {
  pedidoId: number;
  cliente: string;
  clienteRuc?: string;
  solicitadoPorSugerido: string;
}

interface ItemDraft {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  serie: string;
}

/**
 * FACT-002/004 — Guía de Remisión: **requisito previo** a generar la
 * prefactura cuando el servicio despacha material. Solo participa en
 * unidades (materiales), no en servicios.
 */
@Component({
  selector: 'app-guia-remision-dialog',
  imports: [DynadrillInputComponent, DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guia-remision-dialog.html',
  styleUrl: './guia-remision-dialog.scss',
  host: { 'data-bottom-sheet': '' },
})
export class GuiaRemisionDialog {
  private readonly guiaService = inject(GuiaRemisionService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<GuiaRemisionDialog, GuiaRemision | undefined>);
  protected readonly data = inject<GuiaRemisionDialogData>(NZ_MODAL_DATA);

  protected readonly solicitadoPor = signal(this.data.solicitadoPorSugerido);
  protected readonly despachadoPor = signal('');
  protected readonly lugarOrigen = signal('Coca Base Dynadrill');
  protected readonly horaSalida = signal('');
  protected readonly horaLlegada = signal('');

  protected readonly personaNombre = signal('');
  protected readonly personaCedula = signal('');
  protected readonly vehiculo = signal('');
  protected readonly placa = signal('');

  protected readonly items = signal<ItemDraft[]>([]);
  protected readonly draft = signal<ItemDraft>({ codigo: '', descripcion: '', unidad: '', cantidad: 0, serie: '' });
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(
    () => this.despachadoPor().trim().length > 0 && this.personaNombre().trim().length > 0 && this.placa().trim().length > 0 && this.items().length > 0,
  );

  protected updateDraft<K extends keyof ItemDraft>(field: K, value: ItemDraft[K]): void {
    this.draft.update(d => ({ ...d, [field]: value }));
  }

  protected agregarItem(): void {
    const d = this.draft();
    if (!d.codigo.trim() || !d.descripcion.trim() || d.cantidad <= 0) return;
    this.items.update(list => [...list, d]);
    this.draft.set({ codigo: '', descripcion: '', unidad: '', cantidad: 0, serie: '' });
  }

  protected quitarItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected generar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const items: GuiaRemisionItem[] = this.items().map(d => ({
      codigo: d.codigo,
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      unidad: d.unidad,
      serie: d.serie || undefined,
    }));

    const input: CreateGuiaRemisionInput = {
      fecha: new Date().toISOString().slice(0, 10),
      clienteRuc: this.data.clienteRuc,
      solicitadoPor: this.solicitadoPor().trim() || undefined,
      despachadoPor: this.despachadoPor().trim(),
      lugarOrigen: this.lugarOrigen().trim(),
      horaSalida: this.horaSalida().trim() || undefined,
      horaLlegada: this.horaLlegada().trim() || undefined,
      personaTransporte: { nombreORazonSocial: this.personaNombre().trim(), rucCedula: this.personaCedula().trim() },
      vehiculo: this.vehiculo().trim() || undefined,
      placa: this.placa().trim(),
      items,
    };

    this.guiaService.generar(this.data.pedidoId, input).subscribe({
      next: guia => {
        this.notify.success('Guía de remisión generada', `${guia.items.length} ítem(s) de material — ya puedes generar la prefactura.`);
        this.modalRef.close(guia);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo generar la guía de remisión.');
      },
    });
  }
}
