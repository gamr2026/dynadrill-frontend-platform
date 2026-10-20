import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillProgressComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type {
  OperativoActivityLogEntry,
  OperativoDocHeader,
  OperativoToolRef,
  OperativoToolUsageEntry,
} from '../../../../../shared/models/operativo-docs.model';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { ReporteHerramientasHoja } from '../../../../../shared/documentos/formatos/reporte-herramientas-hoja';
import {
  ReporteJobHoja,
  type ReporteJobExtras,
} from '../../../../../shared/documentos/formatos/reporte-job-hoja';
import {
  etiquetaOrigen,
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
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
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

  readonly pedido = input.required<PedidoDetalle>();
  /** Persona con `comercial.documentos_operativos.corregir`. */
  readonly puedeCorregir = input(false);
  /** Corregir un día cambia el avance documental y puede cambiar los pasos del pedido. */
  readonly cambioDePedido = output<void>();

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly documentos = signal<DocumentoOperativo[]>([]);
  protected readonly avance = signal<AvanceDocumental | null>(null);

  protected readonly reportesJob = computed(() => reportesJobOrdenados(this.documentos()));
  protected readonly reportesHtas = computed(() => reportesHerramientas(this.documentos()));
  /** Corregir solo mientras el pedido todavía admite cambios (el servidor lo vuelve a comprobar). */
  protected readonly admiteCorreccion = computed(
    () => this.puedeCorregir() && this.pedido().editable,
  );
  protected readonly sinDocumentos = computed(
    () => this.reportesJob().length === 0 && this.reportesHtas().length === 0,
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
    forkJoin({
      docs: this.servicio.documentosOperativos(id),
      avance: this.servicio.avanceDocumental(id),
    }).subscribe({
      next: ({ docs, avance }) => {
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
    const tools: OperativoToolRef[] = [];
    const usageLog: OperativoToolUsageEntry[] = [];
    let n = 0;
    for (const d of docs) {
      for (const h of d.herramientas) {
        const id = ++n;
        tools.push({
          id,
          name: h.nombre,
          serialCode: h.serie ?? undefined,
          codigo: h.codigo ?? undefined,
        });
        for (const u of h.usos)
          usageLog.push({
            id: usageLog.length + 1,
            toolId: id,
            date: u.fecha.slice(0, 10),
            status: u.estado,
          });
      }
    }
    this.pdf.abrir({
      titulo: 'Reporte de Herramientas',
      component: ReporteHerramientasHoja,
      inputs: { header: this.encabezado(docs[0]), tools, usageLog },
      orientacion: 'landscape',
      nombreArchivo: `Reporte de Herramientas ${this.encabezado(docs[0]).code}`,
      descargar,
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
