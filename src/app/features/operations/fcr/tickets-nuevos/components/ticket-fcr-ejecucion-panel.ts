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
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, of, throwError } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  ESTADO_DIA_LABELS,
  ESTADO_DIA_TONO,
  ESTADO_USO_LABELS,
  PASO_EJECUCION,
  duracionHoras,
  fechaEnServicio,
  mensajeErrorTicket,
  validarActividades,
  type ActividadBitacora,
  type BitacoraTicket,
  type DiaBitacora,
  type DiaBitacoraDetalle,
  type HerramientaTicket,
  type TicketFcr,
  type UsoTicket,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';
import { TicketFcrReporteHerramientas } from './ticket-fcr-reporte-herramientas';
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
    DynadrillIconComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
    TicketFcrReporteHerramientas,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p" aria-label="Ejecución del trabajo">
      <h2><dynadrill-icon name="clock" [size]="20" /> Ejecución del Trabajo FCR</h2>
      <p class="p__sub">
        Bitácora horaria y uso de herramientas — alimentan el Reporte de Trabajo y el Reporte de
        Herramientas al finalizar.
      </p>
      @if (servicioTxt(); as st) {
        <dynadrill-banner variant="info" [message]="st" />
      }
      @if (error(); as e) {
        <dynadrill-banner variant="warning" [message]="e" />
      }
      <dynadrill-spinner mode="overlay" [spinning]="cargando() || ocupado()" tip="Procesando…">
        @if (puedeEditar()) {
          <div class="p__bloque">
            <strong class="p__bloque-titulo">Registrar actividad</strong>
            <div class="p__form">
              <label class="p__campo">
                <span>Fecha</span>
                <input
                  type="date"
                  [value]="nueva().fecha"
                  [attr.min]="bitacora()?.servicio?.desde"
                  [attr.max]="bitacora()?.servicio?.hasta"
                  (change)="cambiarNueva('fecha', $any($event.target).value)"
                />
              </label>
              <fieldset class="p__campo p__hora">
                <legend>Hora inicio</legend>
                <select
                  aria-label="Hora de inicio, horas"
                  [value]="nueva().hIni"
                  (change)="cambiarNueva('hIni', $any($event.target).value)"
                >
                  <option value="">HH</option>
                  @for (h of horas; track h) {
                    <option [value]="h" [selected]="h === nueva().hIni">{{ h }}</option>
                  }
                </select>
                <select
                  aria-label="Hora de inicio, minutos"
                  [value]="nueva().mIni"
                  (change)="cambiarNueva('mIni', $any($event.target).value)"
                >
                  <option value="">MM</option>
                  @for (m of minutos; track m) {
                    <option [value]="m" [selected]="m === nueva().mIni">{{ m }}</option>
                  }
                </select>
              </fieldset>
              <fieldset class="p__campo p__hora">
                <legend>Hora fin</legend>
                <select
                  aria-label="Hora de fin, horas"
                  [value]="nueva().hFin"
                  (change)="cambiarNueva('hFin', $any($event.target).value)"
                >
                  <option value="">HH</option>
                  @for (h of horas; track h) {
                    <option [value]="h" [selected]="h === nueva().hFin">{{ h }}</option>
                  }
                </select>
                <select
                  aria-label="Hora de fin, minutos"
                  [value]="nueva().mFin"
                  (change)="cambiarNueva('mFin', $any($event.target).value)"
                >
                  <option value="">MM</option>
                  @for (m of minutos; track m) {
                    <option [value]="m" [selected]="m === nueva().mFin">{{ m }}</option>
                  }
                </select>
              </fieldset>
              <div class="p__campo">
                <span>Duración calculada</span>
                <strong>{{ duracionNueva() }}</strong>
              </div>
            </div>
            <dynadrill-textarea
              label="Detalle de la actividad"
              placeholder="Describa la actividad realizada…"
              [rows]="3"
              [value]="nueva().detalle"
              (valueChange)="cambiarNueva('detalle', $event)"
            />
            <div class="p__acciones">
              <dynadrill-button
                variant="secondary"
                size="small"
                [disabled]="!!problemaNueva() || ocupado()"
                (clicked)="agregarActividad()"
                >+ Agregar actividad</dynadrill-button
              >
              @if (problemaNueva(); as pn) {
                <span class="p__meta">{{ pn }}</span>
              }
            </div>
          </div>
        }

        <div class="p__tabla">
          <table>
            <caption class="sr-only">
              Actividades de la bitácora por día
            </caption>
            <thead>
              <tr>
                <th scope="col">Inicio</th>
                <th scope="col">Fin</th>
                <th scope="col">Horas</th>
                <th scope="col">Detalle</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (d of bitacora()?.dias ?? []; track d.fecha) {
                <tr class="p__dia">
                  <th scope="rowgroup" colspan="2">{{ fechaDia(d.fecha) }}</th>
                  <th scope="col">{{ d.totalHoras }} h</th>
                  <td colspan="2">
                    <dynadrill-tag
                      [label]="estadoDia(d)"
                      [variant]="tonoDia(d)"
                      [uppercase]="false"
                    />
                    @if (d.enviadaAt) {
                      <span class="p__meta"> · {{ d.enviadaAt | date: 'dd/MM HH:mm' }}</span>
                    }
                    @if (puedeEditar() && d.estado === 'borrador' && d.actividades > 0) {
                      <dynadrill-button
                        variant="primary"
                        size="small"
                        (clicked)="enviarDia(d.fecha)"
                        >Enviar a Facturación</dynadrill-button
                      >
                    }
                  </td>
                </tr>
                @for (a of detalles()[d.fecha]?.actividades ?? []; track $index; let k = $index) {
                  <tr>
                    <td>{{ a.horaInicio }}</td>
                    <td>{{ a.horaFin }}</td>
                    <td>{{ a.duracionHoras }}</td>
                    <td>{{ a.detalle }}</td>
                    <td>
                      @if (puedeEditar() && d.estado !== 'corregido') {
                        <dynadrill-button
                          variant="secondary"
                          size="small"
                          [attr.aria-label]="'Quitar la actividad ' + (k + 1) + ' del ' + d.fecha"
                          (clicked)="quitarActividad(d.fecha, k)"
                          >Quitar</dynadrill-button
                        >
                      }
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td colspan="5" class="p__meta">Todavía no hay actividades registradas.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <h3>Reporte de herramientas</h3>
        <app-ticket-fcr-reporte-herramientas
          [ticket]="ticket()"
          [puedeEditar]="puedeEditar()"
          (cambio)="cambio.emit()"
        />

        <h3>Completación, picker, presión y peso</h3>
        @if (puedeEditar()) {
          <div class="p__acciones">
            <dynadrill-button
              variant="secondary"
              size="small"
              [disabled]="!recibidas().length"
              (clicked)="registrarUso()"
              >Registrar completación o picker de una herramienta</dynadrill-button
            >
          </div>
        }
        <div class="p__tabla">
          <table>
            <caption class="sr-only">
              Registro de completación o picker por herramienta
            </caption>
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Herramienta</th>
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
                  <td colspan="6" class="p__meta">Todavía no hay registros de picker.</td>
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
            >Exige la bitácora enviada (todos sus días) y el reporte de herramientas confirmado. Al
            finalizar se envía el Reporte de Herramientas a Facturación y usted ya no
            corrige.</dynadrill-text
          >
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
    .p__sub {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted, #5c5870);
    }
    .p__bloque {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--surface-muted, #faf9fc);
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 0.5rem;
    }
    .p__bloque-titulo {
      font-size: 0.875rem;
    }
    .p__form {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem 1.25rem;
    }
    .p__campo {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      border: 0;
      font-size: 0.8125rem;
    }
    .p__campo > span,
    .p__campo > legend {
      padding: 0;
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
    }
    .p__hora {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.5rem;
    }
    .p__hora > legend {
      width: 100%;
    }
    .p__campo input,
    .p__campo select {
      min-height: 2.25rem;
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--border-default, #e0e0e0);
      border-radius: 0.375rem;
      background: var(--surface, #fff);
      font: inherit;
    }
    .p__dia th,
    .p__dia td {
      font-weight: 700;
      color: var(--dynadrill-purple, #662e9b);
      background: var(--dynadrill-purple-tint, rgba(102, 46, 155, 0.06));
      border-top: 2px solid var(--border-default, #e0e0e0);
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
  /** Actividades de cada día (por fecha), para la tabla. */
  protected readonly detalles = signal<Record<string, DiaBitacoraDetalle>>({});
  protected readonly horas = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  protected readonly minutos = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  protected readonly nueva = signal({
    fecha: '',
    hIni: '',
    mIni: '',
    hFin: '',
    mFin: '',
    detalle: '',
  });
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

  /** La actividad que se está escribiendo, en el formato de la bitácora (hora vacía si falta alguna parte). */
  private readonly actividadNueva = computed<ActividadBitacora>(() => {
    const n = this.nueva();
    return {
      horaInicio: n.hIni && n.mIni ? `${n.hIni}:${n.mIni}` : '',
      horaFin: n.hFin && n.mFin ? `${n.hFin}:${n.mFin}` : '',
      detalle: n.detalle,
    };
  });
  protected readonly duracionNueva = computed(() => {
    const a = this.actividadNueva();
    return a.horaInicio && a.horaFin && a.horaInicio !== a.horaFin
      ? `${duracionHoras(a.horaInicio, a.horaFin)} h`
      : '—';
  });
  protected readonly problemaNueva = computed(() => {
    const n = this.nueva();
    if (!n.fecha) return 'Elija la fecha.';
    const b = this.bitacora();
    if (b && !fechaEnServicio(n.fecha, b.servicio))
      return 'La fecha debe estar dentro de las del servicio del pedido.';
    return validarActividades([this.actividadNueva()])?.replace('Actividad 1: ', '') ?? null;
  });
  protected readonly servicioTxt = computed(() => {
    const s = this.bitacora()?.servicio;
    if (!s || (!s.desde && !s.hasta)) return null;
    return `Servicio del Pedido: del ${this.fechaDia(s.desde ?? '')} al ${this.fechaDia(s.hasta ?? '')}. Las actividades y el uso de herramientas se registran dentro de estas fechas.`;
  });
  protected fechaDia = (iso: string): string =>
    iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';

  protected cambiarNueva(
    campo: 'fecha' | 'hIni' | 'mIni' | 'hFin' | 'mFin' | 'detalle',
    valor: string,
  ): void {
    this.nueva.update((n) => ({ ...n, [campo]: valor }));
  }

  constructor() {
    effect(() => {
      this.ticket().version;
      this.cargar();
    });
  }

  private cargar(): void {
    const id = this.ticket().id;
    // el velo de carga solo sale la primera vez; las recargas posteriores no tapan el panel
    if (!this.bitacora() && !this.uso()) this.cargando.set(true);
    this.servicio.bitacora(id).subscribe({
      next: (b) => {
        this.bitacora.set(b);
        if (!this.nueva().fecha) this.cambiarNueva('fecha', this.hoyEnServicio());
        const dias = b.dias.filter((d) => d.actividades > 0);
        if (!dias.length) return this.detalles.set({});
        forkJoin(dias.map((d) => this.servicio.dia(id, d.fecha))).subscribe({
          next: (l) =>
            this.detalles.set(Object.fromEntries(l.map((x) => [x.fecha.slice(0, 10), x]))),
          error: () => this.detalles.set({}),
        });
      },
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
    this.servicio.herramientas(id).subscribe({
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

  /** Suma la actividad al día elegido: lee lo que ese día ya tiene y guarda la lista completa. */
  protected agregarActividad(): void {
    if (this.problemaNueva() || this.ocupado()) return;
    const id = this.ticket().id;
    const fecha = this.nueva().fecha;
    this.ocupado.set(true);
    this.error.set(null);
    // un día que todavía no tiene bitácora responde 404: se trata como un día vacío
    this.servicio
      .dia(id, fecha)
      .pipe(
        catchError((err: unknown) =>
          err instanceof HttpErrorResponse && err.status === 404 ? of(null) : throwError(() => err),
        ),
      )
      .subscribe({
        next: (d) => {
          const lista: ActividadBitacora[] = [
            ...(d?.actividades ?? []).map((a) => ({
              horaInicio: a.horaInicio,
              horaFin: a.horaFin,
              detalle: a.detalle,
            })),
            this.actividadNueva(),
          ];
          this.servicio.guardarDia(id, fecha, lista).subscribe({
            next: () => {
              this.ocupado.set(false);
              this.nueva.update((n) => ({
                ...n,
                hIni: '',
                mIni: '',
                hFin: '',
                mFin: '',
                detalle: '',
              }));
              this.notify.success('Actividad agregada', this.fechaDia(fecha));
              this.cargar();
              this.cambio.emit();
            },
            error: (err) => {
              this.ocupado.set(false);
              this.error.set(mensajeErrorTicket(err, 'No se pudo guardar la actividad.'));
            },
          });
        },
        error: (err) => {
          this.ocupado.set(false);
          this.error.set(mensajeErrorTicket(err, 'No se pudo leer el día.'));
        },
      });
  }

  protected quitarActividad(fecha: string, k: number): void {
    const d = this.detalles()[fecha];
    if (!d || this.ocupado()) return;
    const lista = d.actividades
      .filter((_, i) => i !== k)
      .map((a) => ({ horaInicio: a.horaInicio, horaFin: a.horaFin, detalle: a.detalle }));
    this.ocupado.set(true);
    this.error.set(null);
    this.servicio.guardarDia(this.ticket().id, fecha, lista).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.cargar();
        this.cambio.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo quitar la actividad.'));
      },
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
