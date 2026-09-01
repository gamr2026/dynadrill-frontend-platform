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
import { UnidadesService } from '../../maintenance/services/unidades.service';
import { Unidad } from '../../maintenance/models/unidad.model';
import { GuiaCampo, GuiaCampoItem } from '../models/facturacion.model';
import { GuiaCampoService } from '../services/facturacion.service';

export interface GuiaCampoDialogData {
  pedidoId: number;
  cliente: string;
  campo: string;
  pozo: string;
}

interface ItemDraft {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  tipo: 'Material' | 'Servicio';
}

/** FACT-004 — evidencia de despacho en sitio (placas/pozo/firmas). No reemplaza la Guía de Remisión SRI de AS2: solo referencia su número cuando exista. */
@Component({
  selector: 'app-guia-campo-dialog',
  imports: [DynadrillDatetimePickerComponent, DynadrillSelectComponent, DynadrillInputComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guia-campo-dialog.html',
  styleUrl: './guia-campo-dialog.scss',
})
export class GuiaCampoDialog {
  private readonly guiaService = inject(GuiaCampoService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<GuiaCampoDialog, GuiaCampo | undefined>);
  protected readonly data = inject<GuiaCampoDialogData>(NZ_MODAL_DATA);

  protected readonly unidades = signal<Unidad[]>([]);
  protected readonly unidadOptions = computed<DynadrillSelectOption[]>(() => this.unidades().map(u => ({ label: `${u.code} — ${u.nombre}`, value: u.id })));
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly unidadId = signal<number | null>(null);
  protected readonly items = signal<ItemDraft[]>([]);
  protected readonly draft = signal<ItemDraft>({ codigo: '', descripcion: '', cantidad: 0, unidad: '', tipo: 'Material' });
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(() => this.fecha() !== null && this.unidadId() !== null && this.items().length > 0);

  protected readonly tipoOptions: DynadrillSelectOption[] = [
    { label: 'Material', value: 'Material' },
    { label: 'Servicio', value: 'Servicio' },
  ];

  constructor() {
    this.unidadesService.list().subscribe(unidades => this.unidades.set(unidades));
  }

  protected updateDraft<K extends keyof ItemDraft>(field: K, value: ItemDraft[K]): void {
    this.draft.update(d => ({ ...d, [field]: value }));
  }

  protected agregarItem(): void {
    const d = this.draft();
    if (!d.codigo.trim() || !d.descripcion.trim() || d.cantidad <= 0) return;
    this.items.update(list => [...list, d]);
    this.draft.set({ codigo: '', descripcion: '', cantidad: 0, unidad: '', tipo: 'Material' });
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

    const unidad = this.unidades().find(u => u.id === this.unidadId());
    const items: GuiaCampoItem[] = this.items().map(d => ({ codigo: d.codigo, descripcion: d.descripcion, cantidad: d.cantidad, unidad: d.unidad, tipo: d.tipo }));

    this.guiaService
      .create({
        pedidoId: this.data.pedidoId,
        cliente: this.data.cliente,
        campo: this.data.campo,
        pozo: this.data.pozo,
        fecha: this.fecha()!.toISOString().slice(0, 10),
        unidadId: this.unidadId()!,
        unidadCode: unidad?.code ?? '',
        items,
      })
      .subscribe({
        next: guia => {
          this.notify.success('Guía de campo registrada', 'Queda pendiente de firma (Company Man + Dynadrill).');
          this.modalRef.close(guia);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo registrar la guía de campo.');
        },
      });
  }
}
