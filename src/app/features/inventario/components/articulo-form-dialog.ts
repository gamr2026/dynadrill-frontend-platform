import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
  type DynadrillSelectValue,
} from '@digitec-it-projects/dynadrill-ui';
import {
  mensajeErrorInventario,
  type ArticuloInventario,
  type ArticuloInventarioDetalle,
  type CategoriaInventario,
  type UnidadStockInventario,
} from '../models/inventario-plataforma.model';
import { InventarioPlataformaService } from '../services/inventario-plataforma.service';

export interface ArticuloFormDialogData {
  /** Presente = editar; ausente = crear. */
  articulo?: ArticuloInventario;
}

/** Texto de un campo numérico opcional → número, o `null` si está vacío (así se quita el valor al editar). */
function numeroOpcional(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  return t === '' ? null : Number(t);
}

/** El valor de un select de un solo valor: el id elegido o `null`. */
function idElegido(value: DynadrillSelectValue): string | null {
  return typeof value === 'string' && value ? value : null;
}

@Component({
  selector: 'app-articulo-form-dialog',
  /** Pantalla completa en móvil (formulario largo) — ver styles.scss. */
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillCheckboxComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articulo-form-dialog.html',
  styleUrl: './articulo-form-dialog.scss',
})
export class ArticuloFormDialog {
  private readonly inventario = inject(InventarioPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ArticuloFormDialog, ArticuloInventarioDetalle | undefined>);
  private readonly data = inject<ArticuloFormDialogData>(NZ_MODAL_DATA);

  protected readonly isEditMode = !!this.data.articulo;
  private readonly editingId = this.data.articulo?.id;

  protected readonly categorias = signal<CategoriaInventario[]>([]);
  protected readonly unidades = signal<UnidadStockInventario[]>([]);

  protected readonly codigo = signal(this.data.articulo?.codigo ?? '');
  protected readonly codigoAlterno = signal(this.data.articulo?.codigos.alterno ?? '');
  protected readonly codigoComercial = signal(this.data.articulo?.codigos.comercial ?? '');
  protected readonly codigoBarras = signal(this.data.articulo?.codigos.barras ?? '');
  protected readonly nombre = signal(this.data.articulo?.nombre ?? '');
  protected readonly nombreComercial = signal(this.data.articulo?.nombreComercial ?? '');
  protected readonly categoriaId = signal<string | null>(this.data.articulo?.categoria.id ?? null);
  protected readonly subcategoriaId = signal<string | null>(this.data.articulo?.subcategoria?.id ?? null);
  protected readonly unidadStockId = signal<string | null>(this.data.articulo?.unidadStock.id ?? null);
  protected readonly costoUnitario = signal(String(this.data.articulo?.costoUnitario ?? ''));
  protected readonly descuentoSugerido = signal(String(this.data.articulo?.descuentoSugerido ?? ''));
  protected readonly nota = signal(this.data.articulo?.nota ?? '');
  protected readonly informacionAdicional = signal(this.data.articulo?.informacionAdicional ?? '');
  protected readonly activo = signal(this.data.articulo?.activo ?? true);

  protected readonly submitting = signal(false);

  protected readonly categoriaOptions = computed<DynadrillSelectOption[]>(() =>
    this.categorias()
      .filter(c => c.activo || c.id === this.categoriaId())
      .map(c => ({ label: c.nombre, value: c.id })),
  );
  protected readonly subcategoriaOptions = computed<DynadrillSelectOption[]>(() => {
    const categoria = this.categorias().find(c => c.id === this.categoriaId());
    return (categoria?.subcategorias ?? [])
      .filter(s => s.activo || s.id === this.subcategoriaId())
      .map(s => ({ label: s.nombre, value: s.id }));
  });
  protected readonly unidadOptions = computed<DynadrillSelectOption[]>(() =>
    this.unidades()
      .filter(u => u.activo || u.id === this.unidadStockId())
      .map(u => ({ label: `${u.nombre} (${u.simbolo})`, value: u.id })),
  );

  protected readonly canSave = computed(() => {
    const costo = numeroOpcional(this.costoUnitario());
    const descuento = numeroOpcional(this.descuentoSugerido());
    return (
      this.codigo().trim().length > 0 &&
      !/\s/.test(this.codigo().trim()) &&
      this.nombre().trim().length > 0 &&
      !!this.categoriaId() &&
      !!this.unidadStockId() &&
      (costo === null || (Number.isFinite(costo) && costo >= 0)) &&
      (descuento === null || (Number.isFinite(descuento) && descuento >= 0 && descuento <= 100))
    );
  });

  constructor() {
    this.inventario.categorias().subscribe({
      next: categorias => this.categorias.set(categorias),
      error: () => this.notify.error('Error', 'No se pudieron cargar las categorías.'),
    });
    this.inventario.unidades().subscribe({
      next: unidades => this.unidades.set(unidades),
      error: () => this.notify.error('Error', 'No se pudieron cargar las unidades de stock.'),
    });
  }

  protected onCategoria(value: DynadrillSelectValue): void {
    const id = idElegido(value);
    if (id === this.categoriaId()) return;
    this.categoriaId.set(id);
    // la subcategoría pertenece a una categoría: al cambiarla deja de valer
    this.subcategoriaId.set(null);
  }

  protected onSubcategoria(value: DynadrillSelectValue): void {
    this.subcategoriaId.set(idElegido(value));
  }

  protected onUnidad(value: DynadrillSelectValue): void {
    this.unidadStockId.set(idElegido(value));
  }

  protected save(): void {
    if (!this.canSave() || this.submitting()) return;
    this.submitting.set(true);

    const costoUnitario = numeroOpcional(this.costoUnitario());
    const descuentoSugerido = numeroOpcional(this.descuentoSugerido());
    const comunes = {
      nombre: this.nombre().trim(),
      nombreComercial: this.nombreComercial().trim(),
      categoriaId: this.categoriaId() as string,
      unidadStockId: this.unidadStockId() as string,
      nota: this.nota().trim(),
      informacionAdicional: this.informacionAdicional().trim(),
      activo: this.activo(),
      // cadena vacía quita el código
      codigos: {
        alterno: this.codigoAlterno().trim(),
        comercial: this.codigoComercial().trim(),
        barras: this.codigoBarras().trim(),
      },
    };

    const request$ = this.isEditMode
      ? this.inventario.actualizarArticulo(this.editingId!, {
          ...comunes,
          subcategoriaId: this.subcategoriaId(),
          costoUnitario,
          descuentoSugerido,
        })
      : this.inventario.crearArticulo({
          codigo: this.codigo().trim(),
          ...comunes,
          ...(this.subcategoriaId() ? { subcategoriaId: this.subcategoriaId() as string } : {}),
          ...(costoUnitario !== null ? { costoUnitario } : {}),
          ...(descuentoSugerido !== null ? { descuentoSugerido } : {}),
        });

    request$.subscribe({
      next: articulo => {
        this.notify.success(this.isEditMode ? 'Artículo actualizado' : 'Artículo creado', articulo.nombre);
        this.modalRef.close(articulo);
      },
      error: err => {
        this.submitting.set(false);
        this.notify.error('Error', mensajeErrorInventario(err, 'No se pudo guardar el artículo.'));
      },
    });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
