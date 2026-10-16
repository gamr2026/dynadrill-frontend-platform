import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillSelectComponent, DynadrillTextComponent, DynadrillTextareaComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { MIN_MOTIVO_FORZADO, type EstadoCatalogo } from '../../models/pedido-comercial.model';

export interface ForzarEstadoDialogData {
  estados: EstadoCatalogo[];
  estadoActual: string;
}

export interface ForzarEstadoResultado {
  estado: string;
  motivo: string;
}

/** Salta el flujo (solo con `comercial.pedidos.forzar_estado`): el backend lo registra como "forzado" y exige motivo. */
@Component({
  selector: 'app-forzar-estado-dialog',
  imports: [DynadrillSelectComponent, DynadrillTextareaComponent, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="forzar">
      <dynadrill-text variant="body">Forzar un estado se salta el flujo y queda registrado en el historial como "Forzado". Úselo solo para corregir un error.</dynadrill-text>
      <dynadrill-select label="Nuevo estado" placeholder="Elija el estado" [options]="opciones()" [value]="estado()" [searchable]="true" (valueChange)="estado.set($any($event))" />
      <dynadrill-textarea label="Motivo (mínimo {{ minimo }} caracteres)" placeholder="Explique por qué se fuerza el estado…" [rows]="3" [value]="motivo()" (valueChange)="motivo.set($event)" />
    </div>
    <footer class="forzar__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button variant="warning" [disabled]="!valido()" (clicked)="confirmar()">Forzar estado</dynadrill-button>
    </footer>
  `,
  styles: `
    .forzar { display: flex; flex-direction: column; gap: 14px; }
    .forzar__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class ForzarEstadoDialog {
  private readonly modalRef = inject(NzModalRef<ForzarEstadoDialog, ForzarEstadoResultado | undefined>);
  private readonly data = inject<ForzarEstadoDialogData>(NZ_MODAL_DATA);

  protected readonly minimo = MIN_MOTIVO_FORZADO;
  protected readonly estado = signal<string | null>(null);
  protected readonly motivo = signal('');
  protected readonly opciones = computed<DynadrillSelectOption[]>(() =>
    this.data.estados.filter(e => e.codigo !== this.data.estadoActual).map(e => ({ label: e.nombre, value: e.codigo })),
  );
  protected readonly valido = computed(() => !!this.estado() && this.motivo().trim().length >= MIN_MOTIVO_FORZADO);

  protected confirmar(): void {
    const estado = this.estado();
    if (!estado || !this.valido()) return;
    this.modalRef.close({ estado, motivo: this.motivo().trim() });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
