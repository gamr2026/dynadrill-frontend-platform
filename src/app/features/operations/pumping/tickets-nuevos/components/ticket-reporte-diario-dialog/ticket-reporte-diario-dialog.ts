import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import { switchMap } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillContextCardComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import type { ActividadTabla } from '../../../../../../shared/models/operativo-docs.model';
import { limpiarTablas } from '../../../../../../shared/utils/actividad-tablas';
import { ArchivosService } from '../../../../../facturacion/pedidos-comercial/services/archivos.service';
import { mensajeErrorArchivo } from '../../../../../facturacion/pedidos-comercial/models/documentos-pedido';
import { ActividadTablasEditor } from '../../../components/actividad-tablas-editor';
import {
  MODULO_ARCHIVO_MONITOREO,
  duracionHoras,
  mensajeErrorTicket,
  totalHoras,
  validarReporteDiario,
  type DocumentoDelTicket,
  type ReporteDiario,
  type ReporteDiarioEntrada,
} from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

export interface TicketReporteDiarioDialogData {
  ticketId: string;
  /** Número del ticket (el de la prefactura), para el encabezado del formato. */
  ticketCodigo?: string;
  /** Día del reporte (`yyyy-MM-dd`). */
  fecha: string;
  /** Datos del ticket que encabezan el formato (vienen del ticket y del pedido; no se vuelven a escribir). */
  cabecera: {
    cliente: string | null;
    pozo: string | null;
    campo: string | null;
    bloque?: string | null;
    taladro: string | null;
    contrato: string | null;
    supervisor: string | null;
    /** Representante del cliente en campo (Company Man) según el pedido. */
    representante?: string | null;
  };
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
const numeroONulo = (v: string): number | null =>
  v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const MAX_MONITOREO_BYTES = 25 * 1024 * 1024;

/**
 * Reporte Diario de Actividades de Operaciones (DYN-SGI-RE-047, el «Reporte Job») de un día del ticket, con la presentación de la demo:
 * los datos del ticket y del pedido (cliente, contrato, pozo, el Company Man...) llegan ya escritos; el operador llena las actividades
 * con su hora de inicio y fin (la duración la calcula el sistema), sus tablas y los tiempos. Se guarda como borrador o se completa para
 * enviarlo a Facturación; un día completado se puede reabrir mientras Facturación no lo haya corregido.
 */
@Component({
  selector: 'app-ticket-reporte-diario-dialog',
  imports: [
    ActividadTablasEditor,
    DynadrillButtonComponent,
    DynadrillChipGroupComponent,
    DynadrillContextCardComponent,
    DynadrillIconButtonComponent,
    DynadrillInputComponent,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  templateUrl: './ticket-reporte-diario-dialog.html',
  styleUrl: './ticket-reporte-diario-dialog.scss',
})
export class TicketReporteDiarioDialog {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly archivos = inject(ArchivosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketReporteDiarioDialog, boolean>);
  protected readonly data = inject<TicketReporteDiarioDialogData>(NZ_MODAL_DATA);

  protected readonly estado = signal<ReporteDiario['estado'] | null>(null);
  protected readonly corregido = computed(() => this.estado() === 'corregido');
  protected readonly bloqueado = computed(() => !!this.data.soloLectura || this.corregido());
  protected readonly enviando = signal(false);

  protected readonly fechaTexto = new Intl.DateTimeFormat('es-EC').format(
    new Date(`${this.data.fecha}T00:00:00`),
  );
  protected readonly headerItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Documento', value: 'DYN-SGI-RE-047 V11' },
    { label: 'Ticket', value: this.data.ticketCodigo ?? '—' },
  ]);

  // El Company Man del pedido llega precargado; si el reporte ya lo tenía escrito, se respeta lo guardado.
  protected readonly representante = signal(this.data.cabecera.representante ?? '');
  protected readonly cargo = signal('Representante de Campo');
  protected readonly actividades = signal<FilaActividad[]>([vacia()]);
  protected readonly productivo = signal('');
  protected readonly noProductivo = signal('');
  protected readonly observaciones = signal('');
  protected readonly tieneObservaciones = signal(false);

  // Documento de monitoreo del día (se sube antes a `archivos`; queda como historia, vale el último)
  protected readonly monitoreoDoc = signal<DocumentoDelTicket | null>(null);
  protected readonly monitoreoSubiendo = signal(false);

  protected readonly total = computed(() => totalHoras(this.actividades()));
  protected readonly problema = computed(() => {
    if (this.bloqueado()) return null;
    const t1 = numeroONulo(this.productivo());
    const t2 = numeroONulo(this.noProductivo());
    if ((t1 !== null && (t1 < 0 || t1 > 24)) || (t2 !== null && (t2 < 0 || t2 > 24)))
      return 'Los tiempos productivo y no productivo van entre 0 y 24 horas.';
    return validarReporteDiario(this.actividades());
  });

  constructor() {
    this.cargarMonitoreo();
    if (this.data.nuevo) return;
    this.servicio.reporteDiario(this.data.ticketId, this.data.fecha).subscribe({
      next: (r) => {
        this.estado.set(r.estado);
        if (r.representanteCliente) this.representante.set(r.representanteCliente);
        if (r.cargoRepresentante) this.cargo.set(r.cargoRepresentante);
        this.productivo.set(r.tiempoProductivo === null ? '' : String(r.tiempoProductivo));
        this.noProductivo.set(r.tiempoNoProductivo === null ? '' : String(r.tiempoNoProductivo));
        this.observaciones.set(r.observaciones ?? '');
        this.tieneObservaciones.set(!!r.observaciones?.trim());
        this.actividades.set(
          r.actividades.length
            ? r.actividades.map((a) => ({
                horaInicio: a.horaInicio,
                horaFin: a.horaFin,
                detalle: a.detalle,
                tablas: a.tablas.map((t) => ({ ...t, titulo: t.titulo ?? '' })),
              }))
            : [vacia()],
        );
      },
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeErrorTicket(err, 'No se pudo cargar el reporte del día.'),
        ),
    });
  }

  protected horasTexto(a: FilaActividad): string {
    const h = duracionHoras(a.horaInicio, a.horaFin);
    return h === null ? '—' : String(h);
  }
  protected agregar(): void {
    this.actividades.update((l) => [...l, vacia()]);
  }
  protected quitar(i: number): void {
    this.actividades.update((l) => (l.length > 1 ? l.filter((_, k) => k !== i) : l));
  }
  protected cambiar(i: number, campo: 'horaInicio' | 'horaFin' | 'detalle', valor: string): void {
    this.actividades.update((l) => l.map((a, k) => (k === i ? { ...a, [campo]: valor } : a)));
  }
  protected cambiarTablas(i: number, tablas: ActividadTabla[]): void {
    this.actividades.update((l) => l.map((a, k) => (k === i ? { ...a, tablas } : a)));
  }
  protected alCambiarObservaciones(hay: boolean): void {
    this.tieneObservaciones.set(hay);
    if (!hay) this.observaciones.set('');
  }

  // ── Documento de monitoreo ──
  private cargarMonitoreo(): void {
    this.servicio.documentos(this.data.ticketId).subscribe({
      next: (l) => this.monitoreoDoc.set(this.delDia(l)),
      error: () => this.monitoreoDoc.set(null),
    });
  }
  private delDia(l: DocumentoDelTicket[]): DocumentoDelTicket | null {
    const del = l.filter((d) => d.tipo === 'monitoreo' && d.fecha === this.data.fecha);
    return del.length ? del[del.length - 1] : null;
  }
  protected verMonitoreo(): void {
    const d = this.monitoreoDoc();
    if (!d) return;
    this.archivos.contenido(d.archivoId).subscribe({
      next: (blob) => this.archivos.guardarComo(blob, `Monitoreo ${this.data.fecha}`),
      error: () => this.notify.error('Error', 'No se pudo descargar el documento de monitoreo.'),
    });
  }
  protected onMonitoreoSeleccionado(file: NzUploadFile): void {
    if (this.monitoreoSubiendo()) return;
    const archivo = (file.originFileObj as File | undefined) ?? (file as unknown as File);
    if (!archivo || typeof archivo.size !== 'number') {
      this.notify.error(
        'Archivo no reconocido',
        'No se pudo leer el archivo seleccionado. Intente de nuevo.',
      );
      return;
    }
    if (archivo.size > MAX_MONITOREO_BYTES) {
      this.notify.error(
        'Archivo demasiado grande',
        'El archivo supera el máximo permitido de 25 MB.',
      );
      return;
    }
    this.monitoreoSubiendo.set(true);
    let subiendo = true;
    this.archivos
      .subir(archivo, MODULO_ARCHIVO_MONITOREO)
      .pipe(
        switchMap((a) => {
          subiendo = false;
          return this.servicio.adjuntarMonitoreo(this.data.ticketId, this.data.fecha, a.id);
        }),
      )
      .subscribe({
        next: (l) => {
          this.monitoreoSubiendo.set(false);
          this.monitoreoDoc.set(this.delDia(l));
          this.notify.success(
            'Documento cargado',
            `Documento de monitoreo del ${this.data.fecha}.`,
          );
        },
        error: (err) => {
          this.monitoreoSubiendo.set(false);
          this.notify.error(
            'No se pudo cargar',
            subiendo
              ? mensajeErrorArchivo(err)
              : mensajeErrorTicket(err, 'No se pudo adjuntar el monitoreo.'),
          );
        },
      });
  }

  /** Guarda el día; con `completar` lo envía a Facturación. */
  protected guardar(completar: boolean): void {
    if (this.problema() || this.enviando()) return;
    const cuerpo: ReporteDiarioEntrada = {
      actividades: this.actividades().map((a) => ({
        horaInicio: a.horaInicio,
        horaFin: a.horaFin,
        detalle: a.detalle.trim(),
        tablas: limpiarTablas(a.tablas),
      })),
      representanteCliente: this.representante().trim() || undefined,
      cargoRepresentante: this.cargo().trim() || undefined,
      tiempoProductivo: numeroONulo(this.productivo()) ?? undefined,
      tiempoNoProductivo: numeroONulo(this.noProductivo()) ?? undefined,
      observaciones: this.tieneObservaciones()
        ? this.observaciones().trim() || undefined
        : undefined,
    };
    this.enviando.set(true);
    const guardado$ = this.servicio.guardarReporteDiario(
      this.data.ticketId,
      this.data.fecha,
      cuerpo,
    );
    (completar
      ? guardado$.pipe(
          switchMap(() =>
            this.servicio.completarReporteDiario(this.data.ticketId, this.data.fecha),
          ),
        )
      : guardado$
    ).subscribe({
      next: () => {
        this.notify.success(
          completar ? 'Día enviado a Facturación' : 'Borrador guardado',
          `Reporte del ${this.data.fecha}.`,
        );
        this.modalRef.close(true);
      },
      error: (err) => {
        this.enviando.set(false);
        this.notify.error(
          'No se pudo guardar',
          mensajeErrorTicket(err, 'No se pudo guardar el reporte. Intente de nuevo.'),
        );
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close(false);
  }
}
