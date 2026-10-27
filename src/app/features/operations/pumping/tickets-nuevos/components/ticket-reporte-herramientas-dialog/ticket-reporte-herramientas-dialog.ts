import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { Observable } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADO_DIA_HERRAMIENTA_LABELS,
  ESTADO_DIA_HERRAMIENTA_MARCA,
  mensajeErrorTicket,
  type EstadoDiaHerramienta,
  type LineaReporteHerramientas,
  type ReporteHerramientasPumping,
} from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketReporteHerramientasDialogData {
  ticketId: string;
  /** Número del ticket (el de la prefactura), para el encabezado. */
  ticketCodigo?: string;
  /** Solo lectura: quien no es Operador del equipo o el ticket ya salió de la Ejecución operativa. */
  soloLectura?: boolean;
}

/** Orden del ciclo al pulsar el día de una línea por día: vacío → operación → daily charge → venta → vacío. */
const CICLO: Array<EstadoDiaHerramienta | null> = [null, 'operacion', 'daily_charge', 'venta'];

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
 * Reporte de Herramientas de un ticket de Pumping, como el de FCR pero sin selección de herramientas ni inspecciones: las filas son las líneas
 * cotizadas del pedido (la movilización no va) y el operador reparte cada cantidad en los días del servicio. En las líneas por día pulsa la
 * celda (1 operación; D daily charge; V venta) y en las demás escribe la cantidad aplicada ese día. Lo reportado no puede superar lo cotizado;
 * para pasarse se propone el cambio de ítems del pedido. Al completarlo se envía a Facturación.
 */
@Component({
  selector: 'app-ticket-reporte-herramientas-dialog',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  template: `
    <dynadrill-spinner mode="overlay" [spinning]="cargando()" tip="Cargando el reporte…">
      <div class="r">
        <dynadrill-text variant="caption"
          >Reporte de herramientas · Ticket {{ data.ticketCodigo ?? '—' }}</dynadrill-text
        >
        @if (error(); as e) {
          <dynadrill-banner variant="warning" [message]="e" />
        }
        @if (reporte()?.completadoAt) {
          <dynadrill-tag
            label="Completo y enviado a Facturación"
            variant="success"
            [uppercase]="false"
          />
        }
        @if (puedeEditar()) {
          <dynadrill-text variant="caption"
            >Reparta la cantidad de cada ítem en los días del servicio. En los ítems por día pulse la
            celda para marcarla (1 = operación; vuelva a pulsar para D daily charge, V venta o quitarla);
            en los demás escriba la cantidad aplicada ese día. Lo reportado no puede superar lo
            cotizado.</dynadrill-text
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
                <th scope="col" class="r__num">Cotizado</th>
                @for (d of dias(); track d) {
                  <th scope="col" class="r__dia">{{ etiquetaDia(d) }}</th>
                }
                <th scope="col" class="r__num">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (l of reporte()?.lineas ?? []; track l.id) {
                <tr>
                  <th scope="row">{{ l.codigo }}</th>
                  <td>{{ l.descripcion }}</td>
                  <td>{{ l.unidad }}</td>
                  <td class="r__num">{{ l.cotizado }}</td>
                  @for (d of dias(); track d) {
                    <td class="r__dia">
                      @if (l.porDia) {
                        @if (puedeEditar()) {
                          <button
                            type="button"
                            class="r__marca"
                            [class.r__marca--on]="!!marca(l, d)"
                            [attr.aria-label]="descripcionMarca(l, d)"
                            (click)="ciclar(l, d)"
                          >
                            {{ letra(l, d) }}
                          </button>
                        } @else {
                          {{ letra(l, d) }}
                        }
                      } @else if (puedeEditar()) {
                        <input
                          class="r__celda"
                          type="number"
                          min="0"
                          step="any"
                          [attr.aria-label]="l.codigo + ', día ' + d + ': cantidad aplicada'"
                          [value]="cantidadDia(l, d) ?? ''"
                          (change)="guardarCelda(l, d, $event)"
                        />
                      } @else {
                        {{ cantidadDia(l, d) ?? '' }}
                      }
                    </td>
                  }
                  <td class="r__num">
                    <strong [class.r__total--tope]="l.cantidad >= l.cotizado && l.cotizado > 0">{{
                      l.cantidad
                    }}</strong>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="5 + dias().length" class="r__meta">
                    El pedido no trae ítems cotizados para reportar.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="r__acciones">
          <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
          @if (puedeEditar()) {
            <dynadrill-button
              variant="primary"
              [disabled]="ocupado() || !hayCantidades()"
              (clicked)="completar()"
              >{{
                reporte()?.completadoAt ? 'Volver a enviar' : 'Declarar el reporte completo'
              }}</dynadrill-button
            >
          }
        </div>
      </div>
    </dynadrill-spinner>
  `,
  styles: `
    .r {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .r__acciones {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
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
    .r__celda:focus-visible {
      outline: 2px solid var(--dynadrill-purple, #662e9b);
      outline-offset: 2px;
    }
  `,
})
export class TicketReporteHerramientasDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketReporteHerramientasDialog, boolean>);
  protected readonly data = inject<TicketReporteHerramientasDialogData>(NZ_MODAL_DATA);

  protected readonly reporte = signal<ReporteHerramientasPumping | null>(null);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Hubo un cambio: al cerrar, la página recarga lo que muestra. */
  private cambio = false;

  protected readonly puedeEditar = computed(() => !this.data.soloLectura);
  protected readonly hayCantidades = computed(() =>
    (this.reporte()?.lineas ?? []).some((l) => l.cantidad > 0),
  );

  /** Los días del servicio; si el ticket no trae fechas, los que ya tienen celdas. */
  protected readonly dias = computed(() => {
    const r = this.reporte();
    if (!r) return [];
    const usados = new Set(r.lineas.flatMap((l) => l.dias.map((d) => d.fecha)));
    if (r.fechaInicio && r.fechaFin) {
      const rango = diasEntre(r.fechaInicio, r.fechaFin);
      usados.forEach((f) => !rango.includes(f) && rango.push(f));
      return rango.sort();
    }
    return [...usados].sort();
  });

  constructor() {
    this.servicio.reporteHerramientas(this.data.ticketId).subscribe({
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

  protected etiquetaDia(fecha: string): string {
    return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  }

  protected marca(l: LineaReporteHerramientas, fecha: string): EstadoDiaHerramienta | null {
    return l.dias.find((d) => d.fecha === fecha)?.estado ?? null;
  }

  protected cantidadDia(l: LineaReporteHerramientas, fecha: string): number | null {
    return l.dias.find((d) => d.fecha === fecha)?.cantidad ?? null;
  }

  protected letra(l: LineaReporteHerramientas, fecha: string): string {
    const m = this.marca(l, fecha);
    return m ? ESTADO_DIA_HERRAMIENTA_MARCA[m] : '';
  }

  protected descripcionMarca(l: LineaReporteHerramientas, fecha: string): string {
    const m = this.marca(l, fecha);
    return `${l.codigo}, día ${fecha}: ${m ? ESTADO_DIA_HERRAMIENTA_LABELS[m] : 'sin marca'}`;
  }

  /** Corre una escritura del reporte: muestra el nuevo reporte o el error. */
  private escribir(
    peticion: Observable<ReporteHerramientasPumping>,
    mensajeError: string,
    alTerminar?: () => void,
    alFallar?: () => void,
  ): void {
    this.ocupado.set(true);
    this.error.set(null);
    peticion.subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.cambio = true;
        this.reporte.set(r);
        alTerminar?.();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, mensajeError));
        alFallar?.();
        this.servicio.reporteHerramientas(this.data.ticketId).subscribe((r) => this.reporte.set(r));
      },
    });
  }

  /** Celda de una línea por día: pasa a la siguiente marca del ciclo. */
  protected ciclar(l: LineaReporteHerramientas, fecha: string): void {
    const siguiente = CICLO[(CICLO.indexOf(this.marca(l, fecha)) + 1) % CICLO.length];
    this.escribir(
      this.servicio.marcarDiaHerramienta(this.data.ticketId, l.id, fecha, siguiente),
      'No se pudo marcar el día.',
    );
  }

  /** Celda de una línea con cantidad: escribirla la pone; dejarla vacía o en cero la quita. Si el servidor la rechaza vuelve el valor anterior. */
  protected guardarCelda(l: LineaReporteHerramientas, fecha: string, e: Event): void {
    const campo = e.target as HTMLInputElement;
    const previo = this.cantidadDia(l, fecha);
    const texto = campo.value.trim();
    const n = texto === '' ? 0 : Number(texto);
    if (!Number.isFinite(n) || n < 0) {
      campo.value = previo === null ? '' : String(previo);
      return;
    }
    if (n === (previo ?? 0)) return;
    this.escribir(
      this.servicio.marcarDiaHerramienta(
        this.data.ticketId,
        l.id,
        fecha,
        n > 0 ? 'operacion' : null,
        n > 0 ? n : undefined,
      ),
      'No se pudo guardar la cantidad.',
      undefined,
      () => (campo.value = previo === null ? '' : String(previo)),
    );
  }

  protected completar(): void {
    this.escribir(
      this.servicio.completarReporteHerramientas(this.data.ticketId),
      'No se pudo completar el reporte.',
      () =>
        this.notify.success(
          'Reporte de herramientas completo',
          'Se envió a Facturación como documento operativo.',
        ),
    );
  }

  protected cerrar(): void {
    this.modalRef.close(this.cambio);
  }
}
