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
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import {
  PERMISO_ACTA_ENTREGA_CARGAR,
  PERMISO_ACTA_ENTREGA_VER,
  exigeMotivoSuplencia,
  type ActaDelTicket,
  type DocumentoPedido,
} from '../models/documento-pedido';
import { DocumentosPedidoService } from '../services/documentos-pedido.service';

/**
 * Acta de Entrega de Locación (DYN-PMP-RE-027) de un ticket: la sube el Supervisor al finalizar el servicio y el ticket no se cierra
 * sin ella. Componente listo para incrustar en el ticket de Pumping (`<app-acta-entrega-carga [ticketId]="…" />`): muestra el Acta
 * vigente (con enlace para abrirla) o el botón de carga, según los permisos de la cuenta. Avisa con `cambio` cuando se carga.
 */
@Component({
  selector: 'app-acta-entrega-carga',
  imports: [DatePipe, DynadrillButtonComponent, DynadrillInputComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (puedeVer()) {
      <section class="acta">
        <dynadrill-text variant="body">Acta de Entrega de Locación (DYN-PMP-RE-027)</dynadrill-text>
        @if (vigente(); as acta) {
          <dynadrill-text variant="caption"
            >Cargada por {{ acta.cargadoPor }} el
            {{ acta.createdAt | date: 'dd/MM/yyyy HH:mm' }}.</dynadrill-text
          >
          <dynadrill-button variant="secondary" (clicked)="abrir(acta.archivoId)"
            >Ver Acta</dynadrill-button
          >
        } @else if (cargando()) {
          <dynadrill-text variant="caption">Consultando…</dynadrill-text>
        } @else {
          <dynadrill-text variant="caption"
            >Aún no se ha cargado. Sin ella el ticket no se puede cerrar.</dynadrill-text
          >
          @if (puedeCargar()) {
            @if (esSuplente()) {
              <dynadrill-text variant="caption"
                >El Acta la sube el supervisor asignado ({{
                  contexto()?.supervisorAsignado?.nombre
                }}). Si la sube usted, indique por qué él no pudo.</dynadrill-text
              >
              <dynadrill-input
                label="Motivo (por qué el supervisor asignado no pudo)"
                [value]="motivo()"
                (valueChange)="motivo.set($event)"
              />
            }
            <label class="acta__archivo">
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                (change)="subir($event)"
                [disabled]="subiendo() || (esSuplente() && !motivo().trim())"
              />
              <span>{{ subiendo() ? 'Cargando…' : 'Elija el Acta firmada (PDF o imagen)' }}</span>
            </label>
          }
        }
      </section>
    }
  `,
  styles: `
    .acta {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .acta__archivo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
    }
  `,
})
export class ActaEntregaCarga {
  private readonly servicio = inject(DocumentosPedidoService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  /** Ticket (id del backend nuevo) al que pertenece el Acta. */
  readonly ticketId = input.required<string>();
  /** Se emite cuando el Acta queda cargada, para que el ticket recargue sus requisitos. */
  readonly cambio = output<DocumentoPedido>();

  protected readonly puedeVer = computed(() => this.auth.can(PERMISO_ACTA_ENTREGA_VER));
  protected readonly puedeCargar = computed(() => this.auth.can(PERMISO_ACTA_ENTREGA_CARGAR));
  protected readonly cargando = signal(false);
  protected readonly subiendo = signal(false);
  protected readonly contexto = signal<ActaDelTicket | null>(null);
  protected readonly motivo = signal('');
  protected readonly vigente = computed(
    () => this.contexto()?.documentos.find((d) => !d.anulado) ?? null,
  );
  protected readonly esSuplente = computed(() => {
    const c = this.contexto();
    return (
      !!c && exigeMotivoSuplencia(c.supervisorAsignado?.id ?? null, this.auth.currentUser()?.id)
    );
  });

  constructor() {
    effect(() => {
      const id = this.ticketId();
      if (this.puedeVer()) this.consultar(id);
    });
  }

  private consultar(ticketId: string): void {
    this.cargando.set(true);
    this.servicio.actaDelTicket(ticketId).subscribe({
      next: (c) => {
        this.contexto.set(c);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected subir(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo || this.subiendo()) return;
    this.subiendo.set(true);
    this.servicio
      .cargarActa(this.ticketId(), archivo, {
        motivoSuplencia: this.esSuplente() ? this.motivo() : undefined,
      })
      .subscribe({
        next: (d) => {
          this.subiendo.set(false);
          this.contexto.update((c) => (c ? { ...c, documentos: [d, ...c.documentos] } : c));
          this.notify.success('Acta cargada', 'El Acta de Entrega de Locación quedó guardada.');
          this.cambio.emit(d);
        },
        error: (err) => {
          this.subiendo.set(false);
          this.notify.error(
            'No se pudo cargar',
            mensajeDeError(err, 'No se pudo cargar el Acta de Entrega.'),
          );
        },
      });
  }

  protected abrir(archivoId: string): void {
    this.servicio.abrir(archivoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) =>
        this.notify.error('No se pudo abrir', mensajeDeError(err, 'No se pudo abrir el Acta.')),
    });
  }
}
