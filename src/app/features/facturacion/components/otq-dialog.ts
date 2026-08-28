import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService } from '@digitec-it-projects/dynadrill-ui';
import { Otq, OtqItem } from '../models/facturacion.model';
import { OtqService } from '../services/facturacion.service';

interface ItemDraft {
  codigo: string;
  descripcion: string;
  unidad: string;
  tarifaUnitaria: number;
  cantidadEstimada: number;
}

/**
 * FACT-001 — la cotización inicial de un Pedido. Sin catálogo real de AS2
 * todavía, los ítems se ingresan a mano (código/descripción/tarifa) — se
 * reemplaza por un selector contra el catálogo real cuando exista esa API.
 */
@Component({
  selector: 'app-otq-dialog',
  imports: [DecimalPipe, DynadrillInputComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otq-dialog.html',
  styleUrl: './otq-dialog.scss',
})
export class OtqDialog {
  private readonly otqService = inject(OtqService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<OtqDialog, Otq | undefined>);

  protected readonly pedidoId = signal(0);
  protected readonly numero = signal('');
  protected readonly cliente = signal('');
  protected readonly numeroContrato = signal('');
  protected readonly campo = signal('');
  protected readonly bloque = signal('');
  protected readonly pozo = signal('');
  protected readonly representanteLegal = signal('');

  protected readonly items = signal<ItemDraft[]>([]);
  protected readonly draft = signal<ItemDraft>({ codigo: '', descripcion: '', unidad: '', tarifaUnitaria: 0, cantidadEstimada: 0 });
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(
    () => this.pedidoId() > 0 && this.numero().trim().length > 0 && this.cliente().trim().length > 0 && this.items().length > 0,
  );

  protected updateDraft<K extends keyof ItemDraft>(field: K, value: ItemDraft[K]): void {
    this.draft.update(d => ({ ...d, [field]: value }));
  }

  protected agregarItem(): void {
    const d = this.draft();
    if (!d.codigo.trim() || !d.descripcion.trim() || d.cantidadEstimada <= 0) return;
    this.items.update(list => [...list, d]);
    this.draft.set({ codigo: '', descripcion: '', unidad: '', tarifaUnitaria: 0, cantidadEstimada: 0 });
  }

  protected quitarItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const items: OtqItem[] = this.items().map((d, idx) => ({
      id: idx + 1,
      codigo: d.codigo,
      descripcion: d.descripcion,
      unidad: d.unidad,
      tarifaUnitaria: d.tarifaUnitaria,
      cantidadEstimada: d.cantidadEstimada,
      total: Math.round(d.tarifaUnitaria * d.cantidadEstimada * 100) / 100,
    }));

    this.otqService
      .create({
        numero: this.numero().trim(),
        pedidoId: this.pedidoId(),
        cliente: this.cliente().trim(),
        numeroContrato: this.numeroContrato().trim(),
        campo: this.campo().trim(),
        bloque: this.bloque().trim(),
        pozo: this.pozo().trim(),
        representanteLegal: this.representanteLegal().trim() || undefined,
        items,
      })
      .subscribe({
        next: otq => {
          this.notify.success('OTQ creada', `${otq.numero} creada para el pedido.`);
          this.modalRef.close(otq);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo crear la OTQ.');
        },
      });
  }
}
