import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { switchMap } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { ActividadTabla } from '../../../../../../shared/models/operativo-docs.model';
import { limpiarTablas } from '../../../../../../shared/utils/actividad-tablas';
import { ActividadTablasEditor } from '../../../components/actividad-tablas-editor';
import {
  ESTADO_REPORTE_DIARIO_LABELS,
  ESTADO_REPORTE_DIARIO_TONO,
  duracionHoras,
  mensajeErrorTicket,
  totalHoras,
  validarReporteDiario,
  type ReporteDiario,
  type ReporteDiarioEntrada,
} from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketReporteDiarioDialogData {
  ticketId: string;
  /** Día del reporte (`yyyy-MM-dd`). */
  fecha: string;
  /** Datos del ticket que encabezan el formato (vienen del ticket; no se vuelven a escribir). */
  cabecera: { cliente: string | null; pozo: string | null; campo: string | null; taladro: string | null; contrato: string | null; supervisor: string | null };
  /** Solo lectura: quien no es Operador del equipo, el ticket ya salió de la Ejecución operativa o Facturación corrigió el día. */
  soloLectura?: boolean;
  /** `true` si el día todavía no existe en el servidor. */
  nuevo?: boolean;
}

interface FilaActividad {
  horaInicio: string;
  horaFin: string;
  detalle: string;
  tablas: ActividadTabla[];
}

const vacia = (): FilaActividad => ({ horaInicio: '', horaFin: '', detalle: '', tablas: [] });
const numeroONulo = (v: string): number | null => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Reporte Diario de Actividades de Operaciones (DYN-SGI-RE-047, el «Reporte Job») de un día del ticket: actividades con su hora de
 * inicio y fin (la duración la calcula el sistema) y, dentro de cada una, tablas. Se guarda como borrador y se completa para enviarlo
 * a Facturación; un día completado se puede reabrir y editar mientras Facturación no lo haya corregido.
 */
@Component({
  selector: 'app-ticket-reporte-diario-dialog',
  imports: [
    ActividadTablasEditor,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillInputComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  template: `
    <div class="rd">
      <div class="rd__cabecera">
        <strong>Reporte diario del {{ data.fecha }}</strong>
        @if (estado(); as e) {
          <dynadrill-tag [label]="estadoEtiqueta(e)" [variant]="estadoTono(e)" [uppercase]="false" />
        }
        <dynadrill-text variant="caption">DYN-SGI-RE-047</dynadrill-text>
      </div>
      <dl class="rd__ticket">
        <div><dt>Cliente</dt><dd>{{ data.cabecera.cliente ?? '—' }}</dd></div>
        <div><dt>Pozo</dt><dd>{{ data.cabecera.pozo ?? '—' }}</dd></div>
        <div><dt>Campo</dt><dd>{{ data.cabecera.campo ?? '—' }}</dd></div>
        <div><dt>Taladro</dt><dd>{{ data.cabecera.taladro ?? '—' }}</dd></div>
        <div><dt>Orden / contrato</dt><dd>{{ data.cabecera.contrato ?? '—' }}</dd></div>
        <div><dt>Supervisor</dt><dd>{{ data.cabecera.supervisor ?? '—' }}</dd></div>
      </dl>

      @if (corregido()) {
        <div class="rd__aviso" role="status">Facturación corrigió este día en el pedido: ya no se puede editar ni reenviar desde el ticket.</div>
      }

      <fieldset class="rd__bloque rd__grid">
        <legend>Representante del cliente</legend>
        <dynadrill-input label="Nombre (Company Man)" [value]="representante()" [disabled]="bloqueado()" (valueChange)="representante.set($event)" />
        <dynadrill-input label="Cargo" [value]="cargo()" [disabled]="bloqueado()" (valueChange)="cargo.set($event)" />
      </fieldset>

      <fieldset class="rd__bloque">
        <legend>Actividades</legend>
        @for (a of actividades(); track $index; let i = $index) {
          <article class="rd__actividad">
            <div class="rd__actividad-cabecera">
              <strong>Actividad {{ i + 1 }}</strong>
              <span class="rd__duracion">{{ duracionTexto(a) }}</span>
              @if (!bloqueado() && actividades().length > 1) {
                <dynadrill-icon-button icon="delete" tooltip="Quitar la actividad" (clicked)="quitar(i)" />
              }
            </div>
            <div class="rd__horas">
              <label class="rd__campo"><span>Inicio</span><input type="time" [value]="a.horaInicio" [disabled]="bloqueado()" (input)="cambiar(i, 'horaInicio', $any($event.target).value)" /></label>
              <label class="rd__campo"><span>Fin</span><input type="time" [value]="a.horaFin" [disabled]="bloqueado()" (input)="cambiar(i, 'horaFin', $any($event.target).value)" /></label>
            </div>
            <dynadrill-textarea label="Detalle" [rows]="3" [value]="a.detalle" [disabled]="bloqueado()" (valueChange)="cambiar(i, 'detalle', $event)" />
            @if (bloqueado()) {
              @for (t of a.tablas; track $index) {
                <table class="rd__tabla">
                  <caption>{{ t.titulo || 'Tabla' }}</caption>
                  <thead><tr>@for (c of t.columnas; track $index) { <th scope="col">{{ c }}</th> }</tr></thead>
                  <tbody>@for (f of t.filas; track $index) { <tr>@for (v of f; track $index) { <td>{{ v }}</td> }</tr> }</tbody>
                </table>
              }
            } @else {
              <app-actividad-tablas-editor [tablas]="a.tablas" (tablasChange)="cambiarTablas(i, $event)" />
            }
          </article>
        }
        @if (!bloqueado()) {
          <div><dynadrill-button variant="secondary" size="small" (clicked)="agregar()">Agregar actividad</dynadrill-button></div>
        }
        <dynadrill-text variant="caption">Total de horas del día: {{ total() }}</dynadrill-text>
      </fieldset>

      <fieldset class="rd__bloque rd__grid">
        <legend>Tiempos y observaciones</legend>
        <dynadrill-input label="Tiempo productivo (h)" type="number" [value]="productivo()" [disabled]="bloqueado()" (valueChange)="productivo.set($event)" />
        <dynadrill-input label="Tiempo no productivo (h)" type="number" [value]="noProductivo()" [disabled]="bloqueado()" (valueChange)="noProductivo.set($event)" />
        <dynadrill-textarea class="rd__ancho" label="Observaciones (opcional)" [rows]="2" [value]="observaciones()" [disabled]="bloqueado()" (valueChange)="observaciones.set($event)" />
      </fieldset>

      @if (problema(); as p) {
        <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
      }
    </div>
    <footer class="rd__acciones">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">{{ bloqueado() ? 'Cerrar' : 'Cancelar' }}</dynadrill-button>
      @if (!bloqueado()) {
        <dynadrill-button variant="secondary" [disabled]="!!problema() || enviando()" (clicked)="guardar(false)">Guardar borrador</dynadrill-button>
        <dynadrill-button [disabled]="!!problema() || enviando() || actividades().length === 0" (clicked)="guardar(true)">{{ enviando() ? 'Enviando…' : 'Completar y enviar a Facturación' }}</dynadrill-button>
      }
    </footer>
  `,
  styles: `
    .rd { display: flex; flex-direction: column; gap: 14px; }
    .rd__cabecera { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .rd__ticket { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 16px; margin: 0; font-size: 13px; }
    .rd__ticket dt { color: #5c5870; font-size: 12px; }
    .rd__ticket dd { margin: 0; }
    .rd__aviso { background: #e6f4ff; border: 1px solid #91caff; border-radius: 6px; padding: 8px 12px; font-size: 13px; }
    .rd__bloque { border: 1px solid #ecebf1; border-radius: 8px; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
    .rd__bloque legend { padding: 0 6px; font-weight: 600; }
    .rd__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .rd__grid legend, .rd__ancho { grid-column: 1 / -1; }
    .rd__actividad { border: 1px solid #f3f2f7; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .rd__actividad-cabecera { display: flex; align-items: center; gap: 10px; }
    .rd__duracion { color: #5c5870; font-size: 13px; margin-right: auto; }
    .rd__horas { display: flex; gap: 12px; }
    .rd__campo { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
    .rd__campo input { height: 36px; border: 1px solid #d6d3e0; border-radius: 6px; padding: 0 8px; }
    .rd__tabla { border-collapse: collapse; font-size: 13px; }
    .rd__tabla caption { text-align: left; font-weight: 600; padding: 4px 0; }
    .rd__tabla th, .rd__tabla td { border: 1px solid #ecebf1; padding: 4px 8px; text-align: left; }
    .rd__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class TicketReporteDiarioDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketReporteDiarioDialog, boolean>);
  protected readonly data = inject<TicketReporteDiarioDialogData>(NZ_MODAL_DATA);

  protected readonly estado = signal<ReporteDiario['estado'] | null>(null);
  protected readonly corregido = computed(() => this.estado() === 'corregido');
  protected readonly bloqueado = computed(() => !!this.data.soloLectura || this.corregido());
  protected readonly enviando = signal(false);

  protected readonly representante = signal('');
  protected readonly cargo = signal('Representante de Campo');
  protected readonly actividades = signal<FilaActividad[]>([vacia()]);
  protected readonly productivo = signal('');
  protected readonly noProductivo = signal('');
  protected readonly observaciones = signal('');

  protected readonly total = computed(() => totalHoras(this.actividades()));
  protected readonly problema = computed(() => {
    if (this.bloqueado()) return null;
    const t1 = numeroONulo(this.productivo());
    const t2 = numeroONulo(this.noProductivo());
    if ((t1 !== null && (t1 < 0 || t1 > 24)) || (t2 !== null && (t2 < 0 || t2 > 24))) return 'Los tiempos productivo y no productivo van entre 0 y 24 horas.';
    return validarReporteDiario(this.actividades());
  });
  protected readonly estadoEtiqueta = (e: ReporteDiario['estado']) => ESTADO_REPORTE_DIARIO_LABELS[e];
  protected readonly estadoTono = (e: ReporteDiario['estado']) => ESTADO_REPORTE_DIARIO_TONO[e];

  constructor() {
    if (this.data.nuevo) return;
    this.servicio.reporteDiario(this.data.ticketId, this.data.fecha).subscribe({
      next: r => {
        this.estado.set(r.estado);
        this.representante.set(r.representanteCliente ?? '');
        if (r.cargoRepresentante) this.cargo.set(r.cargoRepresentante);
        this.productivo.set(r.tiempoProductivo === null ? '' : String(r.tiempoProductivo));
        this.noProductivo.set(r.tiempoNoProductivo === null ? '' : String(r.tiempoNoProductivo));
        this.observaciones.set(r.observaciones ?? '');
        this.actividades.set(
          r.actividades.length
            ? r.actividades.map(a => ({ horaInicio: a.horaInicio, horaFin: a.horaFin, detalle: a.detalle, tablas: a.tablas.map(t => ({ ...t, titulo: t.titulo ?? '' })) }))
            : [vacia()],
        );
      },
      error: err => this.notify.error('Error', mensajeErrorTicket(err, 'No se pudo cargar el reporte del día.')),
    });
  }

  protected duracionTexto(a: FilaActividad): string {
    const h = duracionHoras(a.horaInicio, a.horaFin);
    return h === null ? 'Duración: —' : `Duración: ${h} h`;
  }
  protected agregar(): void {
    this.actividades.update(l => [...l, vacia()]);
  }
  protected quitar(i: number): void {
    this.actividades.update(l => (l.length > 1 ? l.filter((_, k) => k !== i) : l));
  }
  protected cambiar(i: number, campo: 'horaInicio' | 'horaFin' | 'detalle', valor: string): void {
    this.actividades.update(l => l.map((a, k) => (k === i ? { ...a, [campo]: valor } : a)));
  }
  protected cambiarTablas(i: number, tablas: ActividadTabla[]): void {
    this.actividades.update(l => l.map((a, k) => (k === i ? { ...a, tablas } : a)));
  }

  /** Guarda el día; con `completar` lo envía a Facturación. */
  protected guardar(completar: boolean): void {
    if (this.problema() || this.enviando()) return;
    const cuerpo: ReporteDiarioEntrada = {
      actividades: this.actividades().map(a => ({ horaInicio: a.horaInicio, horaFin: a.horaFin, detalle: a.detalle.trim(), tablas: limpiarTablas(a.tablas) })),
      representanteCliente: this.representante().trim() || undefined,
      cargoRepresentante: this.cargo().trim() || undefined,
      tiempoProductivo: numeroONulo(this.productivo()) ?? undefined,
      tiempoNoProductivo: numeroONulo(this.noProductivo()) ?? undefined,
      observaciones: this.observaciones().trim() || undefined,
    };
    this.enviando.set(true);
    const guardado$ = this.servicio.guardarReporteDiario(this.data.ticketId, this.data.fecha, cuerpo);
    (completar ? guardado$.pipe(switchMap(() => this.servicio.completarReporteDiario(this.data.ticketId, this.data.fecha))) : guardado$).subscribe({
      next: () => {
        this.notify.success(completar ? 'Día enviado a Facturación' : 'Borrador guardado', `Reporte del ${this.data.fecha}.`);
        this.modalRef.close(true);
      },
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo guardar', mensajeErrorTicket(err, 'No se pudo guardar el reporte. Intente de nuevo.'));
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close(false);
  }
}
