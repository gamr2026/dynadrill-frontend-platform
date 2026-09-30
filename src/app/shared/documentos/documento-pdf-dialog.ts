import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Type } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent } from '@digitec-it-projects/dynadrill-ui';

export type DocumentoOrientacion = 'portrait' | 'landscape';

export interface DocumentoPdfData {
  /** Componente "hoja" del formato (ver `DocumentoEncabezado`/`DocumentoFirmas`) — recibe `inputs` como inputs de señal. */
  component: Type<unknown>;
  inputs: Record<string, unknown>;
  orientacion: DocumentoOrientacion;
  /** Nombre sugerido del archivo: el navegador lo toma del título de la página al "Guardar como PDF". */
  nombreArchivo: string;
}

/**
 * Vista previa + impresión de un formato (DYN-…) armado como HTML — mismo mecanismo `window.print()` del resto de
 * documentos, para que el PDF salga lo más parecido posible al formato físico. La sección de firmas solo existe
 * acá (en el PDF): quien lo descarga lo firma a mano o con firma electrónica sobre el archivo.
 */
@Component({
  selector: 'app-documento-pdf-dialog',
  imports: [NgComponentOutlet, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="doc-pdf-scroll">
      <ng-container *ngComponentOutlet="data.component; inputs: data.inputs" />
    </div>
    <footer class="doc-pdf-actions no-print">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
      <dynadrill-button (clicked)="imprimir()">Imprimir / Guardar PDF</dynadrill-button>
    </footer>
  `,
  styles: `
    .doc-pdf-scroll {
      max-height: 70vh;
      overflow: auto;
      padding: 4px;
      background: var(--surface-muted, #f4f3f8);
    }

    .doc-pdf-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
    }

    @media (max-width: 840px) {
      .doc-pdf-scroll {
        max-height: none;
      }

      .doc-pdf-actions {
        position: sticky;
        bottom: 0;
        padding: 12px 0 0;
        background: var(--surface, #fff);
      }
    }
  `,
})
export class DocumentoPdfDialog {
  protected readonly data = inject<DocumentoPdfData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<DocumentoPdfDialog>);

  protected cerrar(): void {
    this.modalRef.close();
  }

  /** Orientación y nombre de archivo son por documento: se inyectan solo durante la impresión y se retiran al terminar. */
  protected imprimir(): void {
    const estilo = document.createElement('style');
    estilo.textContent = `@page { size: A4 ${this.data.orientacion}; margin: 8mm; }`;
    document.head.appendChild(estilo);
    const tituloPrevio = document.title;
    document.title = this.data.nombreArchivo;
    const restaurar = (): void => {
      estilo.remove();
      document.title = tituloPrevio;
      window.removeEventListener('afterprint', restaurar);
    };
    window.addEventListener('afterprint', restaurar);
    window.print();
  }
}
