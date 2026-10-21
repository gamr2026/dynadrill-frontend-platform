import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { Observable } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADO_DIA_REPORTE_LABELS,
  ESTADO_DIA_REPORTE_MARCA,
  mensajeErrorTicket,
  type EstadoDiaReporte,
  type ItemReporte,
  type OpcionItemLista,
  type ReporteHerramientas,
  type TicketFcr,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

/** Orden del ciclo al pulsar el día: vacío → operación → daily charge → venta → vacío. */
const CICLO: Array<EstadoDiaReporte | null> = [null, 'operacion', 'daily_charge', 'venta'];

/** Los días entre dos fechas `YYYY-MM-DD` (ambas incluidas), sin pasar por la zona horaria. */
function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const f = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (f <= fin && dias.length < 120) {
    dias.push(f.toISOString().slice(0, 10));
    f.setUTCDate(f.getUTCDate() + 1);
  }
  return dias;
}

/**
 * Reporte de Herramientas (DYN-FCR-RE-008) por ítem de la lista de precios del cliente: cada fila es un código de la lista; las filas de
 * unidad de tiempo se marcan día por día (O operación, D daily charge, V venta) y las demás llevan la cantidad real. El stand-by no se
 * cobra y no se registra. Lo que se reporta es lo que se factura; si difiere de lo cotizado, se propone el cambio de ítems.
 */
@Component({
  selector: 'app-ticket-fcr-reporte-herramientas',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dynadrill-spinner mode="overlay" [spinning]="cargando() || ocupado()" tip="Procesando…">
      <div class="r">
        @if (error(); as e) {
          <dynadrill-banner variant="warning" [message]="e" />
        }
        @if (reporte()?.listadoConfirmado) {
          <dynadrill-tag
            label="Reporte de herramientas confirmado"
            variant="success"
            [uppercase]="false"
          />
        }

        @if (puedeEditar()) {
          <div class="r__agregar">
            <dynadrill-input
              label="Buscar en la lista de precios"
              placeholder="Código o descripción"
              [value]="busqueda()"
              (valueChange)="busqueda.set($event)"
            />
            <dynadrill-button
              variant="secondary"
              size="small"
              [disabled]="busqueda().trim().length < 2"
              (clicked)="buscar()"
              >Buscar</dynadrill-button
            >
          </div>
          @if (opciones().length) {
            <div class="r__agregar">
              <dynadrill-select
                label="Ítem de la lista"
                placeholder="Elija el ítem"
                [options]="opcionesSelect()"
                [value]="elegido()"
                [searchable]="true"
                (valueChange)="elegido.set($any($event))"
              />
              <dynadrill-button
                variant="primary"
                size="small"
                [disabled]="!elegido()"
                (clicked)="agregar()"
                >Agregar al reporte</dynadrill-button
              >
            </div>
          } @else if (buscado()) {
            <dynadrill-text variant="caption"
              >La lista de precios del cliente no tiene ítems con ese texto.</dynadrill-text
            >
          }
        }

        <div class="r__scroll">
          <table class="r__tabla">
            <caption class="sr-only">
              Reporte de herramientas por ítem de la lista de precios
            </caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Descripción</th>
                <th scope="col">Unidad</th>
                <th scope="col">Serie #</th>
                @for (d of dias(); track d) {
                  <th scope="col" class="r__dia">{{ etiquetaDia(d) }}</th>
                }
                <th scope="col">Cantidad</th>
                @if (puedeEditar()) {
                  <th scope="col"><span class="sr-only">Acciones</span></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (it of reporte()?.items ?? []; track it.id) {
                <tr>
                  <th scope="row">{{ it.codigo }}</th>
                  <td>{{ it.descripcion }}</td>
                  <td>{{ it.unidad }}</td>
                  <td>
                    @if (puedeEditar()) {
                      <input
                        class="r__campo"
                        type="text"
                        [attr.list]="'series-' + it.id"
                        maxlength="100"
                        [attr.aria-label]="'Serie de ' + it.codigo"
                        [value]="it.serie ?? ''"
                        (change)="guardarSerie(it, $any($event.target).value)"
                      />
                      <datalist id="series-{{ it.id }}">
                        @for (s of it.seriesSugeridas; track s) {
                          <option [value]="s"></option>
                        }
                      </datalist>
                    } @else {
                      {{ it.serie ?? '—' }}
                    }
                  </td>
                  @if (it.porDia) {
                    @for (d of dias(); track d) {
                      <td class="r__dia">
                        @if (puedeEditar()) {
                          <button
                            type="button"
                            class="r__marca"
                            [class.r__marca--on]="!!marca(it, d)"
                            [attr.aria-label]="descripcionMarca(it, d)"
                            (click)="ciclar(it, d)"
                          >
                            {{ letra(it, d) }}
                          </button>
                        } @else {
                          {{ letra(it, d) }}
                        }
                      </td>
                    }
                  } @else {
                    <td [attr.colspan]="dias().length || 1" class="r__dia">
                      <span class="r__meta">No es por día: escriba la cantidad</span>
                    </td>
                  }
                  <td>
                    @if (!it.porDia && puedeEditar()) {
                      <input
                        class="r__campo r__campo--num"
                        type="number"
                        min="0"
                        step="any"
                        [attr.aria-label]="'Cantidad de ' + it.codigo"
                        [value]="it.cantidad"
                        (change)="guardarCantidad(it, $any($event.target).value)"
                      />
                    } @else {
                      <strong>{{ it.cantidad }}</strong>
                    }
                  </td>
                  @if (puedeEditar()) {
                    <td>
                      <dynadrill-button variant="secondary" size="small" (clicked)="quitar(it)"
                        >Quitar</dynadrill-button
                      >
                    </td>
                  }
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="6 + dias().length" class="r__meta">
                    Todavía no hay ítems en el reporte. Búsquelos en la lista de precios del
                    cliente.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <dynadrill-text variant="caption"
          >Marque cada día con O (operación), D (daily charge) o V (venta); pulse otra vez para
          cambiar o quitar la marca. El stand-by no se cobra.</dynadrill-text
        >

        @if (puedeEditar()) {
          <div class="r__acciones">
            <dynadrill-button variant="secondary" size="small" (clicked)="confirmar()">{{
              reporte()?.listadoConfirmado ? 'Reabrir el reporte' : 'Declarar el reporte completo'
            }}</dynadrill-button>
          </div>
        }
      </div>
    </dynadrill-spinner>
  `,
  styles: `
    .r {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .r__agregar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
    }
    .r__agregar dynadrill-input,
    .r__agregar dynadrill-select {
      flex: 1;
      min-width: 12rem;
      max-width: 24rem;
    }
    .r__acciones {
      display: flex;
      gap: 0.75rem;
    }
    .r__scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .r__tabla {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }
    .r__tabla th,
    .r__tabla td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-default, #e0e0e0);
      vertical-align: middle;
    }
    .r__tabla thead th {
      font-weight: 600;
      color: var(--text-secondary, #666);
      white-space: nowrap;
      background: var(--dynadrill-purple-tint, rgba(102, 46, 155, 0.06));
    }
    .r__tabla tbody tr:nth-child(even) {
      background: var(--surface-muted, #faf9fc);
    }
    .r__tabla tbody th {
      font-weight: 600;
      white-space: nowrap;
    }
    .r__dia {
      text-align: center !important;
      padding-inline: 0.25rem !important;
    }
    .r__meta {
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
    }
    .r__campo {
      width: 8rem;
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--border-default, #e0e0e0);
      border-radius: 0.375rem;
      font: inherit;
    }
    .r__campo--num {
      width: 6rem;
    }
    .r__marca {
      width: 1.75rem;
      height: 1.75rem;
      border: 1px solid var(--border-default, #e0e0e0);
      border-radius: 0.375rem;
      background: var(--surface, #fff);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .r__marca--on {
      color: #fff;
      border-color: var(--dynadrill-purple, #662e9b);
      background: var(--dynadrill-purple, #662e9b);
    }
    .r__marca:focus-visible,
    .r__campo:focus-visible {
      outline: 2px solid var(--dynadrill-purple, #662e9b);
      outline-offset: 2px;
    }
  `,
})
export class TicketFcrReporteHerramientas {
  private readonly servicio = inject(TicketsFcrService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly ticket = input.required<TicketFcr>();
  /** Solo el operador del equipo y mientras el ticket está en ejecución. */
  readonly puedeEditar = input(false);
  readonly cambio = output<void>();

  protected readonly reporte = signal<ReporteHerramientas | null>(null);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busqueda = signal('');
  protected readonly buscado = signal(false);
  protected readonly opciones = signal<OpcionItemLista[]>([]);
  protected readonly elegido = signal('');

  protected readonly opcionesSelect = computed<DynadrillSelectOption[]>(() =>
    this.opciones().map((o) => ({
      label: `${o.codigo} · ${o.descripcion} (${o.unidad})`,
      value: o.listaPreciosItemId,
    })),
  );

  /** Los días del servicio; si el ticket no trae fechas, los que ya tienen marcas. */
  protected readonly dias = computed(() => {
    const r = this.reporte();
    if (!r) return [];
    const marcados = new Set(r.items.flatMap((i) => i.dias.map((d) => d.fecha)));
    if (r.fechaInicio && r.fechaFin) {
      const rango = diasEntre(r.fechaInicio, r.fechaFin);
      marcados.forEach((f) => !rango.includes(f) && rango.push(f));
      return rango.sort();
    }
    return [...marcados].sort();
  });

  constructor() {
    effect(() => {
      this.ticket().version;
      this.cargar();
    });
  }

  protected etiquetaDia(fecha: string): string {
    return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  }

  protected marca(it: ItemReporte, fecha: string): EstadoDiaReporte | null {
    return it.dias.find((d) => d.fecha === fecha)?.estado ?? null;
  }

  protected letra(it: ItemReporte, fecha: string): string {
    const m = this.marca(it, fecha);
    return m ? ESTADO_DIA_REPORTE_MARCA[m] : '';
  }

  protected descripcionMarca(it: ItemReporte, fecha: string): string {
    const m = this.marca(it, fecha);
    return `${it.codigo}, día ${fecha}: ${m ? ESTADO_DIA_REPORTE_LABELS[m] : 'sin marca'}`;
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.reporte(this.ticket().id).subscribe({
      next: (r) => {
        this.reporte.set(r);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar el reporte de herramientas.'));
      },
    });
  }

  /** Corre una escritura del reporte: muestra el nuevo reporte o el error, y avisa al ticket. */
  private escribir(
    peticion: Observable<ReporteHerramientas>,
    mensajeError: string,
    alTerminar?: () => void,
  ): void {
    this.ocupado.set(true);
    this.error.set(null);
    peticion.subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.reporte.set(r);
        alTerminar?.();
        this.cambio.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, mensajeError));
        this.cargar();
      },
    });
  }

  protected buscar(): void {
    this.servicio.itemsDeLista(this.ticket().pedidoId, this.busqueda().trim()).subscribe({
      next: (r) => {
        const usados = new Set(this.reporte()?.items.map((i) => i.listaPreciosItemId));
        this.opciones.set(r.opciones.filter((o) => !usados.has(o.listaPreciosItemId)));
        this.elegido.set('');
        this.buscado.set(true);
      },
      error: (err) =>
        this.error.set(mensajeErrorTicket(err, 'No se pudo consultar la lista de precios.')),
    });
  }

  protected agregar(): void {
    const o = this.opciones().find((x) => x.listaPreciosItemId === this.elegido());
    if (!o) return;
    this.escribir(
      this.servicio.agregarItemReporte(this.ticket().id, {
        listaPreciosItemId: o.listaPreciosItemId,
        codigo: o.codigo,
        descripcion: o.descripcion,
        unidad: o.unidad,
      }),
      'No se pudo agregar el ítem.',
      () => {
        this.opciones.update((l) => l.filter((x) => x !== o));
        this.elegido.set('');
      },
    );
  }

  protected quitar(it: ItemReporte): void {
    this.escribir(
      this.servicio.quitarItemReporte(this.ticket().id, it.id),
      'No se pudo quitar el ítem.',
    );
  }

  protected guardarSerie(it: ItemReporte, valor: string): void {
    const serie = valor.trim();
    if (serie === (it.serie ?? '')) return;
    this.escribir(
      this.servicio.actualizarItemReporte(this.ticket().id, it.id, { serie }),
      'No se pudo guardar la serie.',
    );
  }

  protected guardarCantidad(it: ItemReporte, valor: string): void {
    const cantidad = Number(valor);
    if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad === it.cantidad) return;
    this.escribir(
      this.servicio.actualizarItemReporte(this.ticket().id, it.id, { cantidad }),
      'No se pudo guardar la cantidad.',
    );
  }

  protected ciclar(it: ItemReporte, fecha: string): void {
    const siguiente = CICLO[(CICLO.indexOf(this.marca(it, fecha)) + 1) % CICLO.length];
    this.escribir(
      this.servicio.marcarDiaReporte(this.ticket().id, it.id, fecha, siguiente),
      'No se pudo marcar el día.',
    );
  }

  protected confirmar(): void {
    const confirmado = !this.reporte()?.listadoConfirmado;
    this.escribir(
      this.servicio.confirmarReporte(this.ticket().id, confirmado),
      'No se pudo confirmar el reporte.',
      () => {
        if (confirmado)
          this.notify.success(
            'Reporte de herramientas confirmado',
            'Ya puede finalizar la ejecución.',
          );
      },
    );
  }
}
