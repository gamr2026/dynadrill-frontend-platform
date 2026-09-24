import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { CreateEntregaEpiInput, EntregaEpi, EpiItem } from '../models/entrega-epi.model';
import { EntregaEpiService } from '../services/entrega-epi.service';

export interface EntregaEpiDialogData {
  /** Ticket de Pumping/FCR desde el que se abre la solicitud — ver ticket-detail-page. */
  pumpingTicketId?: number;
  trabajadorNombre?: string;
  trabajadorCargo?: string;
}

interface ItemDraft {
  elemento: string;
  cantidad: string;
  talla: string;
  codigoOCedula: string;
  recibioCapacitacion: boolean;
  observaciones: string;
}

const ITEM_DRAFT_VACIO: ItemDraft = { elemento: '', cantidad: '1', talla: '', codigoOCedula: '', recibioCapacitacion: false, observaciones: '' };

/**
 * DYN-SGI-RE-032 — la declaración de responsabilidad del trabajador
 * ("Firmo y acepto ser responsable por los elementos de protección
 * individual...") se captura acá mismo, en el momento de la entrega —
 * es la sesión donde el trabajador está físicamente presente. El "Recibe
 * conforme Talento Humano" que cierra el expediente es un evento aparte,
 * posterior, y se firma desde la bandeja (epi-list-page).
 */
@Component({
  selector: 'app-entrega-epi-dialog',
  imports: [DynadrillTextComponent, DynadrillInputComponent, DynadrillCheckboxComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entrega-epi-dialog.html',
  styleUrl: './entrega-epi-dialog.scss',
})
export class EntregaEpiDialog {
  private readonly epiService = inject(EntregaEpiService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<EntregaEpiDialog, EntregaEpi | undefined>);
  private readonly data = inject<EntregaEpiDialogData | null>(NZ_MODAL_DATA, { optional: true });

  protected readonly lugar = signal('');
  protected readonly trabajadorNombre = signal(this.data?.trabajadorNombre ?? '');
  protected readonly trabajadorCargo = signal(this.data?.trabajadorCargo ?? '');

  protected readonly items = signal<EpiItem[]>([]);
  // Contador monotónico: `items().length + 1` reasigna un id ya usado en cuanto se
  // quita un ítem del medio y se agrega uno nuevo, lo que hace que quitarItem()
  // borre el ítem equivocado (dos ítems terminan con el mismo id).
  private nextItemId = 1;
  protected readonly itemDraft = signal<ItemDraft>({ ...ITEM_DRAFT_VACIO });

  protected readonly firmaAceptada = signal(false);
  protected readonly submitting = signal(false);

  protected setItemDraftField<K extends keyof ItemDraft>(field: K, value: ItemDraft[K]): void {
    this.itemDraft.update(d => ({ ...d, [field]: value }));
  }

  protected readonly puedeAgregarItem = computed(() => this.itemDraft().elemento.trim().length > 0 && Number(this.itemDraft().cantidad) > 0);

  protected agregarItem(): void {
    if (!this.puedeAgregarItem()) return;
    const d = this.itemDraft();
    const item: EpiItem = {
      id: this.nextItemId++,
      elemento: d.elemento.trim(),
      cantidad: Number(d.cantidad),
      talla: d.talla.trim() || undefined,
      codigoOCedula: d.codigoOCedula.trim() || undefined,
      recibioCapacitacion: d.recibioCapacitacion,
      observaciones: d.observaciones.trim() || undefined,
      entregadoAt: new Date().toISOString(),
    };
    this.items.update(list => [...list, item]);
    this.itemDraft.set({ ...ITEM_DRAFT_VACIO });
  }

  protected quitarItem(id: number): void {
    this.items.update(list => list.filter(i => i.id !== id));
  }

  protected readonly puedeGuardar = computed(
    () =>
      this.lugar().trim().length > 0 &&
      this.trabajadorNombre().trim().length > 0 &&
      this.trabajadorCargo().trim().length > 0 &&
      this.items().length > 0 &&
      this.firmaAceptada(),
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateEntregaEpiInput = {
      lugar: this.lugar().trim(),
      trabajadorNombre: this.trabajadorNombre().trim(),
      trabajadorCargo: this.trabajadorCargo().trim(),
      items: this.items(),
      ...(this.data?.pumpingTicketId ? { pumpingTicketId: this.data.pumpingTicketId } : {}),
    };

    this.epiService.create(input).subscribe({
      next: created => {
        // La declaración se firma en el mismo instante — ver comentario de la clase.
        this.epiService.update(created.id, { firmaTrabajador: { nombre: this.trabajadorNombre().trim(), firmadoAt: new Date().toISOString() } }).subscribe({
          next: updated => {
            this.notify.success('Registrado', `Entrega de EPI ${updated.code} registrada.`);
            this.modalRef.close(updated);
          },
          error: () => {
            this.submitting.set(false);
            this.notify.error('Error', 'Se registró la entrega, pero no se pudo guardar la firma del trabajador.');
          },
        });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar la entrega de EPI.');
      },
    });
  }
}
