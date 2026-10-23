import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { catchError, forkJoin, of, switchMap, timer } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillProgressComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type {
  OperativoActivityLogEntry,
  OperativoDocHeader,
} from '../../../../../shared/models/operativo-docs.model';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { ReporteHerramientasHoja } from '../../../../../shared/documentos/formatos/reporte-herramientas-hoja';
import { DocumentosPedidoHoja } from '../documentos-pedido-hoja/documentos-pedido-hoja';
import {
  ReporteJobHoja,
  type ReporteJobExtras,
} from '../../../../../shared/documentos/formatos/reporte-job-hoja';
import {
  etiquetaOrigen,
  herramientasParaHoja,
  reportesHerramientas,
  reportesJobOrdenados,
  type AvanceDocumental,
  type DocumentoOperativo,
} from '../../models/documentos-operativos';
import {
  formatoDia,
  mensajeDeError,
  type PedidoDetalle,
} from '../../models/pedido-comercial.model';
import {
  ACCEPT_DOCUMENTOS,
  MAX_DOCUMENTOS_PEDIDO,
  errorDeArchivo,
  formatoTamano,
  mensajeErrorArchivo,
  type DocumentoPedido,
} from '../../models/documentos-pedido';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import { ArchivosService } from '../../services/archivos.service';
import { DocumentosFirmadosComercialService } from '../../services/documentos-firmados-comercial.service';
import { MODULO_ARCHIVO_FIRMADO, type DocumentoFirmado } from '../../models/documentos-firmados';
import { MAX_BYTES_FIRMA, estadoVerificacion } from '../../models/prefactura-comercial';
import { TicketsPumpingService } from '../../../../operations/pumping/tickets-nuevos/services/tickets-pumping.service';
import type { DocumentoDelTicket } from '../../../../operations/pumping/tickets-nuevos/models/ticket-pumping';
import {
  CorregirDiaDialog,
  type CorregirDiaDialogData,
} from '../corregir-dia-dialog/corregir-dia-dialog';

/**
 * «Documentos de respaldo» del pedido, con la presentación de la demo: el avance de la documentación, y una tabla con cada documento
 * que Operaciones envió (Reporte Job por día, Reporte de Herramientas) con sus acciones: ver el formato, descargarlo en PDF y —quien tiene
 * el permiso, mientras el pedido no salga a firmas— corregir las actividades de un día.
 */
@Component({
  selector: 'app-documentos-respaldo',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillProgressComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documentos-respaldo.html',
  styleUrl: './documentos-respaldo.scss',
})
export class DocumentosRespaldo {
  private readonly servicio = inject(PedidosComercialService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly pdf = inject(DocumentoPdfService);
  private readonly ticketsPumping = inject(TicketsPumpingService);
  private readonly archivos = inject(ArchivosService);
  private readonly firmadosApi = inject(DocumentosFirmadosComercialService);

  readonly pedido = input.required<PedidoDetalle>();
  /** Persona con `comercial.documentos_operativos.corregir`. */
  readonly puedeCorregir = input(false);
  /** Persona con `comercial.documentos_operativos.ver`: sin él solo ve los adjuntos del pedido. */
  readonly puedeVerOperativos = input(true);
  /** Persona con `comercial.prefacturas.firmar`: carga la versión firmada del monitoreo y de la mezcla. */
  readonly puedeCargarFirmado = input(false);
  /** Persona con `pumping.documentos.ver`: ve el monitoreo y la mezcla química del ticket. */
  readonly puedeVerRespaldoTicket = input(false);
  /** Corregir un día cambia el avance documental y puede cambiar los pasos del pedido. */
  readonly cambioDePedido = output<void>();
  /** Pedido editable y persona con `comercial.pedidos.editar`: puede adjuntar y quitar documentos del pedido. */
  readonly puedeAdjuntar = input(false);
  /** Adjuntar o quitar devuelven el detalle completo del pedido. */
  readonly pedidoActualizado = output<PedidoDetalle>();

  protected readonly accept = ACCEPT_DOCUMENTOS;
  protected readonly maximo = MAX_DOCUMENTOS_PEDIDO;
  protected readonly tamano = formatoTamano;
  protected readonly subiendo = signal(false);
  protected readonly descargando = signal<string | null>(null);
  protected readonly errorSubida = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly documentos = signal<DocumentoOperativo[]>([]);
  protected readonly avance = signal<AvanceDocumental | null>(null);
  /** Monitoreo (uno por día) y mezcla química que Operaciones subió al ticket de Pumping. */
  protected readonly respaldoTicket = signal<DocumentoDelTicket[]>([]);
  /** Versión firmada vigente de cada documento del ticket, con el indicador de la lectura de la firma. */
  protected readonly firmados = signal<DocumentoFirmado[]>([]);
  protected readonly subiendoFirmado = signal<string | null>(null);
  protected readonly monitoreos = computed(() =>
    this.respaldoTicket()
      .filter((d) => d.tipo === 'monitoreo')
      .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '')),
  );
  protected readonly mezclas = computed(() =>
    this.respaldoTicket().filter((d) => d.tipo === 'mezcla_quimica'),
  );

  protected readonly reportesJob = computed(() => reportesJobOrdenados(this.documentos()));
  protected readonly reportesHtas = computed(() => reportesHerramientas(this.documentos()));
  /** Corregir solo mientras el pedido todavía admite cambios (el servidor lo vuelve a comprobar). */
  protected readonly admiteCorreccion = computed(
    () => this.puedeCorregir() && this.pedido().editable,
  );
  /** Hay formatos generados (Reporte Job o de Herramientas) que bajar juntos. */
  protected readonly hayFormatos = computed(
    () => this.reportesJob().length + this.reportesHtas().length > 0,
  );
  protected readonly sinDocumentos = computed(
    () =>
      this.reportesJob().length === 0 &&
      this.reportesHtas().length === 0 &&
      this.respaldoTicket().length === 0 &&
      this.pedido().documentos.length === 0,
  );
  protected readonly diasHechos = computed(() => this.avance()?.diasConReporteJob ?? 0);
  protected readonly diasEsperados = computed(() => this.avance()?.diasEsperados ?? 0);

  protected readonly fecha = (iso: string | null) => formatoDia(iso);
  protected readonly origen = etiquetaOrigen;

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  /** Vuelve a pedir los documentos (tras corregir un día). */
  recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    const id = this.pedido().id;
    const ticket = this.pedido().ticketOperativo;
    const respaldo$ =
      this.puedeVerRespaldoTicket() && ticket?.origen === 'pumping'
        ? this.ticketsPumping
            .documentos(ticket.ticketId)
            .pipe(catchError(() => of([] as DocumentoDelTicket[])))
        : of([] as DocumentoDelTicket[]);
    forkJoin({
      docs: this.puedeVerOperativos()
        ? this.servicio.documentosOperativos(id)
        : of([] as DocumentoOperativo[]),
      avance: this.puedeVerOperativos() ? this.servicio.avanceDocumental(id) : of(null),
      respaldo: respaldo$,
      firmados: this.puedeVerOperativos()
        ? this.firmadosApi.delPedido(id).pipe(catchError(() => of([] as DocumentoFirmado[])))
        : of([] as DocumentoFirmado[]),
    }).subscribe({
      next: ({ docs, avance, respaldo, firmados }) => {
        this.respaldoTicket.set(respaldo);
        this.firmados.set(firmados);
        this.sondearFirmas();
        this.documentos.set(docs);
        this.avance.set(avance);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(
          mensajeDeError(
            err,
            'No se pudieron cargar los documentos de respaldo. Intente de nuevo.',
          ),
        );
      },
    });
  }

  // ── Formatos (PDF) ──
  private encabezado(d?: DocumentoOperativo): OperativoDocHeader {
    const p = this.pedido();
    return {
      code: d?.ticketRef ?? (p.ticketNumero ? String(p.ticketNumero) : (p.codigo ?? '')),
      cliente: p.cliente.nombre ?? '',
      pozo: p.ubicacion.pozo ?? '',
      supervisor: d?.supervisor?.nombre,
      operador: d?.operador?.nombre,
    };
  }

  private extras(): ReporteJobExtras {
    const p = this.pedido();
    return {
      campoBloque: [p.ubicacion.campo, p.ubicacion.bloque].filter(Boolean).join(' / '),
      taladro: p.ubicacion.rigless ? 'RIGLESS' : (p.ubicacion.taladro ?? ''),
      ordenContrato: p.numeroContrato ?? '',
      representanteCliente: p.responsables.representanteCampo.nombre ?? '',
      cargoRepresentante: 'Representante de Campo',
    };
  }

  private bitacora(docs: readonly DocumentoOperativo[]): OperativoActivityLogEntry[] {
    return docs.flatMap((d) =>
      d.actividades.map((a) => ({
        id: a.orden,
        date: (a.fecha ?? d.fecha ?? '').slice(0, 10),
        startTime: a.horaInicio ?? '',
        endTime: a.horaFin ?? '',
        durationHours: a.duracionHoras ?? 0,
        detail: a.detalle ?? '',
        author: a.autor ?? '',
      })),
    );
  }

  protected verReporteJob(d: DocumentoOperativo, descargar = false): void {
    this.pdf.abrir({
      titulo: `Reporte Job — ${formatoDia(d.fecha)}`,
      component: ReporteJobHoja,
      inputs: { header: this.encabezado(d), log: this.bitacora([d]), extras: this.extras() },
      nombreArchivo:
        `Reporte diario de actividades ${this.encabezado(d).code} ${d.fecha ?? ''}`.trim(),
      descargar,
    });
  }

  /** Un solo PDF de Reporte de Herramientas con todo lo recibido. */
  protected verReporteHerramientas(descargar = false): void {
    const docs = this.reportesHtas();
    if (!docs.length) return;
    const { tools, usageLog } = herramientasParaHoja(docs);
    this.pdf.abrir({
      titulo: 'Reporte de Herramientas',
      component: ReporteHerramientasHoja,
      inputs: { header: this.encabezado(docs[0]), tools, usageLog },
      orientacion: 'landscape',
      nombreArchivo: `Reporte de Herramientas ${this.encabezado(docs[0]).code}`,
      descargar,
    });
  }

  /**
   * Todos los formatos generados del pedido en un solo PDF: un Reporte Job por día y el Reporte de Herramientas. Los archivos que se
   * subieron (monitoreo, mezcla química, adjuntos, versiones firmadas) siguen descargándose uno a uno desde su fila.
   */
  protected descargarTodo(): void {
    const jobs = this.reportesJob();
    const htas = this.reportesHtas();
    if (!jobs.length && !htas.length) return;
    const primero = jobs[0] ?? htas[0];
    this.pdf.abrir({
      titulo: 'Documentos del pedido',
      component: DocumentosPedidoHoja,
      inputs: {
        reportesJob: jobs.map((d) => ({ header: this.encabezado(d), log: this.bitacora([d]) })),
        herramientas: htas.length
          ? { header: this.encabezado(htas[0]), ...herramientasParaHoja(htas) }
          : null,
        extras: this.extras(),
      },
      nombreArchivo: `Documentos del pedido ${this.encabezado(primero).code}`,
      descargar: true,
    });
  }
  protected firmadoDe(d: DocumentoDelTicket): DocumentoFirmado | undefined {
    return this.firmados().find((f) => f.documentoTicketId === d.id);
  }

  /** Solo saber si se detecta una firma o no: el texto sale del mismo indicador que usan las prefacturas. */
  protected estadoFirma(f: DocumentoFirmado) {
    return estadoVerificacion({ ...f, nombreCoincide: null }, false);
  }

  /** La lectura de la firma tarda unos segundos: se vuelve a consultar mientras haya resultados pendientes (hasta ~40 s). */
  private sondearFirmas(intento = 0): void {
    if (intento >= 14 || !this.firmados().some((f) => f.verificacionAt === null)) return;
    timer(3000)
      .pipe(switchMap(() => this.firmadosApi.delPedido(this.pedido().id)))
      .subscribe({
        next: (f) => {
          this.firmados.set(f);
          this.sondearFirmas(intento + 1);
        },
        error: () => undefined,
      });
  }

  protected onFirmado(evento: Event, d: DocumentoDelTicket): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo || this.subiendoFirmado()) return;
    const ext = archivo.name.split('.').pop()?.toLowerCase() ?? '';
    const tipoOk =
      ['application/pdf', 'image/png', 'image/jpeg'].includes(archivo.type) ||
      ['pdf', 'png', 'jpg', 'jpeg'].includes(ext);
    if (!tipoOk)
      return void this.notify.error(
        'Archivo no admitido',
        'La versión firmada debe ser PDF, PNG o JPEG.',
      );
    if (archivo.size <= 0 || archivo.size > MAX_BYTES_FIRMA) {
      return void this.notify.error(
        'Archivo no admitido',
        'El archivo está vacío o supera el máximo de 25 MB.',
      );
    }
    this.subiendoFirmado.set(d.id);
    this.archivos
      .subir(archivo, MODULO_ARCHIVO_FIRMADO)
      .pipe(
        switchMap((subido) =>
          this.firmadosApi.cargar(this.pedido().id, {
            tipo: d.tipo,
            documentoTicketId: d.id,
            ...(d.fecha ? { fecha: d.fecha.slice(0, 10) } : {}),
            archivoId: subido.id,
          }),
        ),
      )
      .subscribe({
        next: (f) => {
          this.subiendoFirmado.set(null);
          this.firmados.set(f);
          this.notify.success('Versión firmada cargada', archivo.name);
          this.sondearFirmas();
        },
        error: (err) => {
          this.subiendoFirmado.set(null);
          this.notify.error('No se pudo cargar', mensajeErrorArchivo(err));
        },
      });
  }

  protected descargarFirmado(f: DocumentoFirmado): void {
    this.archivos.contenido(f.archivoId).subscribe({
      next: (blob) => this.archivos.guardarComo(blob, f.archivoNombre),
      error: () =>
        this.notify.error(
          'No se pudo descargar',
          'No se pudo descargar el documento firmado. Intente de nuevo.',
        ),
    });
  }

  /** Baja el archivo del ticket (el contenido exige el token, por eso va como blob). */
  protected descargarDelTicket(d: DocumentoDelTicket): void {
    const nombre =
      d.tipo === 'monitoreo' ? `Monitoreo ${d.fecha?.slice(0, 10) ?? ''}`.trim() : 'Mezcla química';
    this.archivos.contenido(d.archivoId).subscribe({
      next: (blob) => this.archivos.guardarComo(blob, nombre),
      error: () =>
        this.notify.error(
          'No se pudo descargar',
          'No se pudo descargar el documento. Intente de nuevo.',
        ),
    });
  }

  /** Adjunto del pedido: primero se sube al módulo de archivos y luego se adjunta al pedido. */
  protected onArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo || this.subiendo()) return;
    const error = errorDeArchivo(archivo, this.pedido().documentos.length);
    if (error) {
      this.errorSubida.set(error);
      return;
    }
    this.errorSubida.set(null);
    this.subiendo.set(true);
    this.archivos
      .subir(archivo)
      .pipe(switchMap((subido) => this.servicio.adjuntarDocumento(this.pedido().id, subido.id)))
      .subscribe({
        next: (p) => {
          this.subiendo.set(false);
          this.notify.success('Documento adjuntado', archivo.name);
          this.pedidoActualizado.emit(p);
        },
        error: (err) => {
          this.subiendo.set(false);
          this.errorSubida.set(mensajeErrorArchivo(err));
        },
      });
  }

  protected descargarAdjunto(d: DocumentoPedido): void {
    if (this.descargando()) return;
    this.descargando.set(d.id);
    this.archivos.contenido(d.archivoId).subscribe({
      next: (blob) => {
        this.descargando.set(null);
        this.archivos.guardarComo(blob, d.nombre);
      },
      error: () => {
        this.descargando.set(null);
        this.notify.error(
          'No se pudo descargar',
          'No se pudo descargar el documento. Intente de nuevo.',
        );
      },
    });
  }

  protected async quitarAdjunto(d: DocumentoPedido): Promise<void> {
    const ok = await this.dialog.confirm({
      title: `¿Quitar "${d.nombre}"?`,
      content:
        'El documento se quita del pedido y se da de baja. Esta acción no se puede deshacer.',
      okText: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    this.servicio.quitarDocumento(this.pedido().id, d.id).subscribe({
      next: (p) => {
        this.notify.success('Documento quitado', d.nombre);
        this.pedidoActualizado.emit(p);
      },
      error: (err) =>
        this.notify.error(
          'No se pudo quitar',
          mensajeDeError(err, 'No se pudo quitar el documento.'),
        ),
    });
  }

  protected corregir(d: DocumentoOperativo): void {
    if (!d.fecha) return;
    const ref = this.dialog.open<CorregirDiaDialog, CorregirDiaDialogData>({
      title: `Corregir actividades — ${formatoDia(d.fecha)}`,
      content: CorregirDiaDialog,
      data: {
        pedidoId: this.pedido().id,
        origen: d.origen,
        fecha: d.fecha.slice(0, 10),
        actividades: d.actividades,
      },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((cambio: boolean | undefined) => {
      if (!cambio) return;
      this.notify.success(
        'Día corregido',
        `Se actualizó el Reporte Job del ${formatoDia(d.fecha)}.`,
      );
      this.cargar();
      this.cambioDePedido.emit();
    });
  }
}
