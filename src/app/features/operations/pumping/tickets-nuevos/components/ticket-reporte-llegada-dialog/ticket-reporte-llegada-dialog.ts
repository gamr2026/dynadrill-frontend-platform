import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  POSICIONES_LLANTA,
  SECCIONES_INSPECCION,
  mensajeErrorTicket,
  validarLlegada,
  type LlegadaEntrada,
  type PosicionLlanta,
  type ReporteUnidad,
  type ResultadoInspeccion,
  type SeccionInspeccion,
} from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketReporteLlegadaDialogData {
  ticketId: string;
  unidadId: string;
  placa: string;
  /** Solo lectura (quien no es el operador de la unidad, o el ticket ya salió del traslado de llegada). */
  soloLectura?: boolean;
}

const numeroONulo = (v: string): number | null =>
  v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Reporte de unidad de llegada (DYN-MNT-RE-012) de una unidad: fecha y combustible, hubodómetro y llantas a la llegada, la inspección
 * por secciones y las novedades por área. Lo firma el operador de la unidad. Con novedades, el reporte llega solo a Mantenimiento.
 */
@Component({
  selector: 'app-ticket-reporte-llegada-dialog',
  imports: [
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  template: `
    @if (reporte(); as r) {
      <div class="tl">
        <div class="tl__cabecera">
          <strong>Unidad {{ r.placa }}</strong>
          @if (r.llegada.firmadaAt) {
            <dynadrill-tag label="Firmado" variant="success" [uppercase]="false" />
          }
          <dynadrill-text variant="caption"
            >Salió el {{ r.salida.fecha ?? '—' }} con {{ r.salida.combustible ?? '—' }} de
            combustible</dynadrill-text
          >
        </div>

        <fieldset class="tl__bloque tl__grid">
          <legend>Datos de la llegada</legend>
          <label class="tl__campo"
            ><span>Fecha de llegada</span
            ><input
              type="date"
              [value]="fecha()"
              [disabled]="bloqueado()"
              (input)="fecha.set($any($event.target).value)"
          /></label>
          <dynadrill-input
            label="Combustible a la llegada"
            type="number"
            [value]="combustible()"
            [disabled]="bloqueado()"
            (valueChange)="combustible.set($event)"
          />
        </fieldset>

        <fieldset class="tl__bloque">
          <legend>Hubodómetro por eje (a la llegada)</legend>
          @for (e of ejes(); track e.eje; let i = $index) {
            <div class="tl__eje">
              <strong>Eje {{ e.eje }}</strong>
              <dynadrill-input
                label="En el origen"
                type="number"
                [value]="e.origen"
                [disabled]="bloqueado()"
                (valueChange)="cambiarEje(i, 'origen', $event)"
              />
              <dynadrill-input
                label="En el destino"
                type="number"
                [value]="e.destino"
                [disabled]="bloqueado()"
                (valueChange)="cambiarEje(i, 'destino', $event)"
              />
            </div>
          } @empty {
            <dynadrill-text variant="caption">La salida no registró hubodómetro.</dynadrill-text>
          }
        </fieldset>

        <fieldset class="tl__bloque tl__grid">
          <legend>Llantas</legend>
          @for (l of llantas; track l.posicion) {
            <dynadrill-input
              [label]="l.etiqueta"
              placeholder="Estado / PSI"
              [value]="valorLlanta(l.posicion)"
              [disabled]="bloqueado()"
              (valueChange)="cambiarLlanta(l.posicion, $event)"
            />
          }
        </fieldset>

        @for (s of secciones; track s.seccion) {
          <fieldset class="tl__bloque">
            <legend>Inspección: {{ s.etiqueta }}</legend>
            @if (!bloqueado()) {
              <div class="tl__fila-acciones">
                <dynadrill-button
                  variant="secondary"
                  size="small"
                  (clicked)="todoConforme(s.seccion)"
                  >Marcar todo conforme</dynadrill-button
                >
              </div>
            }
            <ul class="tl__items">
              @for (it of itemsDe(s.seccion); track it.itemId) {
                <li>
                  <span
                    >{{ it.etiqueta }}
                    @if (it.salida) {
                      <span class="tl__salida"
                        >(salida: {{ it.salida === 'conforme' ? 'conforme' : 'no conforme' }})</span
                      >
                    }
                  </span>
                  <span class="tl__resultado" role="group" [attr.aria-label]="it.etiqueta">
                    <button
                      type="button"
                      class="tl__op"
                      [class.tl__op--ok]="respuesta(it.itemId) === 'conforme'"
                      [attr.aria-pressed]="respuesta(it.itemId) === 'conforme'"
                      [disabled]="bloqueado()"
                      (click)="responder(it.itemId, 'conforme')"
                    >
                      Conforme
                    </button>
                    <button
                      type="button"
                      class="tl__op"
                      [class.tl__op--nc]="respuesta(it.itemId) === 'no_conforme'"
                      [attr.aria-pressed]="respuesta(it.itemId) === 'no_conforme'"
                      [disabled]="bloqueado()"
                      (click)="responder(it.itemId, 'no_conforme')"
                    >
                      No conforme
                    </button>
                  </span>
                </li>
              }
            </ul>
          </fieldset>
        }

        <fieldset class="tl__bloque">
          <legend>Novedades de la unidad</legend>
          <dynadrill-text variant="caption"
            >Lo que escriba aquí le llega a Mantenimiento para clasificarlo. Déjelo vacío si no hay
            novedades.</dynadrill-text
          >
          <dynadrill-textarea
            label="Mecánica"
            [rows]="2"
            [value]="novedadesMecanica()"
            [disabled]="bloqueado()"
            (valueChange)="novedadesMecanica.set($event)"
          />
          <dynadrill-textarea
            label="Instrumentación"
            [rows]="2"
            [value]="novedadesInstrumentacion()"
            [disabled]="bloqueado()"
            (valueChange)="novedadesInstrumentacion.set($event)"
          />
          <dynadrill-textarea
            label="Operaciones"
            [rows]="2"
            [value]="novedadesOperaciones()"
            [disabled]="bloqueado()"
            (valueChange)="novedadesOperaciones.set($event)"
          />
        </fieldset>

        <fieldset class="tl__bloque">
          <legend>Operatividad</legend>
          <label class="tl__check"
            ><input
              type="checkbox"
              [checked]="unidadLista()"
              [disabled]="bloqueado()"
              (change)="unidadLista.set($any($event.target).checked)"
            />
            La unidad queda lista para la siguiente operación</label
          >
          <label class="tl__check"
            ><input
              type="checkbox"
              [checked]="operacionInterrumpida()"
              [disabled]="bloqueado()"
              (change)="operacionInterrumpida.set($any($event.target).checked)"
            />
            La unidad interrumpió o atrasó la operación</label
          >
          @if (operacionInterrumpida()) {
            <dynadrill-textarea
              label="Cuente qué pasó"
              [rows]="2"
              [value]="detalleInterrupcion()"
              [disabled]="bloqueado()"
              (valueChange)="detalleInterrupcion.set($event)"
            />
          }
        </fieldset>

        @if (problema(); as p) {
          <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
        }
      </div>
    } @else {
      <dynadrill-text variant="body">Cargando…</dynadrill-text>
    }
    <footer class="tl__acciones">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">{{
        bloqueado() ? 'Cerrar' : 'Cancelar'
      }}</dynadrill-button>
      @if (!bloqueado()) {
        <dynadrill-button [disabled]="!!problema() || enviando()" (clicked)="guardar()">{{
          enviando() ? 'Firmando…' : 'Guardar y firmar'
        }}</dynadrill-button>
      }
    </footer>
  `,
  styles: `
    .tl {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .tl__cabecera {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .tl__bloque {
      border: 1px solid #ecebf1;
      border-radius: 8px;
      padding: 8px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .tl__bloque legend {
      padding: 0 6px;
      font-weight: 600;
    }
    .tl__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .tl__grid legend {
      grid-column: 1 / -1;
    }
    .tl__campo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
    }
    .tl__campo input {
      height: 36px;
      border: 1px solid #d6d3e0;
      border-radius: 6px;
      padding: 0 8px;
    }
    .tl__eje {
      display: grid;
      grid-template-columns: 70px 1fr 1fr;
      gap: 10px;
      align-items: end;
    }
    .tl__fila-acciones {
      display: flex;
      gap: 8px;
    }
    .tl__items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .tl__items li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 4px 0;
      border-bottom: 1px solid #f3f2f7;
    }
    .tl__salida {
      font-size: 12px;
      color: #5c5870;
    }
    .tl__resultado {
      display: inline-flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .tl__op {
      border: 1px solid #d6d3e0;
      background: #fff;
      border-radius: 6px;
      padding: 3px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .tl__op--ok {
      background: #e7f6ec;
      border-color: #2e7d4f;
      color: #1f5c39;
      font-weight: 600;
    }
    .tl__op--nc {
      background: #fdeaea;
      border-color: #b3261e;
      color: #8c1d18;
      font-weight: 600;
    }
    .tl__op:disabled {
      cursor: default;
    }
    .tl__check {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .tl__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class TicketReporteLlegadaDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketReporteLlegadaDialog, boolean>);
  private readonly data = inject<TicketReporteLlegadaDialogData>(NZ_MODAL_DATA);

  protected readonly secciones = SECCIONES_INSPECCION;
  protected readonly llantas = POSICIONES_LLANTA;
  protected readonly reporte = signal<ReporteUnidad | null>(null);
  protected readonly enviando = signal(false);
  protected readonly bloqueado = computed(() => !!this.data.soloLectura);

  protected readonly fecha = signal(hoy());
  protected readonly combustible = signal('');
  protected readonly ejes = signal<Array<{ eje: string; origen: string; destino: string }>>([]);
  private readonly valoresLlanta = signal<Partial<Record<PosicionLlanta, string>>>({});
  private readonly respuestas = signal<Record<string, ResultadoInspeccion>>({});
  protected readonly novedadesMecanica = signal('');
  protected readonly novedadesInstrumentacion = signal('');
  protected readonly novedadesOperaciones = signal('');
  protected readonly unidadLista = signal(true);
  protected readonly operacionInterrumpida = signal(false);
  protected readonly detalleInterrupcion = signal('');

  protected readonly problema = computed(() =>
    validarLlegada({
      fecha: this.fecha(),
      combustible: numeroONulo(this.combustible()),
      operacionInterrumpida: this.operacionInterrumpida(),
      detalleInterrupcion: this.detalleInterrupcion(),
    }),
  );

  constructor() {
    this.servicio.reporteUnidad(this.data.ticketId, this.data.unidadId).subscribe({
      next: (r) => {
        this.reporte.set(r);
        const l = r.llegada;
        if (l.fecha) this.fecha.set(l.fecha);
        if (l.combustible !== null) this.combustible.set(String(l.combustible));
        // los ejes son los que la salida registró; la llegada solo agrega sus lecturas
        const letras = [...new Set(r.hubodometros.map((h) => h.eje))].sort();
        this.ejes.set(
          letras.map((eje) => ({
            eje,
            origen: String(
              r.hubodometros.find((h) => h.eje === eje && h.punto === 'origen')?.llegada ?? '',
            ),
            destino: String(
              r.hubodometros.find((h) => h.eje === eje && h.punto === 'destino')?.llegada ?? '',
            ),
          })),
        );
        this.valoresLlanta.set(
          Object.fromEntries(r.llantas.map((x) => [x.posicion, x.llegada ?? ''])),
        );
        this.respuestas.set(
          Object.fromEntries(
            r.inspecciones
              .filter((i) => i.llegada)
              .map((i) => [i.itemId, i.llegada as ResultadoInspeccion]),
          ),
        );
        this.novedadesMecanica.set(l.novedadesMecanica ?? '');
        this.novedadesInstrumentacion.set(l.novedadesInstrumentacion ?? '');
        this.novedadesOperaciones.set(l.novedadesOperaciones ?? '');
        if (l.unidadLista !== null) this.unidadLista.set(l.unidadLista);
        this.operacionInterrumpida.set(l.operacionInterrumpida ?? false);
        this.detalleInterrupcion.set(l.detalleInterrupcion ?? '');
      },
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeErrorTicket(err, 'No se pudo cargar el reporte de la unidad.'),
        ),
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
  protected valorLlanta(p: PosicionLlanta): string {
    return this.valoresLlanta()[p] ?? '';
  }
  protected cambiarLlanta(p: PosicionLlanta, v: string): void {
    this.valoresLlanta.update((m) => ({ ...m, [p]: v }));
  }

  protected guardar(): void {
    if (this.problema() || this.enviando()) return;
    const cuerpo: LlegadaEntrada = {
      fecha: this.fecha(),
      combustible: numeroONulo(this.combustible()) as number,
      hubodometros: this.ejes().flatMap((e) => [
        { eje: e.eje, punto: 'origen' as const, llegada: numeroONulo(e.origen) },
        { eje: e.eje, punto: 'destino' as const, llegada: numeroONulo(e.destino) },
      ]),
      llantas: POSICIONES_LLANTA.filter(
        (l) => (this.valoresLlanta()[l.posicion] ?? '').trim() !== '',
      ).map((l) => ({
        posicion: l.posicion,
        llegada: (this.valoresLlanta()[l.posicion] as string).trim(),
      })),
      inspecciones: Object.entries(this.respuestas()).map(([itemId, resultado]) => ({
        itemId,
        resultado,
      })),
      novedadesMecanica: this.novedadesMecanica().trim() || undefined,
      novedadesInstrumentacion: this.novedadesInstrumentacion().trim() || undefined,
      novedadesOperaciones: this.novedadesOperaciones().trim() || undefined,
      unidadLista: this.unidadLista(),
      operacionInterrumpida: this.operacionInterrumpida(),
      detalleInterrupcion: this.operacionInterrumpida()
        ? this.detalleInterrupcion().trim()
        : undefined,
    };
    this.enviando.set(true);
    this.servicio.guardarLlegada(this.data.ticketId, this.data.unidadId, cuerpo).subscribe({
      next: () => {
        this.notify.success(
          'Reporte firmado',
          `Reporte de llegada de la unidad ${this.data.placa} registrado.`,
        );
        this.modalRef.close(true);
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

  protected cerrar(): void {
    this.modalRef.close(false);
  }
}
