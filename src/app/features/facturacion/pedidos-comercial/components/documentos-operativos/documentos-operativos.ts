import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DynadrillBannerComponent, DynadrillDialogService, DynadrillIconButtonComponent, DynadrillNotificationService, DynadrillProgressComponent, DynadrillSpinnerComponent, DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import {
  etiquetaOrigen,
  etiquetaUso,
  formatoHoras,
  herramientasSinCodigo,
  horasTotales,
  listaDeChequeo,
  porcentajeReporteJob,
  reportesHerramientas,
  reportesJobOrdenados,
  type AvanceDocumental,
  type DocumentoOperativo,
  type PuntoChequeo,
} from '../../models/documentos-operativos';
import { formatoDia, mensajeDeError } from '../../models/pedido-comercial.model';

/**
 * Documentos operativos del pedido (solo lectura: los envía Operaciones). Muestra el avance documental, los Reportes
 * Job por día y el Reporte de Herramientas con sus usos. Quitar un documento exige `puedeEliminar` y confirmación.
 */
@Component({
  selector: 'app-documentos-operativos',
  imports: [DynadrillBannerComponent, DynadrillIconButtonComponent, DynadrillProgressComponent, DynadrillSpinnerComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documentos-operativos.html',
  styleUrl: './documentos-operativos.scss',
})
export class DocumentosOperativos {
  private readonly servicio = inject(PedidosComercialService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly pedidoId = input.required<string>();
  /** Persona con `comercial.documentos_operativos.eliminar`. */
  readonly puedeEliminar = input(false);
  /** Quitar un documento puede cambiar el avance y los pasos del pedido. */
  readonly cambioDePedido = output<void>();

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly documentos = signal<DocumentoOperativo[]>([]);
  protected readonly avance = signal<AvanceDocumental | null>(null);

  protected readonly reportesJob = computed(() => reportesJobOrdenados(this.documentos()));
  protected readonly reportesHtas = computed(() => reportesHerramientas(this.documentos()));
  protected readonly chequeo = computed<PuntoChequeo[]>(() => (this.avance() ? listaDeChequeo(this.avance() as AvanceDocumental) : []));
  protected readonly porcentaje = computed(() => (this.avance() ? porcentajeReporteJob(this.avance() as AvanceDocumental) : 0));
  protected readonly vacio = computed(() => this.documentos().length === 0);

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({ docs: this.servicio.documentosOperativos(this.pedidoId()), avance: this.servicio.avanceDocumental(this.pedidoId()) }).subscribe({
      next: ({ docs, avance }) => {
        this.documentos.set(docs);
        this.avance.set(avance);
        this.cargando.set(false);
      },
      error: err => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(err, 'No se pudieron cargar los documentos operativos. Intente de nuevo.'));
      },
    });
  }

  protected async eliminar(d: DocumentoOperativo): Promise<void> {
    const nombre = d.tipo === 'reporte_job' ? `Reporte Job del ${formatoDia(d.fecha)}` : 'Reporte de Herramientas';
    const ok = await this.dialog.confirm({
      title: `¿Quitar el ${nombre}?`,
      content: 'Operaciones tendrá que enviarlo de nuevo. Solo se puede quitar mientras el pedido siga en la etapa de documentos.',
      okText: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    this.servicio.eliminarDocumentoOperativo(this.pedidoId(), d.id).subscribe({
      next: () => {
        this.notify.success('Documento quitado', nombre);
        this.cargar();
        this.cambioDePedido.emit();
      },
      error: err => this.notify.error('No se pudo quitar', mensajeDeError(err, 'No se pudo quitar el documento operativo.')),
    });
  }

  protected readonly dia = formatoDia;
  protected readonly origen = etiquetaOrigen;
  protected readonly uso = etiquetaUso;
  protected readonly horas = (d: DocumentoOperativo) => formatoHoras(horasTotales(d.actividades));
  protected readonly sinCodigo = (d: DocumentoOperativo) => herramientasSinCodigo(d.herramientas);
  protected readonly tonoChequeo = (p: PuntoChequeo) => (p.estado === 'ok' ? 'success' : p.estado === 'na' ? 'neutral' : 'warning');
  protected readonly marcaChequeo = (p: PuntoChequeo) => (p.estado === 'ok' ? 'Cumplido' : p.estado === 'na' ? 'No aplica' : 'Pendiente');
}
