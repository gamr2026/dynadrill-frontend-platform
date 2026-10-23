import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
  type DynadrillSelectValue,
} from '@digitec-it-projects/dynadrill-ui';
import {
  formatearCantidad,
  mensajeErrorInventario,
  type BodegaInventario,
  type MinimoStock,
} from '../models/inventario-plataforma.model';
import { InventarioPlataformaService } from '../services/inventario-plataforma.service';

export interface MinimoStockDialogData {
  articuloId: string;
  /** Símbolo de la unidad en que se lleva el stock del artículo. */
  unidad: string;
  /** Los mínimos que el artículo ya tiene (uno por bodega). */
  minimos: MinimoStock[];
}

/**
 * Fija, cambia o quita el mínimo de stock de un artículo en una bodega. Cuando el saldo de esa bodega cruza el mínimo hacia abajo
 * el sistema registra el aviso de stock bajo (una sola vez por cruce). Cierra con `true` si algo cambió.
 */
@Component({
  selector: 'app-minimo-stock-dialog',
  /** Bottom sheet en móvil (Overlay/BottomSheet en Figma) — ver styles.scss. */
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillInputComponent, DynadrillSelectComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './movimiento-dialog.scss',
  template: `
    <div class="movimiento-dialog">
      <div class="movimiento-dialog__stock">
        Cuando el saldo de la bodega baje del mínimo se registra un aviso de stock bajo.
      </div>

      <dynadrill-select
        label="Bodega"
        placeholder="Seleccione la bodega"
        [options]="bodegaOptions()"
        [value]="bodegaId()"
        [searchable]="true"
        (valueChange)="onBodega($event)"
      />

      <dynadrill-input
        label="Mínimo"
        type="number"
        [placeholder]="data.unidad"
        [value]="minimo()"
        (valueChange)="minimo.set($event)"
      />

      @if (actual(); as a) {
        <p class="movimiento-dialog__stock">
          Mínimo actual en esta bodega: <strong>{{ texto(a.minimo) }}</strong> · Existencia:
          <strong>{{ texto(a.stock) }}</strong>
        </p>
      }

      @if (error()) {
        <p class="movimiento-dialog__error" role="alert">{{ error() }}</p>
      }

      <div class="movimiento-dialog__actions">
        <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
        @if (actual()) {
          <dynadrill-button variant="secondary" [disabled]="enviando()" (clicked)="quitar()"
            >Quitar el mínimo</dynadrill-button
          >
        }
        <dynadrill-button [disabled]="!puedeGuardar() || enviando()" (clicked)="guardar()">{{
          enviando() ? 'Guardando…' : 'Guardar el mínimo'
        }}</dynadrill-button>
      </div>
    </div>
  `,
})
export class MinimoStockDialog {
  private readonly inventario = inject(InventarioPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<MinimoStockDialog, boolean | undefined>);
  protected readonly data = inject<MinimoStockDialogData>(NZ_MODAL_DATA);

  protected readonly bodegas = signal<BodegaInventario[]>([]);
  protected readonly bodegaId = signal<string | null>(null);
  protected readonly minimo = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly bodegaOptions = computed<DynadrillSelectOption[]>(() =>
    this.bodegas().map((b) => ({ label: b.nombre, value: b.id })),
  );
  protected readonly actual = computed(
    () => this.data.minimos.find((m) => m.bodegaId === this.bodegaId()) ?? null,
  );
  private readonly minimoNum = computed(() => Number(this.minimo().replace(',', '.')));
  protected readonly puedeGuardar = computed(() => {
    const n = this.minimoNum();
    return !!this.bodegaId() && Number.isFinite(n) && n > 0 && Math.round(n * 1000) / 1000 === n;
  });

  constructor() {
    this.inventario.bodegas().subscribe({
      next: (bodegas) => {
        this.bodegas.set(bodegas);
        if (bodegas.length === 1) this.onBodega(bodegas[0].id);
      },
      error: () => this.error.set('No se pudieron cargar las bodegas.'),
    });
  }

  protected texto(n: number): string {
    return `${formatearCantidad(n)} ${this.data.unidad}`;
  }

  protected onBodega(value: DynadrillSelectValue): void {
    const id = typeof value === 'string' && value ? value : null;
    this.bodegaId.set(id);
    this.error.set(null);
    const m = this.data.minimos.find((x) => x.bodegaId === id);
    this.minimo.set(m ? String(m.minimo) : '');
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.inventario
      .fijarMinimo(this.data.articuloId, this.bodegaId() as string, this.minimoNum())
      .subscribe({
        next: () => {
          this.notify.success(
            'Mínimo guardado',
            `Mínimo de ${this.texto(this.minimoNum())} en la bodega.`,
          );
          this.modalRef.close(true);
        },
        error: (err) => {
          this.enviando.set(false);
          this.error.set(
            mensajeErrorInventario(err, 'No se pudo guardar el mínimo. Intente de nuevo.'),
          );
        },
      });
  }

  protected quitar(): void {
    if (!this.actual() || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    this.inventario.quitarMinimo(this.data.articuloId, this.bodegaId() as string).subscribe({
      next: () => {
        this.notify.success('Mínimo quitado', 'La bodega ya no tiene mínimo para este artículo.');
        this.modalRef.close(true);
      },
      error: (err) => {
        this.enviando.set(false);
        this.error.set(
          mensajeErrorInventario(err, 'No se pudo quitar el mínimo. Intente de nuevo.'),
        );
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
