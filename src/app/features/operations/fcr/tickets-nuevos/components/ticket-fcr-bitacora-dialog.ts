import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { concatMap, type Observable } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADO_DIA_LABELS,
  ESTADO_DIA_TONO,
  duracionHoras,
  mensajeErrorTicket,
  validarActividades,
  type ActividadBitacora,
  type DiaBitacoraDetalle,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

export interface TicketFcrBitacoraDialogData {
  ticketId: string;
  fecha: string;
  /** El operador del equipo puede escribir; los demás solo consultan. */
  puedeEditar: boolean;
}

const VACIA = (): ActividadBitacora => ({ horaInicio: '', horaFin: '', detalle: '' });

/**
 * Bitácora de un día (el Reporte Job). El operador la envía a Facturación día por día, sin aprobación; si corrige un día ya enviado, se
 * reenvía solo. Un día que Facturación corrigió ya no se edita desde el ticket.
 */
@Component({
  selector: 'app-ticket-fcr-bitacora-dialog',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <dynadrill-spinner mode="overlay" [spinning]="cargando() || ocupado()" tip="Procesando…">
      @if (error(); as e) {
        <dynadrill-banner variant="critical" [message]="e" />
      }
      <div class="b">
        <header class="b__cabecera">
          <strong>Día {{ data.fecha }}</strong>
          @if (dia(); as d) {
            <dynadrill-tag [label]="estadoTxt()" [variant]="estadoTono()" [uppercase]="false" />
            <span class="b__meta">{{ d.totalHoras }} h registradas</span>
          } @else {
            <dynadrill-tag label="Día nuevo" variant="neutral" [uppercase]="false" />
          }
        </header>
        @if (bloqueado()) {
          <dynadrill-banner
            variant="warning"
            message="Facturación corrigió este día: ya no se puede editar ni reenviar desde el ticket."
          />
        } @else if (dia()?.estado === 'enviado' && editable()) {
          <dynadrill-text variant="caption"
            >Este día ya se envió a Facturación: si lo corrige, se reenvía solo con lo
            nuevo.</dynadrill-text
          >
        }

        @for (a of filas(); track $index; let i = $index) {
          <fieldset class="b__fila">
            <legend>
              Actividad {{ i + 1 }}
              @if (horas(a); as h) {
                · {{ h }} h
              }
            </legend>
            <label class="b__hora"
              ><span>Hora de inicio</span
              ><input
                type="time"
                [value]="a.horaInicio"
                [disabled]="!editable()"
                (input)="cambiar(i, 'horaInicio', $any($event.target).value)"
            /></label>
            <label class="b__hora"
              ><span>Hora de fin</span
              ><input
                type="time"
                [value]="a.horaFin"
                [disabled]="!editable()"
                (input)="cambiar(i, 'horaFin', $any($event.target).value)"
            /></label>
            <dynadrill-textarea
              label="Detalle"
              [rows]="2"
              [value]="a.detalle"
              [disabled]="!editable()"
              (valueChange)="cambiar(i, 'detalle', $event)"
            />
            @if (editable()) {
              <button
                type="button"
                class="b__quitar"
                [attr.aria-label]="'Quitar la actividad ' + (i + 1)"
                (click)="quitar(i)"
              >
                Quitar
              </button>
            }
          </fieldset>
        }
        @if (editable()) {
          <div>
            <dynadrill-button variant="secondary" size="small" (clicked)="agregar()"
              >Agregar actividad</dynadrill-button
            >
          </div>
        }
        @if (problema(); as p) {
          <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
        }
      </div>
      <footer class="b__acciones">
        <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
        @if (editable()) {
          <dynadrill-button
            variant="secondary"
            [disabled]="!!problema() || ocupado()"
            (clicked)="guardar(false)"
            >Guardar</dynadrill-button
          >
          @if (dia()?.estado !== 'enviado') {
            <dynadrill-button
              variant="primary"
              [disabled]="!!problema() || ocupado() || !filas().length"
              (clicked)="guardar(true)"
              >Guardar y enviar a Facturación</dynadrill-button
            >
          }
        }
      </footer>
    </dynadrill-spinner>
  `,
  styles: `
    .b {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .b__cabecera {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .b__meta {
      font-size: 12px;
      color: #5c5870;
    }
    .b__fila {
      border: 1px solid #ecebf1;
      border-radius: 8px;
      padding: 8px 12px 12px;
      display: grid;
      grid-template-columns: 140px 140px 1fr auto;
      gap: 10px;
      align-items: end;
    }
    .b__fila legend {
      padding: 0 6px;
      font-weight: 600;
      font-size: 13px;
    }
    .b__hora {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: #5c5870;
    }
    .b__hora input {
      padding: 8px 10px;
      border: 1px solid #ccc9d9;
      border-radius: 8px;
      font: inherit;
    }
    .b__quitar {
      background: none;
      border: 0;
      color: #5c5870;
      text-decoration: underline;
      cursor: pointer;
      padding-bottom: 10px;
    }
    .b__acciones {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
    @media (max-width: 720px) {
      .b__fila {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class TicketFcrBitacoraDialog {
  private readonly servicio = inject(TicketsFcrService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketFcrBitacoraDialog, boolean | undefined>);
  protected readonly data = inject<TicketFcrBitacoraDialogData>(NZ_MODAL_DATA);

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dia = signal<DiaBitacoraDetalle | null>(null);
  protected readonly filas = signal<ActividadBitacora[]>([VACIA()]);
  private hubo = false;

  protected readonly bloqueado = computed(() => this.dia()?.estado === 'corregido');
  protected readonly editable = computed(() => this.data.puedeEditar && !this.bloqueado());
  protected readonly problema = computed(() =>
    this.editable() ? validarActividades(this.filas()) : null,
  );
  protected readonly estadoTxt = computed(
    () => ESTADO_DIA_LABELS[this.dia()?.estado ?? 'borrador'],
  );
  protected readonly estadoTono = computed(() => ESTADO_DIA_TONO[this.dia()?.estado ?? 'borrador']);

  constructor() {
    this.servicio.dia(this.data.ticketId, this.data.fecha).subscribe({
      next: (d) => {
        this.aplicar(d);
        this.cargando.set(false);
      },
      // un día sin bitácora todavía devuelve 404: se empieza uno nuevo
      error: (err) => {
        this.cargando.set(false);
        if ((err as { status?: number })?.status !== 404)
          this.error.set(mensajeErrorTicket(err, 'No se pudo cargar el día.'));
      },
    });
  }

  protected horas(a: ActividadBitacora): number | null {
    return a.horaInicio && a.horaFin && a.horaInicio !== a.horaFin
      ? duracionHoras(a.horaInicio, a.horaFin)
      : null;
  }

  protected cambiar(i: number, campo: keyof ActividadBitacora, valor: string): void {
    this.filas.update((l) => l.map((a, k) => (k === i ? { ...a, [campo]: valor } : a)));
  }
  protected agregar(): void {
    this.filas.update((l) => [...l, VACIA()]);
  }
  protected quitar(i: number): void {
    this.filas.update((l) => l.filter((_, k) => k !== i));
  }

  private aplicar(d: DiaBitacoraDetalle): void {
    this.dia.set(d);
    this.filas.set(
      d.actividades.length
        ? d.actividades.map((a) => ({
            horaInicio: a.horaInicio,
            horaFin: a.horaFin,
            detalle: a.detalle,
          }))
        : [VACIA()],
    );
  }

  protected guardar(enviar: boolean): void {
    if (this.problema() || this.ocupado()) return;
    const guardado$: Observable<DiaBitacoraDetalle> = this.servicio.guardarDia(
      this.data.ticketId,
      this.data.fecha,
      this.filas().map((a) => ({ ...a, detalle: a.detalle.trim() })),
    );
    this.ocupado.set(true);
    this.error.set(null);
    (enviar
      ? guardado$.pipe(
          concatMap(() => this.servicio.enviarDia(this.data.ticketId, this.data.fecha)),
        )
      : guardado$
    ).subscribe({
      next: (d) => {
        this.ocupado.set(false);
        this.hubo = true;
        this.aplicar(d);
        this.notify.success(
          enviar ? 'Día enviado a Facturación' : 'Día guardado',
          `Bitácora del ${this.data.fecha}.`,
        );
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo guardar el día.'));
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close(this.hubo);
  }
}
