import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { mensajeErrorArchivo } from '../../../facturacion/pedidos-comercial/models/documentos-pedido';
import { formatoDia } from '../../../facturacion/pedidos-comercial/models/pedido-comercial.model';
import { ArchivosService } from '../../../facturacion/pedidos-comercial/services/archivos.service';
import {
  PERMISO_ACTA_ENTREGA_CARGAR,
  PERMISO_DOCUMENTOS_GESTIONAR,
  PERMISO_DOCUMENTOS_VER,
  PERMISO_DOCUMENTOS_VER_TICKET,
  exigeMotivoSuplencia,
  fechaIso,
  insigniaArt,
  type DocumentoVigente,
  type PedidoDocumental,
} from '../../../qhse/documentos-pedido/models/documento-pedido';
import { DocumentosPedidoService } from '../../../qhse/documentos-pedido/services/documentos-pedido.service';

type DocumentoCargable = 'art' | 'pt' | 'acta';

/**
 * Documentos QHSE del pedido de un ticket, como la demo: Formato de Recepción y SFI (los carga QHSE), ART y PT del día y el Acta de Entrega
 * de Locación (se cargan desde el ticket según el permiso). Cada fila trae su estado, la descarga y, si corresponde, la carga.
 */
@Component({
  selector: 'app-ticket-documentos-qhse',
  imports: [DynadrillBannerComponent, DynadrillButtonComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (puedeVerEstado()) {
      <section class="q" aria-label="Documentos QHSE">
        <h2>Documentos QHSE</h2>
        @if (error(); as e) {
          <dynadrill-banner variant="warning" [message]="e" />
        }
        <ul class="q__lista">
          <li class="q__fila">
            <div class="q__texto">
              <strong>Formato de Recepción</strong>
              <span class="q__meta">{{
                docs()?.formatoRecepcion ? 'Cargado por QHSE' : 'Pendiente de QHSE'
              }}</span>
              <dynadrill-tag
                [label]="docs()?.formatoRecepcion ? 'Cargado' : 'Pendiente'"
                [variant]="docs()?.formatoRecepcion ? 'success' : 'warning'"
                [uppercase]="false"
              />
            </div>
            <div class="q__acciones">
              @if (puedeVerDocs() && docs()?.formatoRecepcion; as d) {
                <button
                  type="button"
                  class="q__icono"
                  aria-label="Descargar Formato de Recepción"
                  title="Descargar"
                  (click)="descargar(d, 'Formato de recepción')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                </button>
              }
            </div>
          </li>

          <li class="q__fila">
            <div class="q__texto">
              <strong>SFI</strong>
              <span class="q__meta">{{
                docs()?.sfi ? 'Cargado por QHSE' : 'Pendiente de QHSE'
              }}</span>
              <dynadrill-tag
                [label]="docs()?.sfi ? 'Cargado' : 'Pendiente'"
                [variant]="docs()?.sfi ? 'success' : 'warning'"
                [uppercase]="false"
              />
            </div>
            <div class="q__acciones">
              @if (puedeVerDocs() && docs()?.sfi; as d) {
                <button
                  type="button"
                  class="q__icono"
                  aria-label="Descargar SFI"
                  title="Descargar"
                  (click)="descargar(d, 'SFI')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                </button>
              }
            </div>
          </li>

          <li class="q__fila">
            <div class="q__texto">
              <strong>ART</strong>
              <span class="q__meta">{{
                docs()?.art ? 'Vigente hasta ' + dia(docs()?.art?.vigenteHasta) : 'Sin ART cargado'
              }}</span>
              <dynadrill-tag
                [label]="artInsignia().text"
                [variant]="artInsignia().tone"
                [uppercase]="false"
              />
            </div>
            <div class="q__acciones">
              @if (puedeVerDocs() && docs()?.art; as d) {
                <button
                  type="button"
                  class="q__icono"
                  aria-label="Descargar ART"
                  title="Descargar"
                  (click)="descargar(d, 'ART')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                </button>
              }
              @if (puedeCargarArtPt()) {
                <button
                  type="button"
                  class="q__icono"
                  [attr.aria-label]="docs()?.art ? 'Subir un ART nuevo' : 'Subir ART'"
                  title="Subir"
                  (click)="alternar('art')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m17 8-5-5-5 5" />
                    <path d="M12 3v12" />
                  </svg>
                </button>
              }
            </div>
          </li>
          @if (abierta() === 'art') {
            <li class="q__carga">
              <label
                >Fecha de emisión del ART
                <input type="date" [value]="fecha()" (input)="fecha.set($any($event.target).value)"
              /></label>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" (change)="elegir($event)" />
              <dynadrill-button
                variant="primary"
                size="small"
                [disabled]="!archivo() || !fecha() || cargando()"
                (clicked)="subir()"
                >Subir ART</dynadrill-button
              >
            </li>
          }

          <li class="q__fila">
            <div class="q__texto">
              <strong>PT del día</strong>
              <span class="q__meta">{{
                docs()?.ptHoy ? 'Cargado por QHSE' : 'QHSE aún no abrió el PTW del día'
              }}</span>
              <dynadrill-tag
                [label]="docs()?.ptHoy ? 'Cargado' : 'Pendiente'"
                [variant]="docs()?.ptHoy ? 'success' : 'warning'"
                [uppercase]="false"
              />
            </div>
            <div class="q__acciones">
              @if (puedeVerDocs() && docs()?.ptHoy; as d) {
                <button
                  type="button"
                  class="q__icono"
                  aria-label="Descargar PT del día"
                  title="Descargar"
                  (click)="descargar(d, 'PT del día')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                </button>
              }
              @if (puedeCargarArtPt() && !docs()?.ptHoy) {
                <button
                  type="button"
                  class="q__icono"
                  aria-label="Subir PT del día"
                  title="Subir"
                  (click)="alternar('pt')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m17 8-5-5-5 5" />
                    <path d="M12 3v12" />
                  </svg>
                </button>
              }
            </div>
          </li>
          @if (abierta() === 'pt') {
            <li class="q__carga">
              <label
                >Día de operación del PT
                <input type="date" [value]="fecha()" (input)="fecha.set($any($event.target).value)"
              /></label>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" (change)="elegir($event)" />
              <dynadrill-button
                variant="primary"
                size="small"
                [disabled]="!archivo() || !fecha() || cargando()"
                (clicked)="subir()"
                >Subir PT</dynadrill-button
              >
            </li>
          }

          <li class="q__fila">
            <div class="q__texto">
              <strong>Acta de Entrega de Locación</strong>
              <span class="q__meta">{{
                docs()?.actaEntrega
                  ? 'Cargada por el Supervisor'
                  : 'Pendiente — se carga al finalizar el ticket (DYN-PMP-RE-027)'
              }}</span>
              <dynadrill-tag
                [label]="docs()?.actaEntrega ? 'Cargado' : 'Pendiente'"
                [variant]="docs()?.actaEntrega ? 'success' : 'warning'"
                [uppercase]="false"
              />
            </div>
            <div class="q__acciones">
              @if (puedeVerDocs() && docs()?.actaEntrega; as d) {
                <button
                  type="button"
                  class="q__icono"
                  aria-label="Descargar el Acta de Entrega de Locación"
                  title="Descargar"
                  (click)="descargar(d, 'Acta de entrega de locación')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                </button>
              }
              @if (puedeCargarActa()) {
                <button
                  type="button"
                  class="q__icono"
                  [attr.aria-label]="docs()?.actaEntrega ? 'Subir una nueva Acta' : 'Subir el Acta'"
                  title="Subir"
                  (click)="alternar('acta')"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m17 8-5-5-5 5" />
                    <path d="M12 3v12" />
                  </svg>
                </button>
              }
            </div>
          </li>
          @if (abierta() === 'acta') {
            <li class="q__carga">
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" (change)="elegir($event)" />
              @if (pideMotivo()) {
                <label
                  >El Acta la sube el supervisor asignado: indique por qué no pudo
                  <input
                    type="text"
                    [value]="motivo()"
                    (input)="motivo.set($any($event.target).value)"
                /></label>
              }
              <dynadrill-button
                variant="primary"
                size="small"
                [disabled]="!archivo() || (pideMotivo() && !motivo().trim()) || cargando()"
                (clicked)="subir()"
                >Subir Acta</dynadrill-button
              >
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    .q {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1.5rem;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 0.75rem;
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(19, 21, 41, 0.05));
    }
    .q h2 {
      margin: 0;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--dynadrill-purple, #662e9b);
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--dynadrill-purple, #662e9b);
    }
    .q__lista {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .q__fila {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border, #e5e4ea);
    }
    .q__texto {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
    .q__meta {
      font-size: 0.75rem;
      color: var(--text-muted, #5c5870);
    }
    .q__acciones {
      display: flex;
      gap: 0.5rem;
    }
    .q__icono {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 0.5rem;
      background: var(--surface, #fff);
      color: inherit;
      cursor: pointer;
    }
    .q__icono svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .q__icono:hover {
      background: var(--surface-muted, #faf9fc);
    }
    .q__icono:focus-visible {
      outline: 2px solid var(--dynadrill-purple, #662e9b);
      outline-offset: 2px;
    }
    .q__carga {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
      padding: 0.75rem;
      font-size: 0.75rem;
      background: var(--surface-muted, #faf9fc);
      border-radius: 0.5rem;
    }
    .q__carga label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
  `,
})
export class TicketDocumentosQhse {
  private readonly auth = inject(AuthService);
  private readonly api = inject(DocumentosPedidoService);
  private readonly archivos = inject(ArchivosService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly ticketId = input.required<string>();
  readonly pedidoId = input.required<string>();
  /** Supervisor asignado al ticket: quien sube el Acta sin serlo debe indicar el motivo. */
  readonly supervisorId = input<string | null>(null);
  /** Cambia cuando el ticket se recarga: vuelve a leer los documentos. */
  readonly version = input<number>(0);

  protected readonly docs = signal<PedidoDocumental | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly abierta = signal<DocumentoCargable | null>(null);
  protected readonly archivo = signal<File | null>(null);
  protected readonly fecha = signal(fechaIso(new Date()));
  protected readonly motivo = signal('');
  protected readonly cargando = signal(false);

  protected readonly dia = formatoDia;
  protected readonly puedeVerDocs = computed(() => this.auth.can(PERMISO_DOCUMENTOS_VER));
  protected readonly puedeVerEstado = computed(
    () => this.puedeVerDocs() || this.auth.can(PERMISO_DOCUMENTOS_VER_TICKET),
  );
  protected readonly puedeCargarArtPt = computed(() => this.auth.can(PERMISO_DOCUMENTOS_GESTIONAR));
  protected readonly puedeCargarActa = computed(() => this.auth.can(PERMISO_ACTA_ENTREGA_CARGAR));
  protected readonly artInsignia = computed(() => {
    const art = this.docs()?.art ?? null;
    return art ? insigniaArt(art) : ({ text: 'Pendiente', tone: 'warning' } as const);
  });
  protected readonly pideMotivo = computed(() =>
    exigeMotivoSuplencia(this.supervisorId(), this.auth.currentUser()?.id),
  );

  constructor() {
    effect(() => {
      this.version();
      this.cargar();
    });
  }

  private cargar(): void {
    if (!this.puedeVerEstado()) return;
    this.api.deTicket(this.ticketId()).subscribe({
      next: (d) => this.docs.set(d),
      error: () => this.docs.set(null),
    });
  }

  protected descargar(d: DocumentoVigente, nombre: string): void {
    this.api.abrir(d.archivoId).subscribe({
      next: (blob) => this.archivos.guardarComo(blob, nombre),
      error: () => this.error.set('No se pudo descargar el documento.'),
    });
  }

  protected alternar(doc: DocumentoCargable): void {
    this.abierta.set(this.abierta() === doc ? null : doc);
    this.archivo.set(null);
    this.motivo.set('');
  }

  protected elegir(e: Event): void {
    this.archivo.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected subir(): void {
    const doc = this.abierta();
    const archivo = this.archivo();
    if (!doc || !archivo || this.cargando()) return;
    this.cargando.set(true);
    this.error.set(null);
    const peticion =
      doc === 'acta'
        ? this.api.cargarActa(this.ticketId(), archivo, { motivoSuplencia: this.motivo() })
        : this.api.cargar(archivo, {
            pedidoId: this.pedidoId(),
            ticketId: this.ticketId(),
            tipo: doc,
            fecha: this.fecha(),
          });
    peticion.subscribe({
      next: () => {
        this.cargando.set(false);
        this.abierta.set(null);
        this.archivo.set(null);
        this.notify.success('Documento cargado', 'Quedó registrado en QHSE.');
        this.cargar();
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorArchivo(err));
      },
    });
  }
}
