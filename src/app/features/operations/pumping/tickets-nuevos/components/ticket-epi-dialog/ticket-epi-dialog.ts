import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  mensajeErrorEpi,
  type ElementoEpi,
  type EntregaEpi,
  type LugarEpi,
  type RenglonEntrada,
  type TallaEpi,
} from '../../../../../qhse/entrega-epi/models/entrega-epi';
import { EntregaEpiService } from '../../../../../qhse/entrega-epi/services/entrega-epi.service';

export interface TicketEpiDialogData {
  ticketId: string;
  trabajadorId: string;
  trabajadorNombre: string;
  trabajadorCargo: string | null;
}

interface Fila {
  elementoId: string;
  cantidad: number;
  tallaId: string;
  recibioCapacitacion: boolean;
}

/**
 * "Solicitar entrega de EPI" desde el ticket (como en la demo): el equipo de Pumping elige el lugar y los elementos que recibirá el
 * operador; QHSE la revisa, la aprueba y la despacha. Al despacharla, el requisito del ticket se cumple solo.
 */
@Component({
  selector: 'app-ticket-epi-dialog',
  imports: [
    DynadrillButtonComponent,
    DynadrillCheckboxComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="te">
      <div class="te__cabecera">
        <dynadrill-select
          label="Lugar"
          placeholder="Elija la base o bodega"
          [options]="opcionesLugares()"
          [value]="lugarId()"
          [searchable]="true"
          (valueChange)="lugarId.set($any($event))"
        />
        <dynadrill-input
          label="Nombre y apellido del trabajador"
          [value]="data.trabajadorNombre"
          [disabled]="true"
        />
        <dynadrill-input label="Cargo" [value]="data.trabajadorCargo ?? ''" [disabled]="true" />
      </div>

      <dynadrill-text variant="h2">Elementos entregados</dynadrill-text>
      @if (filas().length === 0) {
        <dynadrill-text variant="caption">Sin elementos agregados todavía.</dynadrill-text>
      }
      @for (f of filas(); track $index; let i = $index) {
        <div class="te__fila">
          <span class="te__nombre"
            >{{ nombreElemento(f.elementoId) }} · {{ f.cantidad
            }}{{ f.tallaId ? ' · talla ' + codigoTalla(f.tallaId) : ''
            }}{{ f.recibioCapacitacion ? ' · con capacitación' : '' }}</span
          >
          <button
            type="button"
            class="te__quitar"
            [attr.aria-label]="'Quitar ' + nombreElemento(f.elementoId)"
            (click)="quitar(i)"
          >
            Quitar
          </button>
        </div>
      }

      <fieldset class="te__nuevo">
        <legend>Agregar un elemento</legend>
        <dynadrill-select
          label="Elemento de protección individual"
          placeholder="Elija el elemento"
          [options]="opcionesElementos()"
          [value]="elementoId()"
          [searchable]="true"
          (valueChange)="elegirElemento($any($event))"
        />
        <dynadrill-input
          label="Cantidad"
          type="number"
          [value]="cantidad()"
          (valueChange)="cantidad.set($any($event))"
        />
        @if (tipoTalla()) {
          <dynadrill-select
            label="Talla"
            placeholder="Elija la talla"
            [options]="opcionesTallas()"
            [value]="tallaId()"
            (valueChange)="tallaId.set($any($event))"
          />
        }
        <dynadrill-checkbox
          label="Recibió capacitación en uso y manejo del EPI"
          [checked]="capacitado()"
          (checkedChange)="capacitado.set($event)"
        />
        <div>
          <dynadrill-button
            variant="secondary"
            size="small"
            [disabled]="!puedeAgregar()"
            (clicked)="agregar()"
            >Agregar elemento</dynadrill-button
          >
        </div>
      </fieldset>

      <dynadrill-checkbox
        label="Acepto ser responsable por los elementos de protección individual y ropa de trabajo que me están entregando, y me comprometo a dar uso adecuado de dichos elementos de acuerdo a las indicaciones recibidas."
        [checked]="acepta()"
        (checkedChange)="acepta.set($event)"
      />
    </div>
    <footer class="te__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!puedeRegistrar() || enviando()" (clicked)="registrar()">{{
        enviando() ? 'Registrando…' : 'Registrar entrega'
      }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .te {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .te__cabecera {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .te__fila {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f3f2f7;
      font-size: 14px;
    }
    .te__nuevo {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      border: 1px dashed #d9d6e6;
      border-radius: 10px;
    }
    .te__nuevo legend {
      padding: 0 6px;
      font-size: 13px;
      color: #5c5870;
    }
    .te__quitar {
      background: none;
      border: 0;
      color: #6c2fa0;
      cursor: pointer;
      font: inherit;
      text-decoration: underline;
    }
    .te__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class TicketEpiDialog {
  protected readonly data = inject<TicketEpiDialogData>(NZ_MODAL_DATA);
  private readonly servicio = inject(EntregaEpiService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketEpiDialog, EntregaEpi | undefined>);

  protected readonly lugares = signal<LugarEpi[]>([]);
  protected readonly elementos = signal<ElementoEpi[]>([]);
  protected readonly tallas = signal<TallaEpi[]>([]);

  protected readonly lugarId = signal('');
  protected readonly filas = signal<Fila[]>([]);
  protected readonly elementoId = signal('');
  protected readonly cantidad = signal<string>('1');
  protected readonly tallaId = signal('');
  protected readonly capacitado = signal(false);
  protected readonly acepta = signal(false);
  protected readonly enviando = signal(false);

  protected readonly opcionesLugares = computed<DynadrillSelectOption[]>(() =>
    this.lugares().map((x) => ({ value: x.id, label: x.nombre })),
  );
  protected readonly opcionesElementos = computed<DynadrillSelectOption[]>(() =>
    this.elementos().map((x) => ({ value: x.id, label: `${x.codigo} · ${x.nombre}` })),
  );
  protected readonly tipoTalla = computed(
    () => this.elementos().find((e) => e.id === this.elementoId())?.tipoTalla ?? null,
  );
  protected readonly opcionesTallas = computed<DynadrillSelectOption[]>(() =>
    this.tallas()
      .filter((t) => t.tipo === this.tipoTalla())
      .map((t) => ({ value: t.id, label: t.codigo })),
  );
  protected readonly puedeAgregar = computed(() => {
    const n = Number(this.cantidad());
    return (
      !!this.elementoId() &&
      Number.isInteger(n) &&
      n >= 1 &&
      n <= 1000 &&
      (!this.tipoTalla() || !!this.tallaId())
    );
  });
  protected readonly puedeRegistrar = computed(() => this.filas().length > 0 && this.acepta());

  constructor() {
    forkJoin({
      lugares: this.servicio.lugares(),
      elementos: this.servicio.elementos(),
      tallas: this.servicio.tallas(),
    }).subscribe({
      next: (c) => {
        this.lugares.set(c.lugares);
        this.elementos.set(c.elementos);
        this.tallas.set(c.tallas);
      },
      error: () => this.notify.error('Error', 'No se pudieron cargar los catálogos del EPI.'),
    });
  }

  protected nombreElemento(id: string): string {
    return this.elementos().find((e) => e.id === id)?.nombre ?? '';
  }

  protected codigoTalla(id: string): string {
    return this.tallas().find((t) => t.id === id)?.codigo ?? '';
  }

  protected elegirElemento(id: string): void {
    this.elementoId.set(id);
    this.tallaId.set('');
  }

  protected agregar(): void {
    if (!this.puedeAgregar()) return;
    this.filas.update((f) => [
      ...f,
      {
        elementoId: this.elementoId(),
        cantidad: Number(this.cantidad()),
        tallaId: this.tallaId(),
        recibioCapacitacion: this.capacitado(),
      },
    ]);
    this.elementoId.set('');
    this.cantidad.set('1');
    this.tallaId.set('');
    this.capacitado.set(false);
  }

  protected quitar(i: number): void {
    this.filas.update((f) => f.filter((_, j) => j !== i));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected registrar(): void {
    if (!this.puedeRegistrar() || this.enviando()) return;
    this.enviando.set(true);
    const renglones: RenglonEntrada[] = this.filas().map((f) => ({
      elementoId: f.elementoId,
      cantidad: f.cantidad,
      recibioCapacitacion: f.recibioCapacitacion,
      ...(f.tallaId ? { tallaId: f.tallaId } : {}),
    }));
    this.servicio
      .solicitarDeTicket(this.data.ticketId, {
        trabajadorId: this.data.trabajadorId,
        ...(this.lugarId() ? { lugarBodegaId: this.lugarId() } : {}),
        renglones,
      })
      .subscribe({
        next: (e) => this.modalRef.close(e),
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo',
            mensajeErrorEpi(err, 'No se pudo registrar la solicitud.'),
          );
        },
      });
  }
}
