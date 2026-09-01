import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillTextareaComponent } from '@digitec-it-projects/dynadrill-ui';
import { Excepcion, OtqItem, OtqItemDraft } from '../models/facturacion.model';
import { ExcepcionService, OtqService } from '../services/facturacion.service';

export interface CambioAlcanceDialogData {
  pedidoId: number;
  otqId: number;
  items: OtqItem[];
}

interface ItemDraft {
  codigo: string;
  descripcion: string;
  unidad: string;
  tarifaUnitaria: number;
  cantidadEstimada: number;
}

/**
 * FACT-003, Escenario B — cambio de alcance solicitado por el cliente:
 * agregar, quitar o modificar ítems de la OTQ. Aplica el cambio de una vez
 * (no hay estado "pendiente" de aprobación intermedio en esta fase) y deja
 * el registro como Excepción para trazabilidad y para que el cliente
 * confirme el nuevo presupuesto.
 */
@Component({
  selector: 'app-cambio-alcance-dialog',
  imports: [DecimalPipe, DynadrillInputComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cambio-alcance-dialog.html',
  styleUrl: './cambio-alcance-dialog.scss',
})
export class CambioAlcanceDialog {
  private readonly otqService = inject(OtqService);
  private readonly excepcionService = inject(ExcepcionService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<CambioAlcanceDialog, Excepcion | undefined>);
  protected readonly data = inject<CambioAlcanceDialogData>(NZ_MODAL_DATA);

  protected readonly itemsOriginales = this.data.items;
  protected readonly items = signal<OtqItem[]>(this.data.items.map(i => ({ ...i })));
  protected readonly nuevos = signal<ItemDraft[]>([]);
  protected readonly draft = signal<ItemDraft>({ codigo: '', descripcion: '', unidad: '', tarifaUnitaria: 0, cantidadEstimada: 0 });
  protected readonly justificacion = signal('');
  protected readonly submitting = signal(false);

  protected readonly totalOriginal = this.itemsOriginales.reduce((sum, i) => sum + i.total, 0);

  protected readonly totalNuevo = computed(() => {
    const editados = this.items().reduce((sum, i) => sum + i.tarifaUnitaria * i.cantidadEstimada, 0);
    const agregados = this.nuevos().reduce((sum, d) => sum + d.tarifaUnitaria * d.cantidadEstimada, 0);
    return Math.round((editados + agregados) * 100) / 100;
  });

  protected readonly delta = computed(() => Math.round((this.totalNuevo() - this.totalOriginal) * 100) / 100);

  protected readonly hayCambios = computed(
    () => this.items().length !== this.itemsOriginales.length || this.nuevos().length > 0 || this.items().some((it, idx) => it.cantidadEstimada !== this.itemsOriginales[idx]?.cantidadEstimada),
  );

  protected readonly puedeGuardar = computed(() => this.hayCambios() && this.justificacion().trim().length > 0);

  protected setCantidad(itemId: number, cantidad: number): void {
    this.items.update(list => list.map(i => (i.id === itemId ? { ...i, cantidadEstimada: cantidad, total: Math.round(i.tarifaUnitaria * cantidad * 100) / 100 } : i)));
  }

  protected quitarExistente(itemId: number): void {
    this.items.update(list => list.filter(i => i.id !== itemId));
  }

  protected updateDraft<K extends keyof ItemDraft>(field: K, value: ItemDraft[K]): void {
    this.draft.update(d => ({ ...d, [field]: value }));
  }

  protected agregarItem(): void {
    const d = this.draft();
    if (!d.codigo.trim() || !d.descripcion.trim() || d.cantidadEstimada <= 0) return;
    this.nuevos.update(list => [...list, d]);
    this.draft.set({ codigo: '', descripcion: '', unidad: '', tarifaUnitaria: 0, cantidadEstimada: 0 });
  }

  protected quitarNuevo(index: number): void {
    this.nuevos.update(list => list.filter((_, i) => i !== index));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  private resumenCambio(): string {
    const partes: string[] = [];
    const removidos = this.itemsOriginales.filter(orig => !this.items().some(i => i.id === orig.id));
    for (const r of removidos) partes.push(`Quitado: ${r.codigo} — ${r.descripcion}`);
    for (const it of this.items()) {
      const orig = this.itemsOriginales.find(o => o.id === it.id);
      if (orig && orig.cantidadEstimada !== it.cantidadEstimada) partes.push(`Modificado: ${it.codigo} — cantidad ${orig.cantidadEstimada} → ${it.cantidadEstimada} ${it.unidad}`);
    }
    for (const n of this.nuevos()) partes.push(`Agregado: ${n.codigo} — ${n.descripcion} (${n.cantidadEstimada} ${n.unidad})`);
    return partes.join('; ');
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const itemsFinales: OtqItemDraft[] = [
      ...this.items().map(i => ({ codigo: i.codigo, descripcion: i.descripcion, unidad: i.unidad, tarifaUnitaria: i.tarifaUnitaria, cantidadEstimada: i.cantidadEstimada })),
      ...this.nuevos().map(n => ({ codigo: n.codigo, descripcion: n.descripcion, unidad: n.unidad, tarifaUnitaria: n.tarifaUnitaria, cantidadEstimada: n.cantidadEstimada })),
    ];

    forkJoin({
      otq: this.otqService.actualizarItems(this.data.otqId, itemsFinales),
      excepcion: this.excepcionService.create({
        pedidoId: this.data.pedidoId,
        tipo: 'cambio_alcance',
        montoExcedente: this.delta(),
        descripcionCambio: this.resumenCambio(),
        justificacion: this.justificacion().trim(),
      }),
    }).subscribe({
      next: ({ excepcion }) => {
        this.notify.success('Cambio de alcance aplicado', 'La OTQ se actualizó y queda pendiente de aprobación del cliente sobre el nuevo presupuesto.');
        this.modalRef.close(excepcion);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo aplicar el cambio de alcance.');
      },
    });
  }
}
