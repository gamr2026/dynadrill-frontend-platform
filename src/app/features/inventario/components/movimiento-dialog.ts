import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillTextareaComponent } from '@digitec-it-projects/dynadrill-ui';
import { Articulo, CreateMovimientoInput, MovimientoInventario, MovimientoTipo } from '../models/articulo.model';
import { MovimientosInventarioService } from '../services/movimientos-inventario.service';
import { AuthService } from '../../../core/services/auth.service';
import { toLocalDateString } from '../../../shared/utils';

export interface MovimientoDialogData {
  articulo: Articulo;
}

@Component({
  selector: 'app-movimiento-dialog',
  /** Bottom sheet en móvil (Overlay/BottomSheet en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillInputComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movimiento-dialog.html',
  styleUrl: './movimiento-dialog.scss',
})
export class MovimientoDialog {
  private readonly movimientosService = inject(MovimientosInventarioService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<MovimientoDialog, MovimientoInventario | undefined>);
  private readonly data = inject<MovimientoDialogData>(NZ_MODAL_DATA);

  protected readonly targetArticulo = this.data.articulo;

  protected readonly tipo = signal<MovimientoTipo>('entrada');
  protected readonly cantidad = signal('');
  protected readonly motivo = signal('');
  protected readonly responsable = signal(this.auth.currentUser()?.name ?? '');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly cantidadNum = computed(() => Number(this.cantidad()));

  protected readonly canSave = computed(() => {
    const n = this.cantidadNum();
    if (!Number.isFinite(n) || n <= 0) return false;
    if (this.tipo() === 'salida' && n > this.targetArticulo.stockActual) return false;
    return this.motivo().trim().length > 0 && this.responsable().trim().length > 0;
  });

  protected setTipo(tipo: MovimientoTipo): void {
    this.tipo.set(tipo);
    this.error.set(null);
  }

  protected save(): void {
    if (!this.canSave() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    const input: CreateMovimientoInput = {
      articuloId: this.targetArticulo.id,
      tipo: this.tipo(),
      cantidad: this.cantidadNum(),
      fecha: toLocalDateString(new Date()),
      motivo: this.motivo().trim(),
      responsable: this.responsable().trim(),
    };

    this.movimientosService.registrar(input).subscribe({
      next: movimiento => {
        this.notify.success('Movimiento registrado', `${this.tipo() === 'entrada' ? 'Entrada' : 'Salida'} de ${input.cantidad} ${this.targetArticulo.unidadStock}.`);
        this.modalRef.close(movimiento);
      },
      error: () => {
        this.submitting.set(false);
        this.error.set('No se pudo registrar el movimiento — verifica el stock disponible.');
      },
    });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
