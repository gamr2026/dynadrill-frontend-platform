import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { GuiasComercialService } from '../../services/guias-comercial.service';
import { CatalogosPlataformaService } from '../../services/catalogos-plataforma.service';
import { mensajeErrorGuia, type SolicitarDespachoRequest } from '../../models/guia-comercial';
import type { ItemPedido } from '../../models/pedido-comercial.model';

export interface SolicitarDespachoDialogData {
  pedidoId: string;
  pedidoCodigo: string;
  items: ItemPedido[];
}

const hoy = (): string => {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

/** Lo que Bodega puede despachar: materiales y herramientas; los servicios y la movilización no salen de bodega. */
export const esDespachable = (i: Pick<ItemPedido, 'tipoLinea'>): boolean =>
  i.tipoLinea === 'material' || i.tipoLinea === 'herramienta';

/**
 * Facturación pide a Bodega el despacho de un pedido con la prefactura generada: desde qué bodega, para cuándo, qué ítems (y cuánto de cada
 * uno, sin pasar de lo pedido) y una nota. Bodega lo resuelve desde su bandeja de Inventario; el pedido queda «por despachar» hasta entonces.
 */
@Component({
  selector: 'app-solicitar-despacho-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextareaComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sd">
      <dynadrill-text variant="caption">Pedido {{ data.pedidoCodigo }}</dynadrill-text>

      <dynadrill-select
        label="Bodega de origen"
        placeholder="Seleccione la bodega"
        [options]="bodegas()"
        [value]="bodegaId()"
        [searchable]="true"
        (valueChange)="bodegaId.set($any($event))"
      />
      <label class="sd__fecha">
        <span>Fecha requerida</span>
        <input type="date" [min]="minimo" [value]="fecha()" (input)="fecha.set($any($event.target).value)" />
      </label>
      <dynadrill-textarea label="Nota para Bodega (opcional)" [rows]="2" [value]="nota()" (valueChange)="nota.set($event)" />

      <dynadrill-text variant="caption" class="sd__titulo">Ítems a despachar</dynadrill-text>
      @if (despachables().length === 0) {
        <p class="sd__vacio">El pedido no tiene materiales ni herramientas para despachar.</p>
      } @else {
        <table class="sd__items">
          <thead><tr><th></th><th>Código</th><th>Descripción</th><th>Pedido</th><th>Cantidad a despachar</th></tr></thead>
          <tbody>
            @for (i of despachables(); track i.id) {
              <tr>
                <td>
                  <input type="checkbox" [attr.aria-label]="'Despachar ' + i.codigo" [checked]="elegido(i)" (change)="alternar(i)" />
                </td>
                <td>{{ i.codigo }}</td>
                <td>{{ i.descripcion }}</td>
                <td>{{ i.cantidad }} {{ i.unidad }}</td>
                <td>
                  <dynadrill-input
                    type="number"
                    [disabled]="!elegido(i)"
                    [value]="cantidadDe(i)"
                    (valueChange)="cambiarCantidad(i, $event)"
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      }

      @if (problema(); as p) {
        <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
      }
      @if (error(); as e) {
        <dynadrill-text variant="caption" role="alert">{{ e }}</dynadrill-text>
      }

      <footer class="sd__acciones">
        <dynadrill-button variant="secondary" (clicked)="cerrar()">Cancelar</dynadrill-button>
        <dynadrill-button [disabled]="!!problema() || enviando()" (clicked)="enviar()">
          {{ enviando() ? 'Enviando…' : 'Solicitar despacho' }}
        </dynadrill-button>
      </footer>
    </div>
  `,
  styles: [
    `
      .sd { display: grid; gap: 12px; }
      .sd__fecha { display: grid; gap: 4px; font-size: 0.875rem; }
      .sd__fecha input { padding: 8px; border: 1px solid var(--dynadrill-border, #c9ced6); border-radius: 6px; }
      .sd__titulo { margin-top: 4px; }
      .sd__vacio { margin: 0; color: var(--dynadrill-text-secondary, #5b6573); }
      .sd__items { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      .sd__items th, .sd__items td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--dynadrill-border, #e3e6ea); vertical-align: middle; }
      .sd__acciones { display: flex; justify-content: flex-end; gap: 8px; }
    `,
  ],
})
export class SolicitarDespachoDialog {
  private readonly servicio = inject(GuiasComercialService);
  private readonly catalogos = inject(CatalogosPlataformaService);
  private readonly modalRef = inject(NzModalRef<SolicitarDespachoDialog, boolean | undefined>);
  protected readonly data = inject<SolicitarDespachoDialogData>(NZ_MODAL_DATA);

  protected readonly minimo = hoy();
  protected readonly bodegas = signal<DynadrillSelectOption[]>([]);
  protected readonly bodegaId = signal<string | null>(null);
  protected readonly fecha = signal(hoy());
  protected readonly nota = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Ítem del pedido → cantidad a despachar (solo los elegidos). */
  protected readonly elegidos = signal<Record<string, string>>({});

  protected readonly despachables = computed(() => this.data.items.filter(esDespachable));

  protected readonly problema = computed<string | null>(() => {
    if (!this.bodegaId()) return 'Elija la bodega de origen.';
    if (!this.fecha() || this.fecha() < this.minimo) return 'La fecha requerida es hoy o posterior.';
    const ids = Object.keys(this.elegidos());
    if (!ids.length) return 'Elija al menos un ítem a despachar.';
    for (const i of this.despachables()) {
      const c = this.elegidos()[i.id];
      if (c === undefined) continue;
      const n = Number(c);
      if (!Number.isFinite(n) || n <= 0) return `Indique la cantidad de ${i.codigo}.`;
      if (n > i.cantidad) return `${i.codigo}: no puede despachar más de lo pedido (${i.cantidad}).`;
    }
    return null;
  });

  constructor() {
    this.catalogos.bodegas().subscribe((b) => this.bodegas.set(b.map((x) => ({ label: x.nombre, value: x.id }))));
  }

  protected elegido(i: ItemPedido): boolean {
    return this.elegidos()[i.id] !== undefined;
  }

  protected cantidadDe(i: ItemPedido): string {
    return this.elegidos()[i.id] ?? String(i.cantidad);
  }

  protected alternar(i: ItemPedido): void {
    this.elegidos.update((m) => {
      const { [i.id]: actual, ...resto } = m;
      return actual === undefined ? { ...m, [i.id]: String(i.cantidad) } : resto;
    });
  }

  protected cambiarCantidad(i: ItemPedido, valor: string): void {
    if (!this.elegido(i)) return;
    this.elegidos.update((m) => ({ ...m, [i.id]: valor }));
  }

  protected enviar(): void {
    if (this.problema() || this.enviando()) return;
    const cuerpo: SolicitarDespachoRequest = {
      bodegaId: this.bodegaId()!,
      fechaRequerida: this.fecha(),
      ...(this.nota().trim() ? { nota: this.nota().trim() } : {}),
      items: this.despachables()
        .filter((i) => this.elegido(i))
        .map((i) => ({ pedidoItemId: i.id, cantidad: Number(this.elegidos()[i.id]) })),
    };
    this.enviando.set(true);
    this.error.set(null);
    this.servicio.solicitarDespacho(this.data.pedidoId, cuerpo).subscribe({
      next: () => this.modalRef.close(true),
      error: (err) => {
        this.enviando.set(false);
        this.error.set(mensajeErrorGuia(err, 'No se pudo solicitar el despacho. Intente de nuevo.'));
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close(undefined);
  }
}
