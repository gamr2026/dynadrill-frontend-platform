import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { Articulo, CreateArticuloInput } from '../models/articulo.model';
import { ArticulosService } from '../services/articulos.service';

export interface ArticuloFormDialogData {
  /** Presente = editar; ausente = crear. */
  articulo?: Articulo;
}

@Component({
  selector: 'app-articulo-form-dialog',
  imports: [DynadrillInputComponent, DynadrillTextareaComponent, DynadrillCheckboxComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articulo-form-dialog.html',
  styleUrl: './articulo-form-dialog.scss',
})
export class ArticuloFormDialog {
  private readonly articulosService = inject(ArticulosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ArticuloFormDialog, Articulo | undefined>);
  private readonly data = inject<ArticuloFormDialogData>(NZ_MODAL_DATA);

  protected readonly isEditMode = !!this.data.articulo;
  private readonly editingId = this.data.articulo?.id;

  protected readonly codigo = signal(this.data.articulo?.codigo ?? '');
  protected readonly codigoAlterno = signal(this.data.articulo?.codigoAlterno ?? '');
  protected readonly codigoComercial = signal(this.data.articulo?.codigoComercial ?? '');
  protected readonly codigoBarras = signal(this.data.articulo?.codigoBarras ?? '');
  protected readonly nombre = signal(this.data.articulo?.nombre ?? '');
  protected readonly nombreComercial = signal(this.data.articulo?.nombreComercial ?? '');
  protected readonly categoria = signal(this.data.articulo?.categoria ?? '');
  protected readonly subcategoria = signal(this.data.articulo?.subcategoria ?? '');
  protected readonly unidadStock = signal(this.data.articulo?.unidadStock ?? '');
  protected readonly nota = signal(this.data.articulo?.nota ?? '');
  protected readonly informacionAdicional = signal(this.data.articulo?.informacionAdicional ?? '');
  protected readonly activo = signal(this.data.articulo?.activo ?? true);

  protected readonly submitting = signal(false);

  protected readonly canSave = computed(
    () =>
      this.codigo().trim().length > 0 &&
      this.nombre().trim().length > 0 &&
      this.categoria().trim().length > 0 &&
      this.subcategoria().trim().length > 0 &&
      this.unidadStock().trim().length > 0,
  );

  protected save(): void {
    if (!this.canSave() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateArticuloInput = {
      codigo: this.codigo().trim(),
      codigoAlterno: this.codigoAlterno().trim() || undefined,
      codigoComercial: this.codigoComercial().trim() || undefined,
      codigoBarras: this.codigoBarras().trim() || undefined,
      nombre: this.nombre().trim(),
      nombreComercial: this.nombreComercial().trim() || undefined,
      categoria: this.categoria().trim(),
      subcategoria: this.subcategoria().trim(),
      unidadStock: this.unidadStock().trim(),
      nota: this.nota().trim() || undefined,
      informacionAdicional: this.informacionAdicional().trim() || undefined,
      activo: this.activo(),
    };

    const request$ = this.isEditMode
      ? this.articulosService.update(this.editingId!, input)
      : this.articulosService.create(input);

    request$.subscribe({
      next: articulo => {
        this.notify.success(this.isEditMode ? 'Artículo actualizado' : 'Artículo creado', articulo.nombre);
        this.modalRef.close(articulo);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar el artículo.');
      },
    });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
