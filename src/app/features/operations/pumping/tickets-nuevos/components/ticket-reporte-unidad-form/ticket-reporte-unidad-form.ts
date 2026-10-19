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
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  POSICIONES_LLANTA,
  SECCIONES_INSPECCION,
  mensajeErrorTicket,
  type PosicionLlanta,
  type ReporteUnidad,
  type ResultadoInspeccion,
  type SalidaEntrada,
  type SeccionInspeccion,
} from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

interface EjeForm {
  eje: string;
  origen: string;
  destino: string;
}

const numeroONulo = (v: string): number | null =>
  v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const hoy = () => {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

/**
 * Reporte de Unidad — Salida (DYN-MNT-RE-012) dentro de la página del ticket, con el diseño de la demo: información general, fecha, ruta y
 * combustible, neumáticos, hubodómetro e inspección por secciones. Lo firma el operador de la unidad al enviarlo (con su cuenta y la hora del
 * servidor). La misma lógica y las mismas reglas que la ventana del reporte: solo cambia dónde se muestra.
 */
@Component({
  selector: 'app-ticket-reporte-unidad-form',
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rf__titulo" aria-label="Reporte de Unidad — Salida">
      <h2>Reporte de Unidad — Salida</h2>
      <p>Documento: DYN-MNT-RE-012</p>
      @if (reporte()?.salida?.firmadaAt) {
        <div class="rf__firma">
          <dynadrill-tag label="Firmado" variant="success" [uppercase]="false" />
          <span>por {{ reporte()?.salida?.firmadaPor }}</span>
        </div>
      }
    </section>

    @if (reporte(); as r) {
      <section class="rf__tarjeta" aria-label="Información general">
        <h3>Información general</h3>
        <div class="rf__grid rf__grid--2">
          <dynadrill-input label="Pozo" [value]="pozo()" [disabled]="true" />
          <dynadrill-input label="Campo" [value]="campo()" [disabled]="true" />
          <dynadrill-input label="Bloque" [value]="bloque()" [disabled]="true" />
        </div>
        <div class="rf__grid rf__grid--2">
          <dynadrill-input label="Cliente" [value]="cliente()" [disabled]="true" />
          <dynadrill-input label="Unidad" [value]="r.placa" [disabled]="true" />
        </div>
      </section>

      <section class="rf__tarjeta" aria-label="Fecha, ruta y combustible">
        <h3>Fecha, ruta y combustible</h3>
        <div class="rf__grid rf__grid--4">
          <label class="rf__campo"
            ><span>Fecha de salida</span
            ><input
              type="date"
              [value]="fecha()"
              [disabled]="bloqueado()"
              (input)="fecha.set($any($event.target).value)"
          /></label>
          <dynadrill-input
            label="Origen"
            placeholder="Ej. Base Coco"
            [value]="origen()"
            [disabled]="bloqueado()"
            (valueChange)="origen.set($event)"
          />
          <dynadrill-input
            label="Destino"
            placeholder="Ej. Pozo Beta-9"
            [value]="destino()"
            [disabled]="bloqueado()"
            (valueChange)="destino.set($event)"
          />
          <dynadrill-input
            label="Combustible salida (gal)"
            type="number"
            placeholder="Ej. 45"
            [value]="combustible()"
            [disabled]="bloqueado()"
            (valueChange)="combustible.set($event)"
          />
        </div>
        <p class="rf__nota">
          Origen/Destino se usan para precargar el Gerenciamiento de Viaje más adelante.
        </p>
      </section>

      <section class="rf__tarjeta" aria-label="Neumáticos">
        <h3>Neumáticos</h3>
        <p class="rf__nota">
          Presión de aire (PSI) por llanta — <strong>máximo 4</strong> (delantera/trasera x
          izq/der).
        </p>
        <div class="rf__tabla" role="group" aria-label="Presión de aire por llanta">
          <div class="rf__tabla-cab">
            @for (l of llantas; track l.posicion) {
              <span>{{ l.etiqueta }}</span>
            }
          </div>
          <div class="rf__tabla-fila">
            <strong>Salida</strong>
            @for (l of llantas; track l.posicion) {
              <input
                type="text"
                inputmode="decimal"
                placeholder="PSI"
                [attr.aria-label]="'PSI ' + l.etiqueta"
                [value]="valorLlanta(l.posicion)"
                [disabled]="bloqueado()"
                (input)="cambiarLlanta(l.posicion, $any($event.target).value)"
              />
            }
          </div>
        </div>
      </section>

      <section class="rf__tarjeta" aria-label="Hubodómetro">
        <h3>Hubodómetro</h3>
        <p class="rf__nota">Lectura por eje — trayecto de ida (Origen → Destino).</p>
        @for (e of ejes(); track e.eje; let i = $index) {
          <div class="rf__eje">
            <strong>Eje {{ e.eje }}</strong>
            <input
              type="number"
              placeholder="Origen"
              [attr.aria-label]="'Eje ' + e.eje + ' origen'"
              [value]="e.origen"
              [disabled]="bloqueado()"
              (input)="cambiarEje(i, 'origen', $any($event.target).value)"
            />
            <span aria-hidden="true">→</span>
            <input
              type="number"
              placeholder="Destino"
              [attr.aria-label]="'Eje ' + e.eje + ' destino'"
              [value]="e.destino"
              [disabled]="bloqueado()"
              (input)="cambiarEje(i, 'destino', $any($event.target).value)"
            />
            @if (!bloqueado() && ejes().length > 1) {
              <button
                type="button"
                class="rf__quitar"
                [attr.aria-label]="'Quitar el eje ' + e.eje"
                (click)="quitarEje(i)"
              >
                ✕
              </button>
            }
          </div>
        }
        @if (!bloqueado()) {
          <div>
            <dynadrill-button
              variant="secondary"
              size="small"
              [disabled]="ejes().length >= 6"
              (clicked)="agregarEje()"
              >+ Agregar lectura de eje</dynadrill-button
            >
          </div>
        }
      </section>

      <section class="rf__tarjeta" aria-label="Inspección">
        <h3>Inspección</h3>
        <p class="rf__nota">Inspección: Indique con ✓ OK · ✕ defectuoso</p>
      </section>
      @for (s of secciones; track s.seccion) {
        <details class="rf__seccion">
          <summary>{{ s.etiqueta }}</summary>
          @if (!bloqueado()) {
            <div class="rf__acciones-fila">
              <dynadrill-button variant="secondary" size="small" (clicked)="todoConforme(s.seccion)"
                >Marcar todo ✓</dynadrill-button
              >
            </div>
          }
          <ul class="rf__items">
            @for (it of itemsDe(s.seccion); track it.itemId) {
              <li>
                <span>{{ it.etiqueta }}</span>
                <span class="rf__resultado" role="group" [attr.aria-label]="it.etiqueta">
                  <button
                    type="button"
                    class="rf__op"
                    [class.rf__op--ok]="respuesta(it.itemId) === 'conforme'"
                    [attr.aria-pressed]="respuesta(it.itemId) === 'conforme'"
                    aria-label="OK"
                    [disabled]="bloqueado()"
                    (click)="responder(it.itemId, 'conforme')"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    class="rf__op"
                    [class.rf__op--nc]="respuesta(it.itemId) === 'no_conforme'"
                    [attr.aria-pressed]="respuesta(it.itemId) === 'no_conforme'"
                    aria-label="Defectuoso"
                    [disabled]="bloqueado()"
                    (click)="responder(it.itemId, 'no_conforme')"
                  >
                    ✕
                  </button>
                </span>
              </li>
            }
          </ul>
        </details>
      }
      @if (problema(); as p) {
        @if (!bloqueado()) {
          <p class="rf__nota" role="status">{{ p }}</p>
        }
      }
    } @else {
      <p class="rf__nota">Cargando el reporte de la unidad…</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .rf__titulo h2 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      color: #1d1b26;
    }
    .rf__titulo p {
      margin: 6px 0 0;
      font-size: 12px;
      color: #5c5870;
    }
    .rf__firma {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      font-size: 13px;
      color: #5c5870;
    }
    .rf__tarjeta {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px 24px;
      background: #fff;
      border: 1px solid #ecebf1;
      border-radius: 14px;
    }
    .rf__tarjeta h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
      color: #2c2b35;
    }
    .rf__nota {
      margin: 0;
      font-size: 12px;
      color: #5c5870;
    }
    .rf__grid {
      display: grid;
      gap: 12px;
    }
    .rf__grid--2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .rf__grid--4 {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .rf__campo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
    }
    .rf__campo input,
    .rf__tabla-fila input,
    .rf__eje input {
      height: 36px;
      border: 1px solid #d6d3e0;
      border-radius: 6px;
      padding: 0 8px;
      font: inherit;
      background: #fff;
      min-width: 0;
    }
    .rf__campo input:disabled,
    .rf__tabla-fila input:disabled,
    .rf__eje input:disabled {
      background: #f4f3f8;
    }
    .rf__tabla {
      display: flex;
      flex-direction: column;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #ecebf1;
    }
    .rf__tabla-cab,
    .rf__tabla-fila {
      display: grid;
      grid-template-columns: 70px repeat(4, minmax(0, 1fr));
      gap: 10px;
      align-items: center;
      padding: 8px 12px;
    }
    .rf__tabla-cab {
      background: #6c2fa0;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
    }
    .rf__tabla-cab::before {
      content: '';
    }
    .rf__eje {
      display: grid;
      grid-template-columns: 60px minmax(0, 1fr) 20px minmax(0, 1fr) 24px;
      gap: 10px;
      align-items: center;
    }
    .rf__quitar {
      background: none;
      border: 0;
      color: #8a869c;
      cursor: pointer;
      font-size: 14px;
    }
    .rf__seccion {
      background: #fff;
      border: 1px solid #ecebf1;
      border-radius: 14px;
      padding: 14px 24px;
    }
    .rf__seccion summary {
      cursor: pointer;
      font-weight: 600;
    }
    .rf__acciones-fila {
      margin: 10px 0;
    }
    .rf__items {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rf__items li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid #f3f2f7;
      font-size: 13px;
    }
    .rf__resultado {
      display: inline-flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .rf__op {
      width: 32px;
      height: 28px;
      border: 1px solid #d6d3e0;
      background: #fff;
      border-radius: 6px;
      cursor: pointer;
    }
    .rf__op--ok {
      background: #e7f6ec;
      border-color: #2e7d4f;
      color: #1f5c39;
      font-weight: 700;
    }
    .rf__op--nc {
      background: #fdeaea;
      border-color: #b3261e;
      color: #8c1d18;
      font-weight: 700;
    }
    .rf__op:disabled {
      cursor: default;
    }
    @media (max-width: 840px) {
      .rf__grid--2,
      .rf__grid--4 {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class TicketReporteUnidadForm {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly ticketId = input.required<string>();
  readonly vehiculoId = input.required<string>();
  readonly placa = input.required<string>();
  readonly cliente = input('');
  readonly pozo = input('');
  readonly campo = input('');
  readonly bloque = input('');
  /** Solo lectura (quien no es el operador de la unidad, o el ticket ya salió del traslado). */
  readonly soloLectura = input(false);

  /** El reporte quedó firmado: la página recarga el ticket. */
  readonly firmado = output<void>();

  protected readonly secciones = SECCIONES_INSPECCION;
  protected readonly llantas = POSICIONES_LLANTA;
  protected readonly reporte = signal<ReporteUnidad | null>(null);
  readonly enviando = signal(false);
  protected readonly bloqueado = computed(
    () => this.soloLectura() || !!this.reporte()?.salida.firmadaAt,
  );

  protected readonly fecha = signal(hoy());
  protected readonly combustible = signal('');
  protected readonly origen = signal('');
  protected readonly destino = signal('');
  protected readonly ejes = signal<EjeForm[]>([
    { eje: 'A', origen: '', destino: '' },
    { eje: 'B', origen: '', destino: '' },
  ]);
  private readonly valoresLlanta = signal<Partial<Record<PosicionLlanta, string>>>({});
  private readonly respuestas = signal<Record<string, ResultadoInspeccion>>({});

  protected readonly problema = computed(() => {
    if (!this.fecha()) return 'Indique la fecha de salida.';
    if (numeroONulo(this.combustible()) === null) return 'Indique el combustible a la salida.';
    if (!this.origen().trim() || !this.destino().trim()) return 'Indique el origen y el destino.';
    return null;
  });

  /** Lo usa la barra de la página para habilitar "Enviar reporte de unidad de salida". */
  readonly puedeEnviar = computed(
    () => !this.bloqueado() && !this.problema() && !this.enviando() && !!this.reporte(),
  );

  constructor() {
    effect(() => {
      const ticketId = this.ticketId();
      const vehiculoId = this.vehiculoId();
      this.servicio.reporteUnidad(ticketId, vehiculoId).subscribe({
        next: (r) => {
          this.reporte.set(r);
          if (r.salida.fecha) this.fecha.set(r.salida.fecha);
          if (r.salida.combustible !== null) this.combustible.set(String(r.salida.combustible));
          this.origen.set(r.origen ?? '');
          this.destino.set(r.destino ?? '');
          if (r.hubodometros.length) {
            const letras = [...new Set(r.hubodometros.map((h) => h.eje))].sort();
            this.ejes.set(
              letras.map((eje) => ({
                eje,
                origen: String(
                  r.hubodometros.find((h) => h.eje === eje && h.punto === 'origen')?.salida ?? '',
                ),
                destino: String(
                  r.hubodometros.find((h) => h.eje === eje && h.punto === 'destino')?.salida ?? '',
                ),
              })),
            );
          }
          this.valoresLlanta.set(
            Object.fromEntries(r.llantas.map((l) => [l.posicion, l.salida ?? ''])),
          );
          this.respuestas.set(
            Object.fromEntries(
              r.inspecciones
                .filter((i) => i.salida)
                .map((i) => [i.itemId, i.salida as ResultadoInspeccion]),
            ),
          );
        },
        error: (err) =>
          this.notify.error(
            'Error',
            mensajeErrorTicket(err, 'No se pudo cargar el reporte de la unidad.'),
          ),
      });
    });
  }

  protected itemsDe(seccion: SeccionInspeccion) {
    return (this.reporte()?.inspecciones ?? []).filter((i) => i.seccion === seccion);
  }
  protected respuesta(itemId: string): ResultadoInspeccion | undefined {
    return this.respuestas()[itemId];
  }
  protected responder(itemId: string, r: ResultadoInspeccion): void {
    this.respuestas.update((m) => ({ ...m, [itemId]: r }));
  }
  protected todoConforme(seccion: SeccionInspeccion): void {
    this.respuestas.update((m) => ({
      ...m,
      ...Object.fromEntries(this.itemsDe(seccion).map((i) => [i.itemId, 'conforme' as const])),
    }));
  }

  protected cambiarEje(i: number, campo: 'origen' | 'destino', v: string): void {
    this.ejes.update((l) => l.map((e, k) => (k === i ? { ...e, [campo]: v } : e)));
  }
  protected agregarEje(): void {
    this.ejes.update((l) => [
      ...l,
      { eje: String.fromCharCode(65 + l.length), origen: '', destino: '' },
    ]);
  }
  protected quitarEje(i: number): void {
    this.ejes.update((l) => (l.length > 1 ? l.filter((_, k) => k !== i) : l));
  }

  protected valorLlanta(p: PosicionLlanta): string {
    return this.valoresLlanta()[p] ?? '';
  }
  protected cambiarLlanta(p: PosicionLlanta, v: string): void {
    this.valoresLlanta.update((m) => ({ ...m, [p]: v }));
  }

  /** Guarda y firma el reporte (lo llama el botón de la barra de la página). */
  enviar(): void {
    if (!this.puedeEnviar()) return;
    const cuerpo: SalidaEntrada = {
      fecha: this.fecha(),
      combustible: numeroONulo(this.combustible()) as number,
      origen: this.origen().trim(),
      destino: this.destino().trim(),
      hubodometros: this.ejes().flatMap((e) => [
        { eje: e.eje, punto: 'origen' as const, salida: numeroONulo(e.origen) },
        { eje: e.eje, punto: 'destino' as const, salida: numeroONulo(e.destino) },
      ]),
      llantas: POSICIONES_LLANTA.filter(
        (l) => (this.valoresLlanta()[l.posicion] ?? '').trim() !== '',
      ).map((l) => ({
        posicion: l.posicion,
        salida: (this.valoresLlanta()[l.posicion] as string).trim(),
      })),
      inspecciones: Object.entries(this.respuestas()).map(([itemId, resultado]) => ({
        itemId,
        resultado,
      })),
    };
    this.enviando.set(true);
    this.servicio.guardarSalida(this.ticketId(), this.vehiculoId(), cuerpo).subscribe({
      next: () => {
        this.enviando.set(false);
        this.notify.success(
          'Reporte firmado',
          `Reporte de salida de la unidad ${this.placa()} registrado.`,
        );
        this.firmado.emit();
      },
      error: (err) => {
        this.enviando.set(false);
        this.notify.error(
          'No se pudo guardar',
          mensajeErrorTicket(err, 'No se pudo guardar el reporte. Intente de nuevo.'),
        );
      },
    });
  }
}
