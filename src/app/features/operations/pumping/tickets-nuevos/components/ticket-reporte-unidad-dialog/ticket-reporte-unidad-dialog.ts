import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillTagComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
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

export interface TicketReporteUnidadDialogData {
  ticketId: string;
  vehiculoId: string;
  placa: string;
  /** Solo lectura (quien no es el operador de la unidad, o el ticket ya salió del traslado). */
  soloLectura?: boolean;
}

interface EjeForm {
  eje: string;
  origen: string;
  destino: string;
}

const numeroONulo = (v: string): number | null => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Reporte de unidad de salida (DYN-MNT-RE-012) de una unidad: fecha, combustible, origen y destino, hubodómetro por eje, llantas y la
 * inspección por secciones. Al guardarlo lo firma el operador de la unidad (con su cuenta y la hora del servidor).
 */
@Component({
  selector: 'app-ticket-reporte-unidad-dialog',
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillTagComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  template: `
    @if (reporte(); as r) {
      <div class="tr">
        <div class="tr__cabecera">
          <strong>Unidad {{ r.placa }}</strong>
          @if (r.salida.firmadaAt) {
            <dynadrill-tag label="Firmado" variant="success" [uppercase]="false" />
            <dynadrill-text variant="caption">por {{ r.salida.firmadaPor }}</dynadrill-text>
          }
        </div>

        <fieldset class="tr__bloque tr__grid">
          <legend>Datos del traslado</legend>
          <label class="tr__campo"><span>Fecha de salida</span><input type="date" [value]="fecha()" [disabled]="bloqueado()" (input)="fecha.set($any($event.target).value)" /></label>
          <dynadrill-input label="Combustible a la salida" type="number" [value]="combustible()" [disabled]="bloqueado()" (valueChange)="combustible.set($event)" />
          <dynadrill-input label="Origen" [value]="origen()" [disabled]="bloqueado()" (valueChange)="origen.set($event)" />
          <dynadrill-input label="Destino" [value]="destino()" [disabled]="bloqueado()" (valueChange)="destino.set($event)" />
        </fieldset>

        <fieldset class="tr__bloque">
          <legend>Hubodómetro por eje</legend>
          @for (e of ejes(); track e.eje; let i = $index) {
            <div class="tr__eje">
              <strong>Eje {{ e.eje }}</strong>
              <dynadrill-input label="En el origen" type="number" [value]="e.origen" [disabled]="bloqueado()" (valueChange)="cambiarEje(i, 'origen', $event)" />
              <dynadrill-input label="En el destino" type="number" [value]="e.destino" [disabled]="bloqueado()" (valueChange)="cambiarEje(i, 'destino', $event)" />
            </div>
          }
          @if (!bloqueado()) {
            <div class="tr__acciones-fila">
              <dynadrill-button variant="secondary" size="small" [disabled]="ejes().length >= 6" (clicked)="agregarEje()">Agregar eje</dynadrill-button>
              <dynadrill-button variant="secondary" size="small" [disabled]="ejes().length <= 1" (clicked)="quitarEje()">Quitar el último eje</dynadrill-button>
            </div>
          }
        </fieldset>

        <fieldset class="tr__bloque tr__grid">
          <legend>Llantas</legend>
          @for (l of llantas; track l.posicion) {
            <dynadrill-input [label]="l.etiqueta" placeholder="Estado / PSI" [value]="valorLlanta(l.posicion)" [disabled]="bloqueado()" (valueChange)="cambiarLlanta(l.posicion, $event)" />
          }
        </fieldset>

        @for (s of secciones; track s.seccion) {
          <fieldset class="tr__bloque">
            <legend>Inspección: {{ s.etiqueta }}</legend>
            @if (!bloqueado()) {
              <div class="tr__acciones-fila">
                <dynadrill-button variant="secondary" size="small" (clicked)="todoConforme(s.seccion)">Marcar todo conforme</dynadrill-button>
              </div>
            }
            <ul class="tr__items">
              @for (it of itemsDe(s.seccion); track it.itemId) {
                <li>
                  <span>{{ it.etiqueta }}</span>
                  <span class="tr__resultado" role="group" [attr.aria-label]="it.etiqueta">
                    <button type="button" class="tr__op" [class.tr__op--ok]="respuesta(it.itemId) === 'conforme'" [attr.aria-pressed]="respuesta(it.itemId) === 'conforme'" [disabled]="bloqueado()" (click)="responder(it.itemId, 'conforme')">Conforme</button>
                    <button type="button" class="tr__op" [class.tr__op--nc]="respuesta(it.itemId) === 'no_conforme'" [attr.aria-pressed]="respuesta(it.itemId) === 'no_conforme'" [disabled]="bloqueado()" (click)="responder(it.itemId, 'no_conforme')">No conforme</button>
                  </span>
                </li>
              }
            </ul>
          </fieldset>
        }

        @if (problema(); as p) {
          <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
        }
      </div>
    } @else {
      <dynadrill-text variant="body">Cargando…</dynadrill-text>
    }
    <footer class="tr__acciones">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">{{ bloqueado() ? 'Cerrar' : 'Cancelar' }}</dynadrill-button>
      @if (!bloqueado()) {
        <dynadrill-button [disabled]="!!problema() || enviando()" (clicked)="guardar()">{{ enviando() ? 'Firmando…' : 'Guardar y firmar' }}</dynadrill-button>
      }
    </footer>
  `,
  styles: `
    .tr { display: flex; flex-direction: column; gap: 14px; }
    .tr__cabecera { display: flex; align-items: center; gap: 10px; }
    .tr__bloque { border: 1px solid #ecebf1; border-radius: 8px; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
    .tr__bloque legend { padding: 0 6px; font-weight: 600; }
    .tr__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .tr__grid legend { grid-column: 1 / -1; }
    .tr__campo { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
    .tr__campo input { height: 36px; border: 1px solid #d6d3e0; border-radius: 6px; padding: 0 8px; }
    .tr__eje { display: grid; grid-template-columns: 70px 1fr 1fr; gap: 10px; align-items: end; }
    .tr__acciones-fila { display: flex; gap: 8px; }
    .tr__items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .tr__items li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 4px 0; border-bottom: 1px solid #f3f2f7; }
    .tr__resultado { display: inline-flex; gap: 4px; flex-shrink: 0; }
    .tr__op { border: 1px solid #d6d3e0; background: #fff; border-radius: 6px; padding: 3px 10px; cursor: pointer; font-size: 12px; }
    .tr__op--ok { background: #e7f6ec; border-color: #2e7d4f; color: #1f5c39; font-weight: 600; }
    .tr__op--nc { background: #fdeaea; border-color: #b3261e; color: #8c1d18; font-weight: 600; }
    .tr__op:disabled { cursor: default; }
    .tr__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class TicketReporteUnidadDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketReporteUnidadDialog, boolean>);
  private readonly data = inject<TicketReporteUnidadDialogData>(NZ_MODAL_DATA);

  protected readonly secciones = SECCIONES_INSPECCION;
  protected readonly llantas = POSICIONES_LLANTA;
  protected readonly reporte = signal<ReporteUnidad | null>(null);
  protected readonly enviando = signal(false);
  protected readonly bloqueado = computed(() => !!this.data.soloLectura);

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

  constructor() {
    this.servicio.reporteUnidad(this.data.ticketId, this.data.vehiculoId).subscribe({
      next: r => {
        this.reporte.set(r);
        if (r.salida.fecha) this.fecha.set(r.salida.fecha);
        if (r.salida.combustible !== null) this.combustible.set(String(r.salida.combustible));
        this.origen.set(r.origen ?? '');
        this.destino.set(r.destino ?? '');
        if (r.hubodometros.length) {
          const letras = [...new Set(r.hubodometros.map(h => h.eje))].sort();
          this.ejes.set(
            letras.map(eje => ({
              eje,
              origen: String(r.hubodometros.find(h => h.eje === eje && h.punto === 'origen')?.salida ?? ''),
              destino: String(r.hubodometros.find(h => h.eje === eje && h.punto === 'destino')?.salida ?? ''),
            })),
          );
        }
        this.valoresLlanta.set(Object.fromEntries(r.llantas.map(l => [l.posicion, l.salida ?? ''])));
        this.respuestas.set(Object.fromEntries(r.inspecciones.filter(i => i.salida).map(i => [i.itemId, i.salida as ResultadoInspeccion])));
      },
      error: err => this.notify.error('Error', mensajeErrorTicket(err, 'No se pudo cargar el reporte de la unidad.')),
    });
  }

  protected itemsDe(seccion: SeccionInspeccion) {
    return (this.reporte()?.inspecciones ?? []).filter(i => i.seccion === seccion);
  }
  protected respuesta(itemId: string): ResultadoInspeccion | undefined {
    return this.respuestas()[itemId];
  }
  protected responder(itemId: string, r: ResultadoInspeccion): void {
    this.respuestas.update(m => ({ ...m, [itemId]: r }));
  }
  protected todoConforme(seccion: SeccionInspeccion): void {
    this.respuestas.update(m => ({ ...m, ...Object.fromEntries(this.itemsDe(seccion).map(i => [i.itemId, 'conforme' as const])) }));
  }

  protected cambiarEje(i: number, campo: 'origen' | 'destino', v: string): void {
    this.ejes.update(l => l.map((e, k) => (k === i ? { ...e, [campo]: v } : e)));
  }
  protected agregarEje(): void {
    this.ejes.update(l => [...l, { eje: String.fromCharCode(65 + l.length), origen: '', destino: '' }]);
  }
  protected quitarEje(): void {
    this.ejes.update(l => (l.length > 1 ? l.slice(0, -1) : l));
  }

  protected valorLlanta(p: PosicionLlanta): string {
    return this.valoresLlanta()[p] ?? '';
  }
  protected cambiarLlanta(p: PosicionLlanta, v: string): void {
    this.valoresLlanta.update(m => ({ ...m, [p]: v }));
  }

  protected guardar(): void {
    if (this.problema() || this.enviando()) return;
    const cuerpo: SalidaEntrada = {
      fecha: this.fecha(),
      combustible: numeroONulo(this.combustible()) as number,
      origen: this.origen().trim(),
      destino: this.destino().trim(),
      hubodometros: this.ejes().flatMap(e => [
        { eje: e.eje, punto: 'origen' as const, salida: numeroONulo(e.origen) },
        { eje: e.eje, punto: 'destino' as const, salida: numeroONulo(e.destino) },
      ]),
      llantas: POSICIONES_LLANTA.filter(l => (this.valoresLlanta()[l.posicion] ?? '').trim() !== '').map(l => ({
        posicion: l.posicion,
        salida: (this.valoresLlanta()[l.posicion] as string).trim(),
      })),
      inspecciones: Object.entries(this.respuestas()).map(([itemId, resultado]) => ({ itemId, resultado })),
    };
    this.enviando.set(true);
    this.servicio.guardarSalida(this.data.ticketId, this.data.vehiculoId, cuerpo).subscribe({
      next: () => {
        this.notify.success('Reporte firmado', `Reporte de salida de la unidad ${this.data.placa} registrado.`);
        this.modalRef.close(true);
      },
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo guardar', mensajeErrorTicket(err, 'No se pudo guardar el reporte. Intente de nuevo.'));
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close(false);
  }
}
