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
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { ChecklistHerramientaHoja } from '../../../../../shared/documentos/formatos/checklist-herramienta-hoja';
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../../shared/components/motivo-dialog/motivo-dialog';
import {
  ESTADO_INSPECCION_LABELS,
  ESTADO_INSPECCION_TONO,
  FIRMA_LABELS,
  PASO_APROBACION,
  PASO_INSPECCION,
  mensajeErrorTicket,
  type ResumenInspeccion,
  type TicketFcr,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';
import {
  TicketFcrInspeccionDialog,
  type TicketFcrInspeccionDialogData,
} from './ticket-fcr-inspeccion-dialog';
import { inspeccionAFormato } from './inspeccion-formato';

/**
 * Inspección y reparación de herramientas (entrada SERVICIOS): el operador asignado inicia y llena la de cada herramienta, el Supervisor y
 * QHSE firman, y el Supervisor de Operaciones FCR aprueba o devuelve el conjunto.
 */
@Component({
  selector: 'app-ticket-fcr-inspecciones-panel',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p" aria-label="Inspección de herramientas">
      <h2>Inspección de herramientas</h2>
      @if (error(); as e) {
        <dynadrill-banner variant="warning" [message]="e" />
      }
      <dynadrill-spinner mode="overlay" [spinning]="cargando() || ocupado()" tip="Procesando…">
        <div class="p__tabla">
          <table>
            <caption class="sr-only">
              Inspecciones por herramienta
            </caption>
            <thead>
              <tr>
                <th scope="col">Herramienta</th>
                <th scope="col">Inspección</th>
                <th scope="col">Firmas</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (r of lista(); track r.herramientaId) {
                <tr>
                  <td>
                    {{ r.nombre }} <span class="p__meta">{{ r.codigo }}</span>
                  </td>
                  <td>
                    @if (r.inspeccion; as i) {
                      <dynadrill-tag
                        [label]="estadoTxt(i.estado) + ' · v' + i.version"
                        [variant]="tono(i.estado)"
                        [uppercase]="false"
                      />
                      @if (i.motivoRechazo) {
                        <div class="p__nov">Devuelta: {{ i.motivoRechazo }}</div>
                      }
                    } @else {
                      <span class="p__meta">Sin iniciar</span>
                    }
                  </td>
                  <td class="p__meta">{{ firmasTxt(r) }}</td>
                  <td class="p__fila-acciones">
                    @if (r.inspeccion) {
                      <dynadrill-button variant="secondary" size="small" (clicked)="verFormato(r)"
                        >Ver formato</dynadrill-button
                      >
                    }
                    @if (r.inspeccion && r.inspeccion.estado !== 'rechazada') {
                      <dynadrill-button variant="secondary" size="small" (clicked)="abrir(r)">{{
                        r.inspeccion.estado === 'borrador' ? 'Abrir / firmar' : 'Ver'
                      }}</dynadrill-button>
                    } @else if (puedeInspeccionar()) {
                      <dynadrill-button variant="primary" size="small" (clicked)="iniciar(r)">{{
                        r.inspeccion ? 'Rehacer inspección' : 'Iniciar inspección'
                      }}</dynadrill-button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="p__meta">
                    El ticket no tiene herramientas por inspeccionar.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (puedeAprobar()) {
          <div class="p__acciones" role="group" aria-label="Aprobación">
            <dynadrill-button variant="primary" [disabled]="!todasEnviadas()" (clicked)="aprobar()"
              >Aprobar las inspecciones</dynadrill-button
            >
            <dynadrill-button variant="secondary" (clicked)="rechazar()"
              >Devolver con motivo</dynadrill-button
            >
          </div>
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
    .p__tabla {
      overflow-x: auto;
    }
    .p__tabla table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .p__tabla thead th {
      font-weight: 600;
      color: var(--text-secondary, #666);
      white-space: nowrap;
      background: var(--dynadrill-purple-tint, rgba(102, 46, 155, 0.06));
    }
    .p__tabla tbody tr:nth-child(even) {
      background: var(--surface-muted, #faf9fc);
    }
    .p__tabla th,
    .p__tabla td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-default, #e0e0e0);
      vertical-align: top;
    }
    .p__meta {
      font-size: 12px;
      color: #5c5870;
    }
    .p__nov {
      font-size: 12px;
      color: #8a4b00;
    }
    .p__fila-acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .p__acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class TicketFcrInspeccionesPanel {
  private readonly servicio = inject(TicketsFcrService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly pdf = inject(DocumentoPdfService);

  readonly ticket = input.required<TicketFcr>();
  readonly cambio = output<void>();

  protected readonly lista = signal<ResumenInspeccion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly estadoTxt = (e: keyof typeof ESTADO_INSPECCION_LABELS) =>
    ESTADO_INSPECCION_LABELS[e];
  protected readonly tono = (e: keyof typeof ESTADO_INSPECCION_TONO) => ESTADO_INSPECCION_TONO[e];
  protected readonly firmasTxt = (r: ResumenInspeccion) =>
    r.inspeccion && r.inspeccion.firmas.length
      ? r.inspeccion.firmas.map((f) => FIRMA_LABELS[f]).join(' · ')
      : '—';

  private readonly yo = computed(() => this.auth.currentUser());
  /** El operador asignado a la inspección, en el paso de inspección. */
  protected readonly puedeInspeccionar = computed(() => {
    const t = this.ticket();
    const u = this.yo();
    return (
      !!u &&
      t.paso.codigo === PASO_INSPECCION &&
      (u.roleCode === 'superadmin' || t.inspector?.usuarioId === u.id)
    );
  });
  protected readonly puedeAprobar = computed(
    () => this.ticket().paso.codigo === PASO_APROBACION && this.ticket().puedeActuar,
  );
  protected readonly todasEnviadas = computed(
    () =>
      this.lista().length > 0 &&
      this.lista().every(
        (r) => r.inspeccion?.estado === 'enviada' || r.inspeccion?.estado === 'aprobada',
      ),
  );

  constructor() {
    effect(() => {
      this.ticket().version;
      this.cargar();
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.inspecciones(this.ticket().id).subscribe({
      next: (l) => {
        this.lista.set(l);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar las inspecciones.'));
      },
    });
  }

  /** Abre el formato DYN-FCR-RE-009 «Registro de inspección y reparación de herramientas» de esa herramienta, con lo que ya está registrado. */
  protected verFormato(r: ResumenInspeccion): void {
    if (!r.inspeccion) return;
    this.servicio.inspeccion(this.ticket().id, r.inspeccion.id).subscribe({
      next: (i) =>
        this.pdf.abrir({
          titulo: `Inspección y reparación — ${i.descripcionHerramienta}`,
          component: ChecklistHerramientaHoja,
          inputs: { inspeccion: inspeccionAFormato(i) },
          nombreArchivo:
            `Inspección y reparación ${i.descripcionHerramienta} ${i.numeroSerie ?? ''}`.trim(),
        }),
      error: (err) =>
        this.error.set(mensajeErrorTicket(err, 'No se pudo abrir el formato de la inspección.')),
    });
  }

  protected iniciar(r: ResumenInspeccion): void {
    this.ocupado.set(true);
    this.error.set(null);
    this.servicio.iniciarInspeccion(this.ticket().id, r.herramientaId).subscribe({
      next: (i) => {
        this.ocupado.set(false);
        this.cargar();
        this.abrirId(i.id);
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo iniciar la inspección.'));
      },
    });
  }

  protected abrir(r: ResumenInspeccion): void {
    if (r.inspeccion) this.abrirId(r.inspeccion.id);
  }

  private abrirId(inspeccionId: string): void {
    const t = this.ticket();
    const u = this.yo();
    const ref = this.dialog.open<
      TicketFcrInspeccionDialog,
      TicketFcrInspeccionDialogData & { puedeEditar: boolean }
    >({
      title: 'Inspección y reparación de herramientas',
      content: TicketFcrInspeccionDialog,
      data: {
        ticketId: t.id,
        inspeccionId,
        puedeEditar: !!u && (u.roleCode === 'superadmin' || t.inspector?.usuarioId === u.id),
      },
      footer: false,
      width: '1080px',
    });
    ref.afterClose.subscribe(() => {
      this.cargar();
      this.cambio.emit();
    });
  }

  protected aprobar(): void {
    this.ocupado.set(true);
    this.servicio.aprobarInspecciones(this.ticket().id).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success(
          'Inspecciones aprobadas',
          'El ticket pasa a la preparación de herramientas.',
        );
        this.cambio.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo aprobar.'));
      },
    });
  }

  protected rechazar(): void {
    const ref = this.dialog.open<MotivoDialog, MotivoDialogData>({
      title: 'Devolver las inspecciones',
      content: MotivoDialog,
      data: {
        mensaje:
          'Las inspecciones enviadas se devuelven al operador, que las rehace conservando lo registrado.',
        label: 'Motivo',
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (!motivo) return;
      this.ocupado.set(true);
      this.servicio.rechazarInspecciones(this.ticket().id, motivo).subscribe({
        next: () => {
          this.ocupado.set(false);
          this.notify.success('Inspecciones devueltas', 'Se avisó al operador.');
          this.cambio.emit();
        },
        error: (err) => {
          this.ocupado.set(false);
          this.error.set(mensajeErrorTicket(err, 'No se pudo devolver.'));
        },
      });
    });
  }
}
