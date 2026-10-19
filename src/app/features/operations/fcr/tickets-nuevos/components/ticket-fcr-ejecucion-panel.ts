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
import { DatePipe } from '@angular/common';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  ESTADO_DIA_LABELS,
  ESTADO_DIA_TONO,
  ESTADO_USO_LABELS,
  PASO_EJECUCION,
  mensajeErrorTicket,
  type BitacoraTicket,
  type DiaBitacora,
  type HerramientaTicket,
  type TicketFcr,
  type UsoTicket,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';
import {
  TicketFcrBitacoraDialog,
  type TicketFcrBitacoraDialogData,
} from './ticket-fcr-bitacora-dialog';
import { TicketFcrFechaDialog, type TicketFcrFechaDialogData } from './ticket-fcr-fecha-dialog';
import { TicketFcrUsoDialog, type TicketFcrUsoDialogData } from './ticket-fcr-uso-dialog';

/**
 * Ejecución: la bitácora de cada día (se envía a Facturación día por día) y el uso diario de las herramientas. El operador del equipo
 * escribe mientras el ticket está en ejecución; después se consulta. Al terminar, «Finalizar ejecución» envía el Reporte de Herramientas
 * y pasa a la revisión de reportes.
 */
@Component({
  selector: 'app-ticket-fcr-ejecucion-panel',
  imports: [
    DatePipe,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p" aria-label="Bitácora y uso de herramientas">
      <h2>Bitácora diaria</h2>
      @if (error(); as e) {
        <dynadrill-banner variant="warning" [message]="e" />
      }
      <dynadrill-spinner mode="overlay" [spinning]="cargando() || ocupado()" tip="Procesando…">
        @if (puedeEditar()) {
          <div class="p__acciones">
            <dynadrill-button variant="secondary" size="small" (clicked)="diaNuevo()"
              >Registrar un día</dynadrill-button
            >
          </div>
        }
        <ul class="p__lista">
          @for (d of bitacora()?.dias ?? []; track d.fecha) {
            <li>
              <strong>{{ d.fecha }}</strong>
              <dynadrill-tag [label]="estadoDia(d)" [variant]="tonoDia(d)" [uppercase]="false" />
              <span class="p__meta"
                >{{ d.actividades }} actividad(es) · {{ d.totalHoras }} h
                @if (d.enviadaAt) {
                  · enviado {{ d.enviadaAt | date: 'dd/MM HH:mm' }}
                }
              </span>
              <dynadrill-button variant="secondary" size="small" (clicked)="abrirDia(d.fecha)">{{
                puedeEditar() && d.estado !== 'corregido' ? 'Editar' : 'Ver'
              }}</dynadrill-button>
              @if (puedeEditar() && d.estado === 'borrador' && d.actividades > 0) {
                <dynadrill-button variant="primary" size="small" (clicked)="enviarDia(d.fecha)"
                  >Enviar a Facturación</dynadrill-button
                >
              }
            </li>
          } @empty {
            <li class="p__meta">Todavía no hay días registrados.</li>
          }
        </ul>

        <h2>Uso de las herramientas</h2>
        @if (puedeEditar()) {
          <div class="p__acciones">
            <dynadrill-button
              variant="secondary"
              size="small"
              [disabled]="!recibidas().length"
              (clicked)="registrarUso()"
              >Registrar uso de una herramienta</dynadrill-button
            >
            <dynadrill-button variant="secondary" size="small" (clicked)="confirmarUso()">{{
              uso()?.listadoConfirmado
                ? 'Deshacer la confirmación del listado de uso'
                : 'Confirmar que el listado de uso está completo'
            }}</dynadrill-button>
          </div>
        } @else if (uso()?.listadoConfirmado) {
          <dynadrill-tag label="Listado de uso confirmado" variant="success" [uppercase]="false" />
        }
        <div class="p__tabla">
          <table>
            <caption class="sr-only">
              Uso diario de las herramientas
            </caption>
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Herramienta</th>
                <th scope="col">Estado de cobro</th>
                <th scope="col">Completación o trabajo</th>
                <th scope="col">Picker</th>
                <th scope="col">Presión / peso</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (u of uso()?.usos ?? []; track u.id) {
                <tr>
                  <td>{{ u.fecha }}</td>
                  <td>
                    {{ u.nombre }} <span class="p__meta">{{ u.codigo }}</span>
                  </td>
                  <td>{{ estadoUso(u.estado) }}</td>
                  <td>{{ u.tipoCompletacion ?? u.tipoTrabajo ?? '—' }}</td>
                  <td>{{ u.tipoPicker ?? '—' }}</td>
                  <td>
                    {{ u.presion ?? '—' }} / {{ u.peso ?? '—' }}
                    @if (u.observacion) {
                      <div class="p__nov">{{ u.observacion }}</div>
                    }
                  </td>
                  <td>
                    @if (puedeEditar()) {
                      <dynadrill-button variant="secondary" size="small" (clicked)="quitarUso(u.id)"
                        >Quitar</dynadrill-button
                      >
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="p__meta">Todavía no hay uso registrado.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (puedeEditar()) {
          <div class="p__acciones" role="group" aria-label="Finalizar la ejecución">
            <dynadrill-button variant="primary" (clicked)="finalizar()"
              >Finalizar ejecución y enviar los reportes</dynadrill-button
            >
          </div>
          <dynadrill-text variant="caption"
            >Exige la bitácora enviada (todos sus días) y el listado de uso confirmado. Al finalizar
            se envía el Reporte de Herramientas a Facturación y usted ya no corrige.</dynadrill-text
          >
        }
      </dynadrill-spinner>
    </section>
  `,
  styles: `
    .p {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #ecebf1);
      border-radius: 14px;
    }
    .p h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }
    .p__acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .p__lista {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
    }
    .p__lista li {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
    }
    .p__meta {
      font-size: 12px;
      color: #5c5870;
    }
    .p__nov {
      font-size: 12px;
      color: #8a4b00;
    }
    .p__tabla {
      overflow-x: auto;
    }
    .p__tabla table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .p__tabla th,
    .p__tabla td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #ecebf1;
      vertical-align: top;
    }
  `,
})
export class TicketFcrEjecucionPanel {
  private readonly servicio = inject(TicketsFcrService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly ticket = input.required<TicketFcr>();
  readonly cambio = output<void>();

  protected readonly bitacora = signal<BitacoraTicket | null>(null);
  protected readonly uso = signal<UsoTicket | null>(null);
  private readonly herramientas = signal<HerramientaTicket[]>([]);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly estadoDia = (d: DiaBitacora) => ESTADO_DIA_LABELS[d.estado];
  protected readonly tonoDia = (d: DiaBitacora) => ESTADO_DIA_TONO[d.estado];
  protected readonly estadoUso = (e: keyof typeof ESTADO_USO_LABELS) => ESTADO_USO_LABELS[e];
  protected readonly recibidas = computed(() =>
    this.herramientas().filter((h) => h.estado === 'recibida'),
  );
  /** El operador del equipo, mientras el ticket está en ejecución. */
  protected readonly puedeEditar = computed(
    () => this.ticket().paso.codigo === PASO_EJECUCION && this.ticket().puedeActuar,
  );

  constructor() {
    effect(() => {
      this.ticket().version;
      this.cargar();
    });
  }

  private cargar(): void {
    const id = this.ticket().id;
    this.cargando.set(true);
    this.servicio
      .bitacora(id)
      .subscribe({
        next: (b) => this.bitacora.set(b),
        error: (err) => this.error.set(mensajeErrorTicket(err, 'No se pudo cargar la bitácora.')),
      });
    this.servicio.uso(id).subscribe({
      next: (u) => {
        this.uso.set(u);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar el uso de las herramientas.'));
      },
    });
    this.servicio
      .herramientas(id)
      .subscribe({
        next: (h) => this.herramientas.set(h.herramientas),
        error: () => this.herramientas.set([]),
      });
  }

  private hoyEnServicio(): string {
    const s = this.bitacora()?.servicio;
    const hoy = new Date().toISOString().slice(0, 10);
    if (s?.desde && hoy < s.desde) return s.desde;
    if (s?.hasta && hoy > s.hasta) return s.hasta;
    return hoy;
  }

  protected diaNuevo(): void {
    const s = this.bitacora()?.servicio;
    const ref = this.dialog.open<TicketFcrFechaDialog, TicketFcrFechaDialogData>({
      title: 'Registrar un día de la bitácora',
      content: TicketFcrFechaDialog,
      data: {
        mensaje: 'Elija el día. Debe estar dentro de las fechas del servicio del pedido.',
        etiqueta: 'Día',
        inicial: this.hoyEnServicio(),
        desde: s?.desde,
        hasta: s?.hasta,
        confirmar: 'Continuar',
      },
      footer: false,
      width: '440px',
    });
    ref.afterClose.subscribe((f: string | undefined) => f && this.abrirDia(f));
  }

  protected abrirDia(fecha: string): void {
    const t = this.ticket();
    const ref = this.dialog.open<TicketFcrBitacoraDialog, TicketFcrBitacoraDialogData>({
      title: 'Bitácora del día',
      content: TicketFcrBitacoraDialog,
      data: { ticketId: t.id, fecha, puedeEditar: this.puedeEditar() },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((hubo: boolean | undefined) => {
      if (hubo) {
        this.cargar();
        this.cambio.emit();
      }
    });
  }

  protected enviarDia(fecha: string): void {
    this.ocupado.set(true);
    this.servicio.enviarDia(this.ticket().id, fecha).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success('Día enviado a Facturación', fecha);
        this.cargar();
        this.cambio.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo enviar el día.'));
      },
    });
  }

  protected registrarUso(): void {
    const t = this.ticket();
    const ref = this.dialog.open<TicketFcrUsoDialog, TicketFcrUsoDialogData>({
      title: 'Uso de una herramienta',
      content: TicketFcrUsoDialog,
      data: {
        ticketId: t.id,
        tipoOt: t.tipoOt,
        herramientas: this.herramientas(),
        servicio: this.bitacora()?.servicio ?? { desde: null, hasta: null },
        fecha: this.hoyEnServicio(),
      },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe((u: UsoTicket | undefined) => {
      if (u) {
        this.uso.set(u);
        this.cambio.emit();
      }
    });
  }

  protected quitarUso(usoId: string): void {
    this.ocupado.set(true);
    this.servicio.quitarUso(this.ticket().id, usoId).subscribe({
      next: (u) => {
        this.ocupado.set(false);
        this.uso.set(u);
        this.cambio.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo quitar el registro.'));
      },
    });
  }

  protected confirmarUso(): void {
    this.ocupado.set(true);
    this.servicio.confirmarListadoUso(this.ticket().id, !this.uso()?.listadoConfirmado).subscribe({
      next: (u) => {
        this.ocupado.set(false);
        this.uso.set(u);
        this.cambio.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo confirmar el listado.'));
      },
    });
  }

  protected finalizar(): void {
    this.ocupado.set(true);
    this.error.set(null);
    this.servicio.finalizarEjecucion(this.ticket().id).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success(
          'Ejecución finalizada',
          'Se envió el Reporte de Herramientas y el ticket pasa a la revisión de reportes.',
        );
        this.cambio.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo finalizar la ejecución.'));
      },
    });
  }
}
