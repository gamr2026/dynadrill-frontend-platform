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

/** Orden del ciclo al pulsar el día de una fila de tiempo: vacío → operación → daily charge → venta → vacío. */
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
 * Reporte de Herramientas (DYN-FCR-RE-008) como los formatos reales: una matriz ítem × día. Las filas son los ítems cotizados del pedido
 * (precargados); el operador solo reparte cada cantidad en los días del servicio: en las filas de tiempo marca el día (O operación, D daily
 * charge, V venta) y en las demás escribe la cantidad aplicada ese día. Lo reportado de un código no puede superar lo cotizado; para pasarse se
 * propone el cambio de ítems del pedido. El stand-by no se cobra y no se registra.
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
          <dynadrill-text variant="caption"
            >Reparta la cantidad de cada ítem en los días del servicio. En los ítems por día pulse
            la celda para marcarla (1 = operación; vuelva a pulsar para D daily charge, V venta o
            quitarla); en los demás escriba la cantidad aplicada ese día. Lo reportado no puede
            superar lo cotizado.</dynadrill-text
          >
        }

        <div class="r__scroll">
          <table class="r__tabla">
            <caption class="sr-only">
              Reporte de herramientas: cantidad de cada ítem por día
            </caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Descripción</th>
                <th scope="col">Unidad</th>
                <th scope="col">Serie #</th>
                <th scope="col" class="r__num">Cotizado</th>
                @for (d of dias(); track d) {
                  <th scope="col" class="r__dia">{{ etiquetaDia(d) }}</th>
                }
                <th scope="col" class="r__num">Total</th>
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
                      <datalist [id]="'series-' + it.id">
                        @for (s of it.seriesSugeridas; track s) {
                          <option [value]="s"></option>
                        }
                      </datalist>
                    } @else {
                      {{ it.serie ?? '—' }}
                    }
                  </td>
                  <td class="r__num">{{ it.cotizado }}</td>
                  @for (d of dias(); track d) {
                    <td class="r__dia">
                      @if (it.porDia) {
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
                      } @else if (puedeEditar()) {
                        <input
                          class="r__celda"
                          type="number"
                          min="0"
                          step="any"
                          [attr.aria-label]="it.codigo + ', día ' + d + ': cantidad aplicada'"
                          [value]="cantidadDia(it, d) ?? ''"
                          (change)="guardarCelda(it, d, $event)"
                        />
                      } @else {
                        {{ cantidadDia(it, d) ?? '' }}
                      }
                    </td>
                  }
                  <td class="r__num">
                    <strong
                      [class.r__total--tope]="it.cantidad >= it.cotizado && it.cotizado > 0"
                      >{{ it.cantidad }}</strong
                    >
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
                  <td [attr.colspan]="7 + dias().length" class="r__meta">
                    El pedido no trae ítems cotizados para reportar.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (puedeEditar()) {
          <div class="r__acciones">
            <dynadrill-button
              variant="secondary"
              size="small"
              (clicked)="buscando.set(!buscando())"
              >{{
                buscando() ? 'Cerrar la búsqueda' : 'Agregar otro ítem de la lista de precios'
              }}</dynadrill-button
            >
            <dynadrill-button variant="secondary" size="small" (clicked)="confirmar()">{{
              reporte()?.listadoConfirmado ? 'Reabrir el reporte' : 'Declarar el reporte completo'
            }}</dynadrill-button>
          </div>
          @if (buscando()) {
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
              <dynadrill-text variant="caption"
                >Un ítem que no está cotizado no se puede repartir hasta que el pedido lo incluya:
                proponga el cambio de ítems.</dynadrill-text
              >
            } @else if (buscado()) {
              <dynadrill-text variant="caption"
                >La lista de precios del cliente no tiene ítems con ese texto.</dynadrill-text
              >
            }
          }
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
      flex-wrap: wrap;
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
      padding: 0.375rem 0.5rem;
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
      padding-inline: 0.125rem !important;
      min-width: 3rem;
    }
    .r__num {
      text-align: right !important;
      white-space: nowrap;
    }
    .r__total--tope {
      color: var(--dynadrill-purple, #662e9b);
    }
    .r__meta {
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
    }
    .r__campo {
      width: 7rem;
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--border-default, #e0e0e0);
      border-radius: 0.375rem;
      font: inherit;
    }
    .r__celda {
      width: 3.75rem;
      padding: 0.25rem;
      text-align: center;
      border: 1px solid var(--border-default, #e0e0e0);
      border-radius: 0.375rem;
      font: inherit;
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
    .r__campo:focus-visible,
    .r__celda:focus-visible {
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
  protected readonly buscando = signal(false);
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

  /** Los días del servicio; si el ticket no trae fechas, los que ya tienen celdas. */
  protected readonly dias = computed(() => {
    const r = this.reporte();
    if (!r) return [];
    const usados = new Set(r.items.flatMap((i) => i.dias.map((d) => d.fecha)));
    if (r.fechaInicio && r.fechaFin) {
      const rango = diasEntre(r.fechaInicio, r.fechaFin);
      usados.forEach((f) => !rango.includes(f) && rango.push(f));
      return rango.sort();
    }
    return [...usados].sort();
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

  protected cantidadDia(it: ItemReporte, fecha: string): number | null {
    return it.dias.find((d) => d.fecha === fecha)?.cantidad ?? null;
  }

  /** Lo que muestra la celda de una fila por día: 1 si es operación; D o V si es daily charge o venta. */
  protected letra(it: ItemReporte, fecha: string): string {
    const m = this.marca(it, fecha);
    return !m ? '' : m === 'operacion' ? '1' : ESTADO_DIA_REPORTE_MARCA[m];
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
    alFallar?: () => void,
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
        alFallar?.();
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

  /** Celda de una fila por día: pasa a la siguiente marca del ciclo. */
  protected ciclar(it: ItemReporte, fecha: string): void {
    const siguiente = CICLO[(CICLO.indexOf(this.marca(it, fecha)) + 1) % CICLO.length];
    this.escribir(
      this.servicio.marcarDiaReporte(this.ticket().id, it.id, fecha, siguiente),
      'No se pudo marcar el día.',
    );
  }

  /** Celda de una fila con cantidad: escribirla la pone; dejarla vacía o en cero la quita. Si el servidor la rechaza vuelve el valor anterior. */
  protected guardarCelda(it: ItemReporte, fecha: string, e: Event): void {
    const campo = e.target as HTMLInputElement;
    const previo = this.cantidadDia(it, fecha);
    const texto = campo.value.trim();
    const n = texto === '' ? 0 : Number(texto);
    if (!Number.isFinite(n) || n < 0) {
      campo.value = previo === null ? '' : String(previo);
      return;
    }
    if (n === (previo ?? 0)) return;
    this.escribir(
      this.servicio.marcarDiaReporte(
        this.ticket().id,
        it.id,
        fecha,
        n > 0 ? 'operacion' : null,
        n > 0 ? n : undefined,
      ),
      'No se pudo guardar la cantidad.',
      undefined,
      () => (campo.value = previo === null ? '' : String(previo)),
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
