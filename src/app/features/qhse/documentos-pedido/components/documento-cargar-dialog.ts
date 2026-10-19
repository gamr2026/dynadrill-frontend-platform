import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import {
  TIPOS_GENERALES,
  TIPO_DOCUMENTO_ETIQUETA,
  exigeFecha,
  fechaIso,
  pendientesDeCarga,
  type DocumentoPedido,
  type TipoDocumentoGeneral,
} from '../models/documento-pedido';
import { DocumentosPedidoService } from '../services/documentos-pedido.service';

export interface DocumentoCargarDialogData {
  pedidoId: string;
  pedidoCodigo: string;
  /** Tipo con el que se abre (por ejemplo, desde el botón «Subir SFI» de la fila). */
  tipo?: TipoDocumentoGeneral;
}

/**
 * Carga un documento de seguridad del pedido: formato de recepción, ART, PT o SFI. El ART pide su fecha de emisión (vale 15 días) y el
 * PT el día de operación. El Acta de Entrega no se carga aquí: la sube el Supervisor desde su ticket.
 */
@Component({
  selector: 'app-documento-cargar-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillButtonComponent,
    DynadrillDatetimePickerComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dcd">
      <dynadrill-text variant="body">Pedido {{ data.pedidoCodigo }}</dynadrill-text>
      <dynadrill-select
        label="Documento"
        placeholder="Elija el tipo"
        [options]="opcionesTipo"
        [value]="tipo() ?? ''"
        (valueChange)="tipo.set($any($event) || null)"
      />
      @if (pideFecha()) {
        <dynadrill-datetime-picker
          mode="date"
          [label]="
            tipo() === 'art' ? 'Fecha de emisión del ART (vale 15 días)' : 'Día de operación del PT'
          "
          [value]="fecha()!"
          (valueChange)="fecha.set($event)"
        />
      }
      <dynadrill-input
        label="Número del documento (opcional)"
        [value]="referencia()"
        (valueChange)="referencia.set($event)"
      />
      <label class="dcd__archivo">
        <span>Archivo (PDF, imagen, Word o Excel)</span>
        <input type="file" (change)="elegir($event)" />
      </label>
      @if (faltan().length) {
        <dynadrill-text variant="caption">Falta: {{ faltan().join(', ') }}.</dynadrill-text>
      }
    </div>
    <footer class="dcd__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="faltan().length > 0 || enviando()" (clicked)="cargar()">{{
        enviando() ? 'Cargando…' : 'Cargar documento'
      }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .dcd {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .dcd__archivo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
    }
    .dcd__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class DocumentoCargarDialog {
  protected readonly data = inject<DocumentoCargarDialogData>(NZ_MODAL_DATA);
  private readonly servicio = inject(DocumentosPedidoService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<DocumentoCargarDialog, DocumentoPedido | undefined>,
  );

  protected readonly opcionesTipo: DynadrillSelectOption[] = TIPOS_GENERALES.map((t) => ({
    value: t,
    label: TIPO_DOCUMENTO_ETIQUETA[t],
  }));
  protected readonly tipo = signal<TipoDocumentoGeneral | null>(this.data.tipo ?? null);
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly referencia = signal('');
  protected readonly archivo = signal<File | null>(null);
  protected readonly enviando = signal(false);

  protected readonly pideFecha = computed(() => {
    const t = this.tipo();
    return t !== null && exigeFecha(t);
  });
  protected readonly faltan = computed(() =>
    pendientesDeCarga({ tipo: this.tipo(), fecha: this.fecha(), archivo: this.archivo() }),
  );

  protected elegir(evento: Event): void {
    this.archivo.set((evento.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected cargar(): void {
    const tipo = this.tipo();
    const archivo = this.archivo();
    if (!tipo || !archivo || this.faltan().length || this.enviando()) return;
    this.enviando.set(true);
    const fecha = this.fecha();
    this.servicio
      .cargar(archivo, {
        pedidoId: this.data.pedidoId,
        tipo,
        ...(this.referencia().trim() ? { referencia: this.referencia().trim() } : {}),
        ...(exigeFecha(tipo) && fecha ? { fecha: fechaIso(fecha) } : {}),
      })
      .subscribe({
        next: (d) => {
          this.notify.success('Guardado', `${TIPO_DOCUMENTO_ETIQUETA[tipo]} cargado.`);
          this.modalRef.close(d);
        },
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo cargar',
            mensajeDeError(err, 'No se pudo cargar el documento.'),
          );
        },
      });
  }
}
