import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { HttpErrorResponse } from '@angular/common/http';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  CLASES_OPERATIVAS,
  CLASE_OPERATIVA_DESCRIPCIONES,
  CLASE_OPERATIVA_LABELS,
  errorDelKit,
  type ClaseOperativa,
  type CodigoClienteFcr,
  type KitItem,
  type KitItemBorrador,
} from '../models/fcr-configuracion-codigos';
import { FcrConfiguracionCodigosService, type ConfiguracionCodigoGuardada } from '../services/fcr-configuracion-codigos.service';

export interface ConfigurarCodigoDialogData {
  clienteId: number;
  fila: CodigoClienteFcr;
  /** Catálogo activo de HERRAMIENTAS (value = articuloId) — lo carga la página una sola vez. */
  herramientas: DynadrillSelectOption[];
}

/**
 * Configura un código de la Lista de Precios de un cliente: su clase y, si es
 * herramienta, su kit. Guarda él mismo (así un error del backend se ve sin
 * perder lo cargado) y cierra con la fila guardada, o `undefined` si se cancela.
 */
@Component({
  selector: 'app-configurar-codigo-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillSelectComponent, DynadrillInputComponent, DynadrillButtonComponent, DynadrillIconButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './configurar-codigo-dialog.html',
  styleUrl: './configurar-codigo-dialog.scss',
})
export class ConfigurarCodigoDialog {
  private readonly data = inject<ConfigurarCodigoDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<ConfigurarCodigoDialog, ConfiguracionCodigoGuardada | undefined>);
  private readonly service = inject(FcrConfiguracionCodigosService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly fila = this.data.fila;
  /** Catálogo activo + los artículos del kit que ya no están (dados de baja), para que se vean y se reemplacen. */
  protected readonly herramientas: DynadrillSelectOption[] = [
    ...this.data.herramientas,
    ...this.fila.kit
      .filter(k => !this.data.herramientas.some(h => h.value === k.articuloId))
      .map(k => ({ label: `Artículo #${k.articuloId} (dado de baja — reemplácelo)`, value: k.articuloId })),
  ];
  protected readonly claseOptions: DynadrillSelectOption[] = CLASES_OPERATIVAS.map(c => ({ label: CLASE_OPERATIVA_LABELS[c], value: c }));

  protected readonly clase = signal<ClaseOperativa | null>(this.fila.clase);
  protected readonly kit = signal<KitItemBorrador[]>(this.fila.kit.map(k => ({ ...k })));
  protected readonly guardando = signal(false);
  /** Los errores del kit se muestran recién después del primer intento de guardar, no mientras se completa la fila. */
  private readonly intentoGuardar = signal(false);

  protected readonly esHerramienta = computed(() => this.clase() === 'herramienta');
  protected readonly descripcionClase = computed(() => {
    const c = this.clase();
    return c ? CLASE_OPERATIVA_DESCRIPCIONES[c] : '';
  });
  /** El kit guardado se pierde si la clase deja de ser herramienta — se avisa en vez de pedir confirmación. */
  protected readonly descartaKit = computed(() => !this.esHerramienta() && this.fila.kit.length > 0);
  private readonly errorKit = computed(() => (this.esHerramienta() ? errorDelKit(this.kit()) : null));
  protected readonly errorVisible = computed(() => (this.intentoGuardar() ? this.errorKit() : null));

  protected onClaseChange(value: unknown): void {
    this.clase.set(value as ClaseOperativa | null);
  }

  protected agregarFila(): void {
    this.kit.update(k => [...k, { articuloId: null, cantidad: 1 }]);
  }

  protected quitarFila(index: number): void {
    this.kit.update(k => k.filter((_, i) => i !== index));
  }

  protected onHerramientaChange(index: number, value: unknown): void {
    this.actualizarFila(index, { articuloId: (value as number | null) ?? null });
  }

  protected onCantidadChange(index: number, value: string): void {
    this.actualizarFila(index, { cantidad: Number(value) });
  }

  private actualizarFila(index: number, cambio: Partial<KitItemBorrador>): void {
    this.kit.update(k => k.map((fila, i) => (i === index ? { ...fila, ...cambio } : fila)));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    const clase = this.clase();
    this.intentoGuardar.set(true);
    if (!clase || this.errorKit()) return;

    this.guardando.set(true);
    this.service
      .guardar({
        clienteId: this.data.clienteId,
        codigo: this.fila.codigo,
        clase,
        kit: clase === 'herramienta' ? (this.kit() as KitItem[]) : undefined,
      })
      .subscribe({
        next: guardada => this.modalRef.close(guardada),
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.notify.error('No se pudo guardar', err.error?.message ?? 'Intente de nuevo.');
        },
      });
  }
}
