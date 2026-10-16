import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService } from '@digitec-it-projects/dynadrill-ui';
import { mensajeErrorInventario, type ParteArticulo } from '../models/inventario-plataforma.model';
import { InventarioPlataformaService } from '../services/inventario-plataforma.service';

export interface ArticuloParteFormDialogData {
  articuloId: string;
  /** Presente = editar; ausente = crear. */
  parte?: ParteArticulo;
}

@Component({
  selector: 'app-articulo-parte-form-dialog',
  imports: [DynadrillInputComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articulo-parte-form-dialog.html',
  styleUrl: './articulo-parte-form-dialog.scss',
})
export class ArticuloParteFormDialog {
  private readonly inventario = inject(InventarioPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ArticuloParteFormDialog, ParteArticulo | undefined>);
  private readonly data = inject<ArticuloParteFormDialogData>(NZ_MODAL_DATA);

  protected readonly isEditMode = !!this.data.parte;
  private readonly articuloId = this.data.articuloId;
  private readonly editingId = this.data.parte?.id;

  protected readonly item = signal(this.data.parte?.item ?? '');
  protected readonly codigo = signal(this.data.parte?.codigo ?? '');
  protected readonly descripcion = signal(this.data.parte?.descripcion ?? '');
  protected readonly cantidadEsperada = signal(String(this.data.parte?.cantidadEsperada ?? 1));

  protected readonly submitting = signal(false);

  private readonly cantidadEsperadaNum = computed(() => Number(this.cantidadEsperada()));

  protected readonly canSave = computed(
    () =>
      this.item().trim().length > 0 &&
      this.codigo().trim().length > 0 &&
      this.descripcion().trim().length > 0 &&
      Number.isInteger(this.cantidadEsperadaNum()) &&
      this.cantidadEsperadaNum() >= 1,
  );

  protected save(): void {
    if (!this.canSave() || this.submitting()) return;
    this.submitting.set(true);

    const input = {
      item: this.item().trim(),
      codigo: this.codigo().trim(),
      descripcion: this.descripcion().trim(),
      cantidadEsperada: this.cantidadEsperadaNum(),
    };

    const request$ = this.isEditMode
      ? this.inventario.actualizarParte(this.editingId!, input)
      : this.inventario.crearParte(this.articuloId, input);

    request$.subscribe({
      next: parte => {
        this.notify.success(this.isEditMode ? 'Parte actualizada' : 'Parte creada', parte.descripcion);
        this.modalRef.close(parte);
      },
      error: err => {
        this.submitting.set(false);
        this.notify.error('Error', mensajeErrorInventario(err, 'No se pudo guardar la parte.'));
      },
    });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
