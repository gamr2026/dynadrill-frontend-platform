import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService } from '@digitec-it-projects/dynadrill-ui';
import { ArticuloParte, CreateArticuloParteInput } from '../models/articulo-parte.model';
import { ArticuloPartesService } from '../services/articulo-partes.service';

export interface ArticuloParteFormDialogData {
  articuloId: number;
  /** Presente = editar; ausente = crear. */
  parte?: ArticuloParte;
}

@Component({
  selector: 'app-articulo-parte-form-dialog',
  imports: [DynadrillInputComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articulo-parte-form-dialog.html',
  styleUrl: './articulo-parte-form-dialog.scss',
})
export class ArticuloParteFormDialog {
  private readonly partesService = inject(ArticuloPartesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ArticuloParteFormDialog, ArticuloParte | undefined>);
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
      Number.isFinite(this.cantidadEsperadaNum()) &&
      this.cantidadEsperadaNum() >= 0,
  );

  protected save(): void {
    if (!this.canSave() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateArticuloParteInput = {
      item: this.item().trim(),
      codigo: this.codigo().trim(),
      descripcion: this.descripcion().trim(),
      cantidadEsperada: this.cantidadEsperadaNum(),
    };

    const request$ = this.isEditMode
      ? this.partesService.update(this.articuloId, this.editingId!, input)
      : this.partesService.create(this.articuloId, input);

    request$.subscribe({
      next: parte => {
        this.notify.success(this.isEditMode ? 'Parte actualizada' : 'Parte creada', parte.descripcion);
        this.modalRef.close(parte);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar la parte.');
      },
    });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
