import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
  type DynadrillSelectValue,
} from '@digitec-it-projects/dynadrill-ui';
import {
  formatearCantidad,
  mensajeErrorInventario,
  MOVIMIENTO_TIPO_LABELS,
  type ArticuloInventarioDetalle,
  type BodegaInventario,
  type MotivoMovimiento,
  type MovimientoKardex,
} from '../models/inventario-plataforma.model';
import { InventarioPlataformaService } from '../services/inventario-plataforma.service';

export interface MovimientoDialogData {
  articulo: ArticuloInventarioDetalle;
}

/**
 * Movimiento manual de Bodega. El motivo elegido fija si es entrada o salida; el servidor calcula el saldo y rechaza una
 * salida que deje la bodega en negativo. Quien registra queda como responsable (sale de la sesión, no se escribe).
 */
@Component({
  selector: 'app-movimiento-dialog',
  /** Bottom sheet en móvil (Overlay/BottomSheet en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextareaComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movimiento-dialog.html',
  styleUrl: './movimiento-dialog.scss',
})
export class MovimientoDialog {
  private readonly inventario = inject(InventarioPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<MovimientoDialog, MovimientoKardex | undefined>);
  private readonly data = inject<MovimientoDialogData>(NZ_MODAL_DATA);

  protected readonly targetArticulo = this.data.articulo;
  protected readonly unidad = this.data.articulo.unidadStock.simbolo;

  protected readonly bodegas = signal<BodegaInventario[]>([]);
  protected readonly motivos = signal<MotivoMovimiento[]>([]);

  protected readonly bodegaId = signal<string | null>(null);
  protected readonly motivoId = signal<string | null>(null);
  protected readonly cantidad = signal('');
  protected readonly observacion = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly bodegaOptions = computed<DynadrillSelectOption[]>(() =>
    this.bodegas().map(b => ({ label: b.nombre, value: b.id })),
  );
  protected readonly motivoOptions = computed<DynadrillSelectOption[]>(() =>
    this.motivos().map(m => ({ label: m.nombre, value: m.id, group: MOVIMIENTO_TIPO_LABELS[m.tipo] })),
  );

  private readonly motivo = computed(() => this.motivos().find(m => m.id === this.motivoId()) ?? null);
  protected readonly cantidadNum = computed(() => Number(this.cantidad().replace(',', '.')));

  /** Existencia del artículo en la bodega elegida (la que el kardex dejó al último movimiento). */
  protected readonly stockEnBodega = computed(() => {
    const id = this.bodegaId();
    return id ? (this.targetArticulo.stockPorBodega.find(s => s.bodegaId === id)?.stock ?? 0) : null;
  });
  protected readonly stockTotalTexto = `${formatearCantidad(this.targetArticulo.stockActual)} ${this.unidad}`;
  protected readonly stockBodegaTexto = computed(() => {
    const s = this.stockEnBodega();
    return s === null ? null : `${formatearCantidad(s)} ${this.unidad}`;
  });

  protected readonly cantidadValida = computed(() => {
    const n = this.cantidadNum();
    return Number.isFinite(n) && n > 0 && Math.round(n * 1000) / 1000 === n;
  });
  protected readonly excedeStock = computed(() => {
    const stock = this.stockEnBodega();
    return this.motivo()?.tipo === 'salida' && stock !== null && this.cantidadValida() && this.cantidadNum() > stock;
  });
  protected readonly canSave = computed(
    () => !!this.bodegaId() && !!this.motivoId() && this.cantidadValida() && !this.excedeStock(),
  );

  constructor() {
    this.inventario.bodegas().subscribe({
      next: bodegas => {
        this.bodegas.set(bodegas);
        // con una sola bodega (o con existencias en una sola) no hay nada que elegir
        const conStock = this.targetArticulo.stockPorBodega.filter(s => s.stock > 0);
        if (bodegas.length === 1) this.bodegaId.set(bodegas[0].id);
        else if (conStock.length === 1) this.bodegaId.set(conStock[0].bodegaId);
      },
      error: () => this.error.set('No se pudieron cargar las bodegas.'),
    });
    this.inventario.motivos({ manual: true }).subscribe({
      next: motivos => this.motivos.set(motivos),
      error: () => this.error.set('No se pudieron cargar los motivos de movimiento.'),
    });
  }

  protected onBodega(value: DynadrillSelectValue): void {
    this.bodegaId.set(typeof value === 'string' && value ? value : null);
    this.error.set(null);
  }

  protected onMotivo(value: DynadrillSelectValue): void {
    this.motivoId.set(typeof value === 'string' && value ? value : null);
    this.error.set(null);
  }

  protected save(): void {
    if (!this.canSave() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    const cantidad = this.cantidadNum();
    const motivo = this.motivo();

    this.inventario
      .registrarMovimiento({
        articuloId: this.targetArticulo.id,
        bodegaId: this.bodegaId() as string,
        motivoId: this.motivoId() as string,
        cantidad,
        ...(this.observacion().trim() ? { observacion: this.observacion().trim() } : {}),
      })
      .subscribe({
        next: movimiento => {
          this.notify.success(
            'Movimiento registrado',
            `${motivo ? MOVIMIENTO_TIPO_LABELS[motivo.tipo] : 'Movimiento'} de ${formatearCantidad(cantidad)} ${this.unidad}.`,
          );
          this.modalRef.close(movimiento);
        },
        error: err => {
          this.submitting.set(false);
          this.error.set(mensajeErrorInventario(err, 'No se pudo registrar el movimiento.'));
        },
      });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
