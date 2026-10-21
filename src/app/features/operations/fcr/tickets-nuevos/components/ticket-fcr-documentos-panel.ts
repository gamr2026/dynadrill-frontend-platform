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
import { switchMap } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { ArchivosService } from '../../../../facturacion/pedidos-comercial/services/archivos.service';
import { mensajeErrorArchivo } from '../../../../facturacion/pedidos-comercial/models/documentos-pedido';
import {
  CAMPOS_POR_PASO,
  CAMPO_DOCUMENTO_LABELS,
  MODULO_ARCHIVO_FCR,
  documentoVigente,
  mensajeErrorTicket,
  type CampoDocumento,
  type DocumentoTicket,
  type TicketFcr,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

/**
 * Documentos del ticket. Los de SERVICIOS (formulario de inspección externo, dimensionamiento y dureza) los adjunta el operador que
 * inspecciona; los del tronco (inspección y dimensionamiento, registro de dureza y registro firmado de QAQC), el Supervisor en la
 * preparación. Cada archivo se sube a `archivos` y aquí se enlaza; el vigente de cada campo es el último.
 */
@Component({
  selector: 'app-ticket-fcr-documentos-panel',
  imports: [DatePipe, DynadrillBannerComponent, DynadrillButtonComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p" aria-label="Documentos del ticket">
      <h2>Documentos</h2>
      @if (error(); as e) {
        <dynadrill-banner variant="warning" [message]="e" />
      }
      <ul class="p__lista">
        @for (c of campos(); track c) {
          <li>
            <span>{{ etiqueta(c) }}</span>
            @if (vigente(c); as d) {
              <dynadrill-tag
                [label]="'Adjunto · ' + d.subidoPor"
                variant="success"
                [uppercase]="false"
              />
              <span class="p__meta">{{ d.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
              <dynadrill-button variant="secondary" size="small" (clicked)="abrir(d)"
                >Ver</dynadrill-button
              >
            } @else {
              <dynadrill-tag label="Pendiente" variant="warning" [uppercase]="false" />
            }
            @if (puedeAdjuntar()) {
              <label class="p__archivo">
                <span class="sr-only">Adjuntar {{ etiqueta(c) }}</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                  [disabled]="subiendo() !== null"
                  (change)="elegir(c, $event)"
                />
              </label>
            }
          </li>
        }
      </ul>
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
    .p__lista li > span:first-child {
      min-width: 260px;
      font-weight: 600;
    }
    .p__meta {
      font-size: 12px;
      color: #5c5870;
    }
    .p__archivo input {
      font-size: 12px;
    }
  `,
})
export class TicketFcrDocumentosPanel {
  private readonly servicio = inject(TicketsFcrService);
  private readonly archivos = inject(ArchivosService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly ticket = input.required<TicketFcr>();
  /** Avisa a la página para que recargue el ticket (cambian los requisitos). */
  readonly cambio = output<void>();

  protected readonly docs = signal<DocumentoTicket[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly subiendo = signal<CampoDocumento | null>(null);
  protected readonly etiqueta = (c: CampoDocumento) => CAMPO_DOCUMENTO_LABELS[c];

  /** Los campos que se adjuntan en el paso actual (los de servicios solo si el ticket es de servicios). */
  protected readonly campos = computed(() => {
    const t = this.ticket();
    return (CAMPOS_POR_PASO[t.paso.codigo] ?? []).filter(
      (c) =>
        t.tipoOt === 'servicio' ||
        (!c.endsWith('_servicio') && c !== 'formulario_inspeccion_externo'),
    );
  });
  protected readonly puedeAdjuntar = computed(() => {
    const t = this.ticket();
    const u = this.auth.currentUser();
    if (!u || !t.puedeActuar) return false;
    return (
      u.roleCode === 'superadmin' || t.inspector?.usuarioId === u.id || u.roleCode === 'supervisor'
    );
  });

  constructor() {
    effect(() => {
      this.ticket().version;
      this.servicio
        .documentos(this.ticket().id)
        .subscribe({ next: (l) => this.docs.set(l), error: () => this.docs.set([]) });
    });
  }

  protected vigente(c: CampoDocumento): DocumentoTicket | null {
    return documentoVigente(this.docs(), c);
  }

  protected abrir(d: DocumentoTicket): void {
    this.archivos.contenido(d.archivoId).subscribe({
      next: (blob) => this.archivos.guardarComo(blob, CAMPO_DOCUMENTO_LABELS[d.campo]),
      error: () => this.error.set('No se pudo descargar el documento.'),
    });
  }

  protected elegir(campo: CampoDocumento, e: Event): void {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo || this.subiendo()) return;
    this.subiendo.set(campo);
    this.error.set(null);
    let subiendoArchivo = true;
    this.archivos
      .subir(archivo, MODULO_ARCHIVO_FCR)
      .pipe(
        switchMap((a) => {
          subiendoArchivo = false;
          return this.servicio.adjuntarDocumento(this.ticket().id, campo, a.id);
        }),
      )
      .subscribe({
        next: (l) => {
          this.subiendo.set(null);
          this.docs.set(l);
          this.notify.success('Documento adjuntado', CAMPO_DOCUMENTO_LABELS[campo]);
          this.cambio.emit();
        },
        error: (err) => {
          this.subiendo.set(null);
          this.error.set(
            subiendoArchivo
              ? mensajeErrorArchivo(err)
              : mensajeErrorTicket(err, 'No se pudo adjuntar el documento.'),
          );
        },
      });
  }
}
