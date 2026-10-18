import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  compararItems,
  validarCambio,
  type ItemCambio,
  type ItemsParaCambio,
  type OpcionItem,
  type SolicitudCambioItems,
  type TipoLineaItem,
} from '../../models/cambio-items';
import { mensajeErrorTicket } from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketCambioItemsDialogData {
  ticketId: string;
  pedidoId: string;
  pedidoCodigo: string;
}

const tipoDe = (o: OpcionItem): TipoLineaItem => (/moviliz/i.test(o.descripcion) ? 'movilizacion' : o.tipo === 'Material' ? 'material' : 'servicio');
const numeroONulo = (v: string): number | null => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * El Operador del equipo propone cómo deben quedar los ítems del pedido: cambia cantidades, quita ítems o agrega los de la lista de
 * precios del cliente. No ve ni escribe precios: los pone Comercial. Lo propuesto lo aprueba el Supervisor del ticket.
 */
@Component({
  selector: 'app-ticket-cambio-items-dialog',
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillTextComponent, DynadrillTextareaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  template: `
    <div class="ci">
      <dynadrill-text variant="body">Pedido {{ data.pedidoCodigo }}. Deje los ítems como deben quedar; el Supervisor del ticket revisa el cambio y Facturación lo aplica.</dynadrill-text>

      @if (cargando()) {
        <dynadrill-text variant="caption">Cargando los ítems del pedido…</dynadrill-text>
      }
      @if (sinEnlace() > 0) {
        <div class="ci__aviso" role="status">{{ sinEnlace() }} ítem(s) del pedido no vienen de la lista de precios (los trajo AS2): no se pueden cambiar desde aquí y se conservan.</div>
      }

      <table class="ci__tabla">
        <thead>
          <tr><th scope="col">Ítem</th><th scope="col">Unidad</th><th scope="col">Cantidad</th><th scope="col">Descuento %</th><th scope="col"><span class="sr-only">Quitar</span></th></tr>
        </thead>
        <tbody>
          @for (i of items(); track i.listaPreciosItemId; let k = $index) {
            <tr>
              <td><strong>{{ i.codigo }}</strong> <span class="ci__meta">{{ i.descripcion }}</span></td>
              <td>{{ i.unidad }}</td>
              <td><input type="number" min="0" step="any" [attr.aria-label]="'Cantidad de ' + i.codigo" [value]="i.cantidad" (input)="cambiarCantidad(k, $any($event.target).value)" /></td>
              <td><input type="number" min="0" max="100" step="any" [attr.aria-label]="'Descuento de ' + i.codigo" [value]="i.descuentoPct ?? ''" (input)="cambiarDescuento(k, $any($event.target).value)" /></td>
              <td><button type="button" class="ci__quitar" [attr.aria-label]="'Quitar ' + i.codigo" (click)="quitar(k)">Quitar</button></td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="ci__meta">Sin ítems: agregue al menos uno de la lista.</td></tr>
          }
        </tbody>
      </table>

      <fieldset class="ci__bloque">
        <legend>Agregar un ítem de la lista de precios del cliente</legend>
        <dynadrill-input label="Buscar por código o descripción (2 letras o más)" [value]="busqueda()" (valueChange)="onBusqueda($event)" />
        @if (opciones().length) {
          <ul class="ci__opciones">
            @for (o of opciones(); track o.listaPreciosItemId) {
              <li>
                <button type="button" class="ci__opcion" [disabled]="yaEsta(o)" (click)="agregar(o)">
                  <strong>{{ o.codigo }}</strong> <span>{{ o.descripcion }}</span> <span class="ci__meta">{{ yaEsta(o) ? 'ya está' : o.unidad }}</span>
                </button>
              </li>
            }
          </ul>
        } @else if (busqueda().trim().length >= 2 && !buscando()) {
          <dynadrill-text variant="caption">No hay ítems con ese texto en la lista del cliente.</dynadrill-text>
        }
      </fieldset>

      <dynadrill-textarea label="Motivo del cambio" placeholder="Por qué cambian los ítems (por ejemplo, se usó más material del cotizado)" [rows]="2" [value]="motivo()" (valueChange)="motivo.set($event)" />

      @if (problema(); as p) {
        <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
      } @else {
        <dynadrill-text variant="caption">{{ cambios().length }} cambio(s) respecto al pedido.</dynadrill-text>
      }
    </div>
    <footer class="ci__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!!problema() || enviando()" (clicked)="enviar()">{{ enviando() ? 'Enviando…' : 'Enviar al Supervisor' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .ci { display: flex; flex-direction: column; gap: 14px; }
    .ci__aviso { background: #fff7e6; border: 1px solid #ffd591; border-radius: 6px; padding: 8px 12px; font-size: 13px; }
    .ci__tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
    .ci__tabla th, .ci__tabla td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ecebf1; }
    .ci__tabla th { font-weight: 600; color: #5c5870; }
    .ci__tabla input { width: 90px; height: 32px; border: 1px solid #d6d3e0; border-radius: 6px; padding: 0 6px; }
    .ci__meta { font-size: 12px; color: #5c5870; }
    .ci__quitar { background: none; border: 0; color: #5c5870; text-decoration: underline; cursor: pointer; }
    .ci__bloque { border: 1px solid #ecebf1; border-radius: 8px; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
    .ci__bloque legend { padding: 0 6px; font-weight: 600; }
    .ci__opciones { list-style: none; margin: 0; padding: 0; max-height: 200px; overflow-y: auto; border: 1px solid #ecebf1; border-radius: 8px; }
    .ci__opcion { display: grid; grid-template-columns: 140px 1fr auto; gap: 8px; width: 100%; padding: 8px 12px; text-align: left; background: transparent; border: 0; cursor: pointer; }
    .ci__opcion:hover:not(:disabled) { background: #f5f4f8; }
    .ci__opcion:disabled { cursor: default; opacity: 0.6; }
    .ci__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class TicketCambioItemsDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketCambioItemsDialog, SolicitudCambioItems | undefined>);
  protected readonly data = inject<TicketCambioItemsDialogData>(NZ_MODAL_DATA);

  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly buscando = signal(false);
  private readonly hoy = signal<ItemsParaCambio['actuales']>([]);
  protected readonly items = signal<ItemCambio[]>([]);
  protected readonly motivo = signal('');
  protected readonly busqueda = signal('');
  protected readonly opciones = signal<OpcionItem[]>([]);
  private readonly texto$ = new Subject<string>();

  protected readonly sinEnlace = computed(() => this.hoy().filter(a => !a.listaPreciosItemId).length);
  protected readonly cambios = computed(() => compararItems(this.hoy(), this.items()));
  protected readonly problema = computed(() => validarCambio(this.motivo(), this.items(), this.cambios().length > 0));

  constructor() {
    this.servicio.itemsParaCambio(this.data.pedidoId).subscribe({
      next: r => {
        this.hoy.set(r.actuales);
        this.items.set(r.actuales.filter((a): a is ItemCambio => !!a.listaPreciosItemId));
        this.cargando.set(false);
      },
      error: err => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeErrorTicket(err, 'No se pudieron cargar los ítems del pedido.'));
      },
    });
    this.texto$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.length < 2) return of<ItemsParaCambio>({ actuales: [], opciones: [] });
          this.buscando.set(true);
          return this.servicio.itemsParaCambio(this.data.pedidoId, q);
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe({
        next: r => {
          this.opciones.set(r.opciones);
          this.buscando.set(false);
        },
        error: () => {
          this.opciones.set([]);
          this.buscando.set(false);
        },
      });
  }

  protected onBusqueda(valor: string): void {
    this.busqueda.set(valor);
    this.texto$.next(valor.trim());
  }
  protected yaEsta(o: OpcionItem): boolean {
    return this.items().some(i => i.listaPreciosItemId === o.listaPreciosItemId);
  }
  protected agregar(o: OpcionItem): void {
    if (this.yaEsta(o)) return;
    this.items.update(l => [...l, { listaPreciosItemId: o.listaPreciosItemId, codigo: o.codigo, descripcion: o.descripcion, unidad: o.unidad, cantidad: 1, descuentoPct: null, tipoLinea: tipoDe(o) }]);
    this.busqueda.set('');
    this.opciones.set([]);
  }
  protected quitar(k: number): void {
    this.items.update(l => l.filter((_, i) => i !== k));
  }
  protected cambiarCantidad(k: number, valor: string): void {
    const n = numeroONulo(valor);
    this.items.update(l => l.map((i, j) => (j === k ? { ...i, cantidad: n ?? 0 } : i)));
  }
  protected cambiarDescuento(k: number, valor: string): void {
    this.items.update(l => l.map((i, j) => (j === k ? { ...i, descuentoPct: numeroONulo(valor) } : i)));
  }

  protected enviar(): void {
    if (this.problema() || this.enviando()) return;
    this.enviando.set(true);
    this.servicio
      .proponerCambioItems(this.data.ticketId, {
        motivo: this.motivo().trim(),
        items: this.items().map(i => ({ ...i, descuentoPct: i.descuentoPct ?? undefined })),
      })
      .subscribe({
        next: s => {
          this.notify.success('Cambio enviado', 'Quedó pendiente de la aprobación del Supervisor.');
          this.modalRef.close(s);
        },
        error: err => {
          this.enviando.set(false);
          this.notify.error('No se pudo enviar', mensajeErrorTicket(err, 'No se pudo enviar el cambio. Intente de nuevo.'));
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
