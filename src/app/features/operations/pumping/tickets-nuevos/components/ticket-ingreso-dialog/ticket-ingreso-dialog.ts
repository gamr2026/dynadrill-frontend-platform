import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  CONFIRMACIONES_INGRESO,
  mensajeErrorTicket,
  ultimaLecturaPorGas,
  type ConfirmacionIngreso,
  type GasIngreso,
  type IngresoLocacion,
} from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketIngresoDialogData {
  ticketId: string;
  /** Solo lectura (quien no es del equipo, o el ticket ya salió del traslado). */
  soloLectura?: boolean;
}

/**
 * Checklist de ingreso a locación y verificaciones de seguridad: cinco confirmaciones, la medición de cuatro gases (la última
 * lectura de cada uno debe ser segura) y los ítems de bloqueo y etiquetado (LOTO). Cada cambio se guarda al instante.
 */
@Component({
  selector: 'app-ticket-ingreso-dialog',
  imports: [DynadrillButtonComponent, DynadrillCheckboxComponent, DynadrillInputComponent, DynadrillTagComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    @if (ingreso(); as i) {
      <div class="ti">
        <dynadrill-tag [label]="i.completo ? 'Completo' : 'Incompleto'" [variant]="i.completo ? 'success' : 'warning'" [uppercase]="false" />

        <fieldset class="ti__bloque">
          <legend>Confirmaciones</legend>
          @for (c of confirmaciones; track c.clave) {
            <dynadrill-checkbox [label]="c.etiqueta" [checked]="i[c.clave]" [disabled]="bloqueado()" (checkedChange)="cambiarConfirmacion(c.clave, $event)" />
          }
        </fieldset>

        <fieldset class="ti__bloque">
          <legend>Gases (la última lectura de cada uno debe ser segura)</legend>
          @for (l of i.limites; track l.gas) {
            <div class="ti__gas">
              <div class="ti__gas-nombre">
                <strong>{{ l.nombre }}</strong>
                <dynadrill-text variant="caption">{{ rango(l.minimo, l.maximo, l.unidad) }}</dynadrill-text>
              </div>
              @if (ultimas().get(l.gas); as u) {
                <dynadrill-tag [label]="u.lectura + ' ' + l.unidad + (u.seguro ? ' · seguro' : ' · NO seguro')" [variant]="u.seguro ? 'success' : 'error'" [uppercase]="false" />
              } @else {
                <dynadrill-tag label="Sin lectura" variant="neutral" [uppercase]="false" />
              }
              @if (!bloqueado()) {
                <dynadrill-input type="number" placeholder="Lectura" [value]="lecturas()[l.gas] ?? ''" (valueChange)="fijarLectura(l.gas, $event)" />
                <dynadrill-button variant="secondary" size="small" [disabled]="!lecturas()[l.gas]" (clicked)="registrarLectura(l.gas)">Registrar</dynadrill-button>
              }
            </div>
          }
        </fieldset>

        <fieldset class="ti__bloque">
          <legend>Bloqueo y etiquetado (LOTO)</legend>
          @for (x of i.loto; track x.itemId) {
            <dynadrill-checkbox [label]="x.etiqueta" [checked]="x.marcado" [disabled]="bloqueado()" (checkedChange)="alternarLoto(x.itemId)" />
          }
          @if (i.lotoNotificadoClienteAt) {
            <dynadrill-text variant="caption">LOTO completo: queda anotada la notificación al cliente.</dynadrill-text>
          }
        </fieldset>

        @if (i.completo && i.confirmadoPor) {
          <dynadrill-text variant="caption">Completado por {{ i.confirmadoPor }}.</dynadrill-text>
        }
      </div>
    } @else {
      <dynadrill-text variant="body">Cargando…</dynadrill-text>
    }
    <footer class="ti__acciones">
      <dynadrill-button (clicked)="cerrar()">Cerrar</dynadrill-button>
    </footer>
  `,
  styles: `
    .ti { display: flex; flex-direction: column; gap: 14px; }
    .ti__bloque { border: 1px solid #ecebf1; border-radius: 8px; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
    .ti__bloque legend { padding: 0 6px; font-weight: 600; }
    .ti__gas { display: grid; grid-template-columns: 1.3fr auto 110px auto; gap: 8px; align-items: center; }
    .ti__gas-nombre { display: flex; flex-direction: column; }
    .ti__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class TicketIngresoDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketIngresoDialog, boolean>);
  private readonly data = inject<TicketIngresoDialogData>(NZ_MODAL_DATA);

  protected readonly confirmaciones = CONFIRMACIONES_INGRESO;
  protected readonly ingreso = signal<IngresoLocacion | null>(null);
  protected readonly lecturas = signal<Partial<Record<GasIngreso, string>>>({});
  protected readonly ultimas = computed(() => (this.ingreso() ? ultimaLecturaPorGas(this.ingreso()!) : new Map()));
  protected readonly bloqueado = computed(() => !!this.data.soloLectura);
  private hayCambios = false;

  constructor() {
    this.servicio.ingreso(this.data.ticketId).subscribe({
      next: i => this.ingreso.set(i),
      error: err => this.notify.error('Error', mensajeErrorTicket(err, 'No se pudo cargar el checklist de ingreso.')),
    });
  }

  protected rango(min: number | null, max: number, unidad: string): string {
    return min !== null ? `entre ${min} y ${max} ${unidad}` : `menor a ${max} ${unidad}`;
  }

  private aplicar(obs: ReturnType<TicketsPumpingService['ingreso']>): void {
    obs.subscribe({
      next: i => {
        this.ingreso.set(i);
        this.hayCambios = true;
      },
      error: err => this.notify.error('No se pudo guardar', mensajeErrorTicket(err, 'No se pudo guardar el cambio. Intente de nuevo.')),
    });
  }

  protected cambiarConfirmacion(clave: ConfirmacionIngreso, valor: boolean): void {
    this.aplicar(this.servicio.actualizarIngreso(this.data.ticketId, { [clave]: valor }));
  }

  protected alternarLoto(itemId: string): void {
    this.aplicar(this.servicio.alternarLoto(this.data.ticketId, itemId));
  }

  protected fijarLectura(gas: GasIngreso, valor: string): void {
    this.lecturas.update(l => ({ ...l, [gas]: valor }));
  }

  protected registrarLectura(gas: GasIngreso): void {
    const n = Number(this.lecturas()[gas]);
    if (!Number.isFinite(n) || n < 0) return;
    this.aplicar(this.servicio.actualizarIngreso(this.data.ticketId, { nuevaLectura: { gas, lectura: n } }));
    this.lecturas.update(l => ({ ...l, [gas]: '' }));
  }

  protected cerrar(): void {
    this.modalRef.close(this.hayCambios);
  }
}
