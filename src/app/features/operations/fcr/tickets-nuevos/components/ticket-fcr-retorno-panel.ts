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
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  ESTADO_HERRAMIENTA_LABELS,
  ESTADO_HERRAMIENTA_TONO,
  PASO_RETORNO,
  PERMISO_FCR_BODEGA,
  mensajeErrorTicket,
  type HerramientaTicket,
  type TicketFcr,
  type UnidadLlegada,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';
import {
  TicketFcrFaltanteDialog,
  type FaltanteResultado,
  type TicketFcrFaltanteDialogData,
} from './ticket-fcr-faltante-dialog';
import {
  TicketFcrLlegadaDialog,
  type TicketFcrLlegadaDialogData,
} from './ticket-fcr-llegada-dialog';

/**
 * Control de retorno: Bodega registra cada herramienta como devuelta o faltante (con causa y detalle), y el operador de cada unidad firma
 * su reporte de llegada. Sin eso el ticket no pasa al cierre.
 */
@Component({
  selector: 'app-ticket-fcr-retorno-panel',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p" aria-label="Control de retorno">
      <h2>Retorno de herramientas</h2>
      @if (error(); as e) {
        <dynadrill-banner variant="warning" [message]="e" />
      }
      <dynadrill-spinner mode="overlay" [spinning]="cargando() || ocupado()" tip="Procesando…">
        @if (puedeRegistrar() && porRetornar().length) {
          <div class="p__acciones">
            <dynadrill-button variant="primary" size="small" (clicked)="devolverTodas()"
              >Devolver todas las recibidas</dynadrill-button
            >
          </div>
        }
        <ul class="p__lista">
          @for (h of herramientas(); track h.id) {
            <li>
              <span
                >{{ h.nombre }}
                <span class="p__meta"
                  >{{ h.codigo }}{{ h.numeroSerie ? ' · serie ' + h.numeroSerie : '' }}</span
                ></span
              >
              <dynadrill-tag
                [label]="estadoTxt(h.estado)"
                [variant]="tono(h.estado)"
                [uppercase]="false"
              />
              @if (h.faltanteMotivo) {
                <span class="p__nov">{{ h.faltanteMotivo }}</span>
              }
              @if (puedeRegistrar() && h.estado === 'recibida') {
                <dynadrill-button variant="secondary" size="small" (clicked)="devolver(h)"
                  >Devuelta</dynadrill-button
                >
                <dynadrill-button variant="secondary" size="small" (clicked)="faltante(h)"
                  >Faltante…</dynadrill-button
                >
              }
            </li>
          } @empty {
            <li class="p__meta">El ticket no tiene herramientas.</li>
          }
        </ul>

        @if (llegadas().length) {
          <h2>Reporte de unidad de llegada</h2>
          <ul class="p__lista">
            @for (u of llegadas(); track u.vehiculoId) {
              <li>
                <span
                  >{{ u.placa }}
                  <span class="p__meta">· {{ u.operador?.nombre ?? 'Sin operador' }}</span></span
                >
                <dynadrill-tag
                  [label]="u.reporte ? 'Firmado' : 'Pendiente'"
                  [variant]="u.reporte ? 'success' : 'warning'"
                  [uppercase]="false"
                />
                <dynadrill-button variant="secondary" size="small" (clicked)="abrirLlegada(u)">{{
                  !u.reporte && puedeFirmar(u) ? 'Llenar y firmar' : 'Ver'
                }}</dynadrill-button>
              </li>
            }
          </ul>
        }
      </dynadrill-spinner>
    </section>
  `,
  styles: `
    .p {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.5rem;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 0.75rem;
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(19, 21, 41, 0.05));
    }
    .p h2 {
      margin: 0;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--dynadrill-purple, #662e9b);
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--dynadrill-purple, #662e9b);
    }
    .p h3 {
      margin: 0.5rem 0 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--dynadrill-purple, #662e9b);
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
  `,
})
export class TicketFcrRetornoPanel {
  private readonly servicio = inject(TicketsFcrService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly ticket = input.required<TicketFcr>();
  readonly cambio = output<void>();

  protected readonly herramientas = signal<HerramientaTicket[]>([]);
  protected readonly llegadas = signal<UnidadLlegada[]>([]);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly estadoTxt = (e: HerramientaTicket['estado']) => ESTADO_HERRAMIENTA_LABELS[e];
  protected readonly tono = (e: HerramientaTicket['estado']) => ESTADO_HERRAMIENTA_TONO[e];
  protected readonly enRetorno = computed(() => this.ticket().paso.codigo === PASO_RETORNO);
  protected readonly puedeRegistrar = computed(
    () => this.enRetorno() && this.auth.can(PERMISO_FCR_BODEGA),
  );
  protected readonly porRetornar = computed(() =>
    this.herramientas().filter((h) => h.estado === 'recibida'),
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
    this.servicio.herramientas(id).subscribe({
      next: (h) => {
        this.herramientas.set(h.herramientas);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar las herramientas.'));
      },
    });
    this.servicio
      .llegadas(id)
      .subscribe({ next: (l) => this.llegadas.set(l), error: () => this.llegadas.set([]) });
  }

  private resultado(
    llamada: ReturnType<TicketsFcrService['devolverHerramientas']>,
    exito: string,
  ): void {
    this.ocupado.set(true);
    this.error.set(null);
    llamada.subscribe({
      next: (h) => {
        this.ocupado.set(false);
        this.herramientas.set(h.herramientas);
        this.notify.success(exito, '');
        this.cambio.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo registrar el retorno.'));
      },
    });
  }

  protected devolverTodas(): void {
    this.resultado(this.servicio.devolverHerramientas(this.ticket().id), 'Herramientas devueltas');
  }
  protected devolver(h: HerramientaTicket): void {
    this.resultado(
      this.servicio.devolverHerramientas(this.ticket().id, [h.id]),
      `Devuelta: ${h.nombre}`,
    );
  }

  protected faltante(h: HerramientaTicket): void {
    const ref = this.dialog.open<TicketFcrFaltanteDialog, TicketFcrFaltanteDialogData>({
      title: 'Herramienta faltante',
      content: TicketFcrFaltanteDialog,
      data: { herramienta: h.nombre },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe(
      (r: FaltanteResultado | undefined) =>
        r &&
        this.resultado(
          this.servicio.herramientaFaltante(this.ticket().id, h.id, r.causa, r.detalle),
          `Faltante registrado: ${h.nombre}`,
        ),
    );
  }

  /** El operador asignado a la unidad (o Superadmin) firma su reporte. */
  protected puedeFirmar(u: UnidadLlegada): boolean {
    const me = this.auth.currentUser();
    return (
      this.enRetorno() && !!me && (me.roleCode === 'superadmin' || u.operador?.usuarioId === me.id)
    );
  }

  protected abrirLlegada(u: UnidadLlegada): void {
    const ref = this.dialog.open<TicketFcrLlegadaDialog, TicketFcrLlegadaDialogData>({
      title: `Reporte de unidad de llegada — ${u.placa}`,
      content: TicketFcrLlegadaDialog,
      data: {
        ticketId: this.ticket().id,
        vehiculoId: u.vehiculoId,
        placa: u.placa,
        reporte: u.reporte,
        puedeFirmar: this.puedeFirmar(u),
      },
      footer: false,
      width: '720px',
    });
    ref.afterClose.subscribe((l: UnidadLlegada[] | undefined) => {
      if (l) {
        this.llegadas.set(l);
        this.cambio.emit();
      }
    });
  }
}
