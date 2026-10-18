import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../shared/components/motivo-dialog/motivo-dialog';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import {
  PERMISO_DOCUMENTOS_GESTIONAR,
  TIPO_DOCUMENTO_ETIQUETA,
  type DocumentoPedido,
} from '../models/documento-pedido';
import { DocumentosPedidoService } from '../services/documentos-pedido.service';

export interface DocumentosDetalleDialogData {
  pedidoId: string;
  pedidoCodigo: string;
}

/** Todos los documentos de un pedido, con los anulados (historia): abrirlos y anular uno con su motivo. */
@Component({
  selector: 'app-documentos-detalle-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DatePipe, DynadrillButtonComponent, DynadrillTagComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dynadrill-text variant="body">Pedido {{ data.pedidoCodigo }}</dynadrill-text>
    @if (documentos().length === 0) {
      <dynadrill-text variant="caption">{{
        cargando() ? 'Consultando…' : 'Este pedido aún no tiene documentos cargados.'
      }}</dynadrill-text>
    }
    <ul class="dd">
      @for (d of documentos(); track d.id) {
        <li class="dd__fila">
          <div class="dd__texto">
            <strong>{{ etiqueta[d.tipo] }}</strong>
            @if (d.referencia) {
              <span> · N.º {{ d.referencia }}</span>
            }
            @if (d.fecha) {
              <span> · {{ d.fecha | date: 'dd/MM/yyyy' }}</span>
            }
            @if (d.vigenteHasta) {
              <span> · vale hasta {{ d.vigenteHasta | date: 'dd/MM/yyyy' }}</span>
            }
            <div class="dd__meta">
              Cargado por {{ d.cargadoPor }} el {{ d.createdAt | date: 'dd/MM/yyyy HH:mm' }}
            </div>
            @if (d.anulado) {
              <div class="dd__meta">Anulado por {{ d.anuladoPor }} — {{ d.motivoAnulacion }}</div>
            }
          </div>
          <div class="dd__acciones">
            @if (d.anulado) {
              <dynadrill-tag variant="neutral">Anulado</dynadrill-tag>
            } @else if (d.vencido) {
              <dynadrill-tag variant="error">Vencido</dynadrill-tag>
            }
            <dynadrill-button variant="secondary" (clicked)="abrir(d)">Ver</dynadrill-button>
            @if (puedeAnular() && !d.anulado) {
              <dynadrill-button variant="secondary" (clicked)="anular(d)">Anular</dynadrill-button>
            }
          </div>
        </li>
      }
    </ul>
    <footer class="dd__pie">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
    </footer>
  `,
  styles: `
    .dd {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .dd__fila {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #ecebf1;
    }
    .dd__meta {
      font-size: 12px;
      color: #6b6a77;
      margin-top: 2px;
    }
    .dd__acciones {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .dd__pie {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class DocumentosDetalleDialog {
  protected readonly data = inject<DocumentosDetalleDialogData>(NZ_MODAL_DATA);
  private readonly servicio = inject(DocumentosPedidoService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<DocumentosDetalleDialog, boolean | undefined>);

  protected readonly etiqueta = TIPO_DOCUMENTO_ETIQUETA;
  protected readonly cargando = signal(true);
  protected readonly documentos = signal<DocumentoPedido[]>([]);
  protected readonly puedeAnular = computed(() => this.auth.can(PERMISO_DOCUMENTOS_GESTIONAR));
  private huboCambio = false;

  constructor() {
    this.recargar();
  }

  private recargar(): void {
    this.servicio.listar({ pedidoId: this.data.pedidoId, incluirAnulados: true }).subscribe({
      next: (d) => {
        this.documentos.set(d);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar los documentos.'));
      },
    });
  }

  protected abrir(d: DocumentoPedido): void {
    this.servicio.abrir(d.archivoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) =>
        this.notify.error(
          'No se pudo abrir',
          mensajeDeError(err, 'No se pudo abrir el documento.'),
        ),
    });
  }

  protected anular(d: DocumentoPedido): void {
    const aviso =
      d.tipo === 'formato_entrega' ? 'El ticket volverá a exigir el Acta para cerrarse. ' : '';
    const ref = this.dialogos.open<MotivoDialog, MotivoDialogData>({
      title: `Anular ${TIPO_DOCUMENTO_ETIQUETA[d.tipo]}`,
      content: MotivoDialog,
      data: {
        mensaje: `${aviso}¿Por qué se anula este documento?`,
        label: 'Motivo de la anulación',
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (!motivo) return;
      this.servicio.anular(d.id, motivo).subscribe({
        next: () => {
          this.huboCambio = true;
          this.notify.success('Anulado', 'El documento quedó anulado.');
          this.recargar();
        },
        error: (err) =>
          this.notify.error(
            'No se pudo anular',
            mensajeDeError(err, 'No se pudo anular el documento.'),
          ),
      });
    });
  }

  protected cerrar(): void {
    this.modalRef.close(this.huboCambio);
  }
}
