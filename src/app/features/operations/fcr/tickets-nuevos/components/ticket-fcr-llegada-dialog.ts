import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  mensajeErrorTicket,
  validarLlegada,
  type ReporteLlegada,
  type UnidadLlegada,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

export interface TicketFcrLlegadaDialogData {
  ticketId: string;
  vehiculoId: string;
  placa: string;
  /** Reporte ya firmado (solo se consulta). */
  reporte: ReporteLlegada | null;
  /** Solo el operador asignado a la unidad firma. */
  puedeFirmar: boolean;
}

/** Reporte de unidad de llegada (DYN-MNT-RE-012): lo firma el operador de la unidad; firmado, es un documento y no se cambia. */
@Component({
  selector: 'app-ticket-fcr-llegada-dialog',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillCheckboxComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="l">
      @if (error(); as e) {
        <dynadrill-banner variant="critical" [message]="e" />
      }
      @if (data.reporte; as r) {
        <dynadrill-text variant="caption"
          >Firmado por {{ r.firmadaPor }}: el reporte ya no se cambia.</dynadrill-text
        >
      }
      <div class="l__fila">
        <label class="l__fecha"
          ><span>Día de la llegada</span
          ><input
            type="date"
            [value]="fecha()"
            [disabled]="!editable"
            (input)="fecha.set($any($event.target).value)"
        /></label>
        <dynadrill-input
          label="Combustible (galones)"
          type="number"
          [value]="combustible()"
          [disabled]="!editable"
          (valueChange)="combustible.set($event)"
        />
      </div>
      <dynadrill-textarea
        label="Novedades de mecánica"
        [rows]="2"
        [value]="mecanica()"
        [disabled]="!editable"
        (valueChange)="mecanica.set($event)"
      />
      <dynadrill-textarea
        label="Novedades de instrumentación"
        [rows]="2"
        [value]="instrumentacion()"
        [disabled]="!editable"
        (valueChange)="instrumentacion.set($event)"
      />
      <dynadrill-textarea
        label="Novedades de operaciones"
        [rows]="2"
        [value]="operaciones()"
        [disabled]="!editable"
        (valueChange)="operaciones.set($event)"
      />
      <dynadrill-checkbox
        label="La unidad quedó lista para otro servicio"
        [checked]="lista()"
        [disabled]="!editable"
        (checkedChange)="lista.set($event)"
      />
      <dynadrill-checkbox
        label="La operación se interrumpió"
        [checked]="interrumpida()"
        [disabled]="!editable"
        (checkedChange)="interrumpida.set($event)"
      />
      @if (interrumpida()) {
        <dynadrill-textarea
          label="Por qué se interrumpió"
          [rows]="2"
          [value]="detalle()"
          [disabled]="!editable"
          (valueChange)="detalle.set($event)"
        />
      }
      @if (problema(); as p) {
        <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
      }
    </div>
    <footer class="l__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cerrar</dynadrill-button>
      @if (editable) {
        <dynadrill-button [disabled]="!!problema() || enviando()" (clicked)="firmar()">{{
          enviando() ? 'Firmando…' : 'Firmar el reporte de la unidad ' + data.placa
        }}</dynadrill-button>
      }
    </footer>
  `,
  styles: `
    .l {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .l__fila {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      align-items: end;
    }
    .l__fecha {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: #5c5870;
    }
    .l__fecha input {
      padding: 8px 10px;
      border: 1px solid #ccc9d9;
      border-radius: 8px;
      font: inherit;
    }
    .l__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class TicketFcrLlegadaDialog {
  private readonly servicio = inject(TicketsFcrService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<TicketFcrLlegadaDialog, UnidadLlegada[] | undefined>,
  );
  protected readonly data = inject<TicketFcrLlegadaDialogData>(NZ_MODAL_DATA);
  protected readonly editable = this.data.puedeFirmar && !this.data.reporte;

  private readonly r = this.data.reporte;
  protected readonly fecha = signal(this.r?.fecha ?? '');
  protected readonly combustible = signal(
    this.r?.combustible === null || this.r?.combustible === undefined
      ? ''
      : String(this.r.combustible),
  );
  protected readonly mecanica = signal(this.r?.novedadesMecanica ?? '');
  protected readonly instrumentacion = signal(this.r?.novedadesInstrumentacion ?? '');
  protected readonly operaciones = signal(this.r?.novedadesOperaciones ?? '');
  protected readonly lista = signal(this.r?.unidadLista ?? true);
  protected readonly interrumpida = signal(this.r?.operacionInterrumpida ?? false);
  protected readonly detalle = signal(this.r?.detalleInterrupcion ?? '');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly problema = computed(() =>
    this.editable
      ? validarLlegada({
          fecha: this.fecha(),
          combustible: this.combustible().trim() === '' ? null : Number(this.combustible()),
          operacionInterrumpida: this.interrumpida(),
          detalleInterrupcion: this.detalle(),
        })
      : null,
  );

  protected firmar(): void {
    if (this.problema() || this.enviando()) return;
    this.enviando.set(true);
    this.error.set(null);
    const t = (v: string) => (v.trim() ? v.trim() : undefined);
    this.servicio
      .firmarLlegada(this.data.ticketId, this.data.vehiculoId, {
        fecha: this.fecha(),
        combustible: Number(this.combustible()),
        novedadesMecanica: t(this.mecanica()),
        novedadesInstrumentacion: t(this.instrumentacion()),
        novedadesOperaciones: t(this.operaciones()),
        unidadLista: this.lista(),
        operacionInterrumpida: this.interrumpida(),
        detalleInterrupcion: this.interrumpida() ? t(this.detalle()) : undefined,
      })
      .subscribe({
        next: (l) => {
          this.notify.success(
            'Reporte firmado',
            `Unidad ${this.data.placa}. Mantenimiento recibirá el reporte.`,
          );
          this.modalRef.close(l);
        },
        error: (err) => {
          this.enviando.set(false);
          this.error.set(mensajeErrorTicket(err, 'No se pudo firmar el reporte.'));
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
