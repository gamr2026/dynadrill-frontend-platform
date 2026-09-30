import { inject, Injectable, Type } from '@angular/core';
import { DynadrillDialogService } from '@digitec-it-projects/dynadrill-ui';
import { DocumentoOrientacion, DocumentoPdfData, DocumentoPdfDialog } from './documento-pdf-dialog';

export interface AbrirDocumentoPdf {
  /** Título de la ventana (ej. "Reporte de Unidad — R3095"). */
  titulo: string;
  component: Type<unknown>;
  inputs: Record<string, unknown>;
  /** Por defecto vertical; los formatos anchos (tablas de muchas columnas) se imprimen en horizontal. */
  orientacion?: DocumentoOrientacion;
  nombreArchivo?: string;
}

/** Punto único para abrir un formato digitalizado en su vista de impresión (PDF). */
@Injectable({ providedIn: 'root' })
export class DocumentoPdfService {
  private readonly dialog = inject(DynadrillDialogService);

  abrir(config: AbrirDocumentoPdf): void {
    this.dialog.open<DocumentoPdfDialog, DocumentoPdfData>({
      title: config.titulo,
      content: DocumentoPdfDialog,
      data: {
        component: config.component,
        inputs: config.inputs,
        orientacion: config.orientacion ?? 'portrait',
        nombreArchivo: config.nombreArchivo ?? config.titulo,
      },
      footer: false,
      width: config.orientacion === 'landscape' ? 1180 : 940,
    });
  }
}
