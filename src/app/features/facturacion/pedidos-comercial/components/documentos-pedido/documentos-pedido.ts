import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { switchMap } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
} from '@digitec-it-projects/dynadrill-ui';
import { ArchivosService } from '../../services/archivos.service';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';
import {
  ACCEPT_DOCUMENTOS,
  MAX_DOCUMENTOS_PEDIDO,
  errorDeArchivo,
  formatoTamano,
  mensajeErrorArchivo,
  type DocumentoPedido,
} from '../../models/documentos-pedido';
import {
  formatoDia,
  mensajeDeError,
  type PedidoDetalle,
} from '../../models/pedido-comercial.model';

/**
 * Sección "Documentos" de un pedido: lista, descarga para quien ve el pedido y, solo con `puedeEditar`, adjuntar
 * (subir el archivo y luego adjuntarlo) y quitar con confirmación.
 */
@Component({
  selector: 'app-documentos-pedido',
  imports: [DynadrillBannerComponent, DynadrillButtonComponent, DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documentos-pedido.html',
  styleUrl: './documentos-pedido.scss',
})
export class DocumentosPedido {
  private readonly archivos = inject(ArchivosService);
  private readonly pedidos = inject(PedidosComercialService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly pedidoId = input.required<string>();
  readonly documentos = input<DocumentoPedido[]>([]);
  /** Pedido editable y persona con `comercial.pedidos.editar`. */
  readonly puedeEditar = input(false);
  /** El pedido cambió (adjuntar o quitar devuelven el detalle completo). */
  readonly cambio = output<PedidoDetalle>();

  protected readonly accept = ACCEPT_DOCUMENTOS;
  protected readonly maximo = MAX_DOCUMENTOS_PEDIDO;
  protected readonly subiendo = signal(false);
  protected readonly descargando = signal<string | null>(null);
  protected readonly errorSubida = signal<string | null>(null);

  protected onArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo || this.subiendo()) return;
    const error = errorDeArchivo(archivo, this.documentos().length);
    if (error) {
      this.errorSubida.set(error);
      return;
    }
    this.errorSubida.set(null);
    this.subiendo.set(true);
    // Secuencia: primero se sube al módulo de archivos y luego se adjunta al pedido.
    this.archivos
      .subir(archivo)
      .pipe(switchMap((subido) => this.pedidos.adjuntarDocumento(this.pedidoId(), subido.id)))
      .subscribe({
        next: (p) => {
          this.subiendo.set(false);
          this.notify.success('Documento adjuntado', archivo.name);
          this.cambio.emit(p);
        },
        error: (err) => {
          this.subiendo.set(false);
          this.errorSubida.set(mensajeErrorArchivo(err));
        },
      });
  }

  protected descargar(d: DocumentoPedido): void {
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

  protected async quitar(d: DocumentoPedido): Promise<void> {
    const ok = await this.dialog.confirm({
      title: `¿Quitar "${d.nombre}"?`,
      content:
        'El documento se quita del pedido y se da de baja. Esta acción no se puede deshacer.',
      okText: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    this.pedidos.quitarDocumento(this.pedidoId(), d.id).subscribe({
      next: (p) => {
        this.notify.success('Documento quitado', d.nombre);
        this.cambio.emit(p);
      },
      error: (err) =>
        this.notify.error(
          'No se pudo quitar',
          mensajeDeError(err, 'No se pudo quitar el documento.'),
        ),
    });
  }

  protected readonly tamano = formatoTamano;
  protected readonly dia = formatoDia;
}
