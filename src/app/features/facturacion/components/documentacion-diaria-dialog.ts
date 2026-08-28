import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { DocumentacionDiaria, DocumentacionItem, OtqItem } from '../models/facturacion.model';
import { DocumentacionDiariaService } from '../services/facturacion.service';

export interface DocumentacionDiariaDialogData {
  pedidoId: number;
  otqItems: OtqItem[];
}

interface ItemDraft {
  codigo: string;
  cantidad: number;
  tipo: 'Material' | 'Servicio';
}

/**
 * Cubre solo el registro de ítems ejecutados en el día (lo que alimenta la
 * Prefactura) — hojas de tiempo/uso de equipos/consumo de materiales
 * quedan en el modelo (`DocumentacionDiaria`) pero sin UI propia todavía
 * en esta primera fase; se agregan cuando el flujo de campo lo necesite.
 */
@Component({
  selector: 'app-documentacion-diaria-dialog',
  imports: [DynadrillDatetimePickerComponent, DynadrillSelectComponent, DynadrillInputComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documentacion-diaria-dialog.html',
  styleUrl: './documentacion-diaria-dialog.scss',
})
export class DocumentacionDiariaDialog {
  private readonly docService = inject(DocumentacionDiariaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<DocumentacionDiariaDialog, DocumentacionDiaria | undefined>);
  private readonly data = inject<DocumentacionDiariaDialogData>(NZ_MODAL_DATA);

  protected readonly codigoOptions: DynadrillSelectOption[] = this.data.otqItems.map(i => ({ label: `${i.codigo} — ${i.descripcion}`, value: i.codigo }));

  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly items = signal<ItemDraft[]>([]);
  protected readonly codigoDraft = signal<string | null>(null);
  protected readonly cantidadDraft = signal(0);
  protected readonly tipoDraft = signal<'Material' | 'Servicio'>('Servicio');
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(() => this.fecha() !== null && this.items().length > 0);

  protected agregarItem(): void {
    const codigo = this.codigoDraft();
    if (!codigo || this.cantidadDraft() <= 0) return;
    this.items.update(list => [...list, { codigo, cantidad: this.cantidadDraft(), tipo: this.tipoDraft() }]);
    this.codigoDraft.set(null);
    this.cantidadDraft.set(0);
  }

  protected quitarItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  protected descripcionDe(codigo: string): string {
    return this.data.otqItems.find(i => i.codigo === codigo)?.descripcion ?? codigo;
  }

  protected unidadDe(codigo: string): string {
    return this.data.otqItems.find(i => i.codigo === codigo)?.unidad ?? '';
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const items: DocumentacionItem[] = this.items().map(d => ({
      codigo: d.codigo,
      descripcion: this.descripcionDe(d.codigo),
      unidad: this.unidadDe(d.codigo),
      cantidad: d.cantidad,
      tipo: d.tipo,
    }));

    this.docService
      .create({
        pedidoId: this.data.pedidoId,
        fecha: this.fecha()!.toISOString().slice(0, 10),
        hojasTiempo: [],
        usoEquipos: [],
        consumoMateriales: [],
        items,
        registradoPor: this.auth.currentUser()?.name ?? '',
      })
      .subscribe({
        next: doc => {
          this.notify.success('Registrado', 'Documentación del día registrada — pendiente de homologación.');
          this.modalRef.close(doc);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo registrar la documentación.');
        },
      });
  }
}
