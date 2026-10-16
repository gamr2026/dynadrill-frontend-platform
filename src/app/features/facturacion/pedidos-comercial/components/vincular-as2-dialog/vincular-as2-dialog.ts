import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillNotificationService, DynadrillSpinnerComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { SearchField } from '../../../../../shared/components/search-field/search-field';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import { formatoDia, formatoMoneda, mensajeDeError, type As2PedidoResumen, type PedidoResumen } from '../../models/pedido-comercial.model';

export interface VincularAs2DialogData {
  as2: As2PedidoResumen;
}

/** Elige el pedido del portal (aún sin número de AS2) que corresponde al pedido de AS2 indicado y lo vincula. */
@Component({
  selector: 'app-vincular-as2-dialog',
  imports: [SearchField, DynadrillButtonComponent, DynadrillSpinnerComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="vincular">
      <dynadrill-text variant="body">
        Pedido de AS2 <strong>{{ data.as2.numero ?? data.as2.idPedidoCliente }}</strong>
        @if (data.as2.empresaNombre) {
          · {{ data.as2.empresaNombre }}
        }
        · {{ moneda(data.as2.total) }}. Elija el pedido del portal que quedará vinculado con él.
      </dynadrill-text>
      <app-search-field label="Buscar pedido del portal" placeholder="Buscar por código, cliente, campo o pozo…" [value]="busqueda()" (valueChange)="buscar($event)" />
      <dynadrill-spinner mode="overlay" [spinning]="cargando()" tip="Buscando…">
        <ul class="vincular__lista" role="listbox" aria-label="Pedidos del portal pendientes de AS2">
          @for (p of candidatos(); track p.id) {
            <li>
              <button type="button" role="option" class="vincular__op" [attr.aria-selected]="p.id === elegido()" [class.vincular__op--sel]="p.id === elegido()" (click)="elegido.set(p.id)">
                <strong>{{ p.codigo ?? 'Sin código' }}</strong>
                <span>{{ p.clienteNombre ?? 'Sin cliente' }} · {{ p.campoNombre ?? '—' }} / {{ p.pozoNombre ?? '—' }}</span>
                <span class="vincular__meta">{{ p.estadoNombre }} · creado {{ dia(p.createdAt) }}</span>
              </button>
            </li>
          } @empty {
            <li class="vincular__vacio">{{ cargando() ? 'Buscando…' : 'No hay pedidos del portal pendientes de vincular.' }}</li>
          }
        </ul>
      </dynadrill-spinner>
    </div>
    <footer class="vincular__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!hayElegido() || enviando()" (clicked)="vincular()">{{ enviando() ? 'Vinculando…' : 'Vincular' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .vincular { display: flex; flex-direction: column; gap: 12px; }
    .vincular__lista { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; min-height: 80px; }
    .vincular__op { width: 100%; display: flex; flex-direction: column; gap: 2px; text-align: left; font: inherit; padding: 10px 12px; cursor: pointer; background: var(--surface, #fff); border: 1px solid var(--border, #e5e4ea); border-radius: 10px; color: var(--text, #2c2b35); }
    .vincular__op:hover, .vincular__op:focus-visible { border-color: var(--dynadrill-purple, #662e9b); }
    .vincular__op--sel { border-color: var(--dynadrill-purple, #662e9b); background: var(--dynadrill-purple-tint, rgba(102, 46, 155, 0.06)); }
    .vincular__meta { font-size: 12px; color: var(--text-muted, #5c5870); }
    .vincular__vacio { padding: 18px 8px; text-align: center; color: var(--text-muted, #5c5870); }
    .vincular__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class VincularAs2Dialog {
  private readonly servicio = inject(PedidosComercialService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<VincularAs2Dialog, string | undefined>);
  protected readonly data = inject<VincularAs2DialogData>(NZ_MODAL_DATA);

  protected readonly busqueda = signal('');
  protected readonly cargando = signal(false);
  protected readonly candidatos = signal<PedidoResumen[]>([]);
  protected readonly elegido = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly hayElegido = computed(() => this.elegido() !== null);
  protected readonly dia = formatoDia;
  protected readonly moneda = formatoMoneda;

  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private vigente = 0;

  constructor() {
    this.cargar();
  }

  protected buscar(valor: string): void {
    this.busqueda.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.cargar(), 300);
  }

  private cargar(): void {
    const peticion = ++this.vigente;
    this.cargando.set(true);
    this.servicio.listar({ origen: 'portal', as2Sync: 'pendiente_de_crear_en_as2', q: this.busqueda(), limit: 30 }).subscribe({
      next: r => {
        if (peticion !== this.vigente) return;
        this.candidatos.set(r.items);
        if (!r.items.some(i => i.id === this.elegido())) this.elegido.set(null);
        this.cargando.set(false);
      },
      error: err => {
        if (peticion !== this.vigente) return;
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar los pedidos del portal.'));
      },
    });
  }

  protected vincular(): void {
    const id = this.elegido();
    if (!id || this.enviando()) return;
    this.enviando.set(true);
    this.servicio.vincularAs2(id, this.data.as2.idPedidoCliente).subscribe({
      next: p => {
        this.notify.success('Pedido vinculado', `${p.codigo ?? 'El pedido'} quedó vinculado con AS2 ${this.data.as2.numero ?? this.data.as2.idPedidoCliente}.`);
        this.modalRef.close(p.id);
      },
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo vincular', mensajeDeError(err, 'No se pudo vincular el pedido con AS2.'));
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
