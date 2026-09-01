import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  DynadrillUploadZoneComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { Unidad } from '../../maintenance/models/unidad.model';
import { UnidadesService } from '../../maintenance/services/unidades.service';
import { ConsumoMaterialEntry, DocumentacionDiaria, DocumentacionItem, HojaTiempoEntry, OtqItem, UsoEquipoEntry } from '../models/facturacion.model';
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

interface EquipoDraft {
  horometroInicial: number;
  horometroFinal: number;
  combustibleConsumido?: number;
  operador: string;
}

/** FACT-002 — registro diario: ítems que alimentan la Prefactura (código/cantidad/tipo, validados contra la OTQ) más los respaldos operativos del día (hojas de tiempo, uso de equipos, consumo de materiales). */
@Component({
  selector: 'app-documentacion-diaria-dialog',
  imports: [
    DynadrillDatetimePickerComponent,
    DynadrillSelectComponent,
    DynadrillInputComponent,
    DynadrillButtonComponent,
    DynadrillTextComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documentacion-diaria-dialog.html',
  styleUrl: './documentacion-diaria-dialog.scss',
})
export class DocumentacionDiariaDialog {
  private readonly docService = inject(DocumentacionDiariaService);
  private readonly unidadesService = inject(UnidadesService);
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

  // ── FACT-002 — respaldos operativos del día ──
  protected readonly unidades = signal<Unidad[]>([]);
  protected readonly unidadOptions = computed<DynadrillSelectOption[]>(() => this.unidades().map(u => ({ label: `${u.code} — ${u.nombre}`, value: u.id })));

  protected readonly hojasTiempo = signal<HojaTiempoEntry[]>([]);
  protected readonly hojaDraft = signal<HojaTiempoEntry>({ nombre: '', cargo: '', horasNormales: 0, horasExtras: 0, horasNocturnas: 0 });

  protected readonly usoEquipos = signal<UsoEquipoEntry[]>([]);
  protected readonly equipoUnidadId = signal<number | null>(null);
  protected readonly equipoDraft = signal<EquipoDraft>({ horometroInicial: 0, horometroFinal: 0, operador: '' });

  protected readonly consumoMateriales = signal<ConsumoMaterialEntry[]>([]);
  protected readonly materialDraft = signal<ConsumoMaterialEntry>({ codigo: '', descripcion: '', cantidad: 0, unidad: '' });

  /** FACT-002 — "mínimo 3 fotos por trabajo principal". Solo se guarda el nombre de archivo (simulado, sin almacenamiento real). */
  protected readonly fotos = signal<string[]>([]);

  protected onFotoSeleccionada(file: NzUploadFile): void {
    this.fotos.update(list => [...list, file.name]);
  }

  protected quitarFoto(index: number): void {
    this.fotos.update(list => list.filter((_, i) => i !== index));
  }

  protected readonly puedeGuardar = computed(() => this.fecha() !== null && this.items().length > 0);

  constructor() {
    this.unidadesService.list().subscribe(unidades => this.unidades.set(unidades));
  }

  protected updateHojaDraft<K extends keyof HojaTiempoEntry>(field: K, value: HojaTiempoEntry[K]): void {
    this.hojaDraft.update(d => ({ ...d, [field]: value }));
  }

  protected agregarHoja(): void {
    const h = this.hojaDraft();
    if (!h.nombre.trim() || !h.cargo.trim()) return;
    this.hojasTiempo.update(list => [...list, h]);
    this.hojaDraft.set({ nombre: '', cargo: '', horasNormales: 0, horasExtras: 0, horasNocturnas: 0 });
  }

  protected quitarHoja(index: number): void {
    this.hojasTiempo.update(list => list.filter((_, i) => i !== index));
  }

  protected updateEquipoDraft<K extends keyof EquipoDraft>(field: K, value: EquipoDraft[K]): void {
    this.equipoDraft.update(d => ({ ...d, [field]: value }));
  }

  protected agregarEquipo(): void {
    const unidadId = this.equipoUnidadId();
    const unidad = this.unidades().find(u => u.id === unidadId);
    const d = this.equipoDraft();
    if (!unidad || d.horometroFinal < d.horometroInicial || !d.operador.trim()) return;
    this.usoEquipos.update(list => [...list, { unidadId: unidad.id, unidadCode: unidad.code, ...d }]);
    this.equipoUnidadId.set(null);
    this.equipoDraft.set({ horometroInicial: 0, horometroFinal: 0, operador: '' });
  }

  protected quitarEquipo(index: number): void {
    this.usoEquipos.update(list => list.filter((_, i) => i !== index));
  }

  protected updateMaterialDraft<K extends keyof ConsumoMaterialEntry>(field: K, value: ConsumoMaterialEntry[K]): void {
    this.materialDraft.update(d => ({ ...d, [field]: value }));
  }

  protected agregarMaterial(): void {
    const m = this.materialDraft();
    if (!m.codigo.trim() || !m.descripcion.trim() || m.cantidad <= 0) return;
    this.consumoMateriales.update(list => [...list, m]);
    this.materialDraft.set({ codigo: '', descripcion: '', cantidad: 0, unidad: '' });
  }

  protected quitarMaterial(index: number): void {
    this.consumoMateriales.update(list => list.filter((_, i) => i !== index));
  }

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
        hojasTiempo: this.hojasTiempo(),
        usoEquipos: this.usoEquipos(),
        consumoMateriales: this.consumoMateriales(),
        items,
        fotos: this.fotos().length ? this.fotos() : undefined,
        registradoPor: this.auth.currentUser()?.name ?? '',
      })
      .subscribe({
        next: doc => {
          this.notify.success('Registrado', 'Documentación del día registrada — pendiente de revisión y firma del supervisor.');
          this.modalRef.close(doc);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo registrar la documentación.');
        },
      });
  }
}
