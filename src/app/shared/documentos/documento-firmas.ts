import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface DocumentoFirmante {
  /** Rol o cargo del que firma (ej. "OPERADOR", "Gerente que autoriza"). */
  cargo: string;
  /** Nombre impreso — se deja vacío cuando lo completa a mano quien firma. */
  nombre?: string;
  /** Línea extra bajo el nombre (ej. "Nombre y Firma", C.I.). */
  detalle?: string;
}

/**
 * Sección de firmas del PDF: un recuadro por persona con espacio para firmar a mano (o con firma electrónica sobre
 * el archivo). Solo se arma al generar el documento — en las pantallas de la app no hay firma.
 */
@Component({
  selector: 'app-doc-firmas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="doc-firmas" [class.doc-firmas--banda]="banda()">
      @for (f of firmantes(); track $index) {
        <div class="doc-firmas__caja">
          <div class="doc-firmas__cargo">{{ f.cargo }}</div>
          <div class="doc-firmas__espacio"></div>
          <div class="doc-firmas__nombre">
            <span class="doc-firmas__etiqueta">Nombre:</span> {{ f.nombre }}
          </div>
          @if (f.detalle) {
            <div class="doc-firmas__detalle">{{ f.detalle }}</div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .doc-firmas {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      border: 1px solid #000;
      break-inside: avoid;
    }

    .doc-firmas__caja {
      display: flex;
      flex-direction: column;
      min-height: 92px;
      border-right: 1px solid #000;

      &:last-child {
        border-right: none;
      }
    }

    .doc-firmas__cargo {
      padding: 3px 6px;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      border-bottom: 1px solid #000;
    }

    .doc-firmas--banda .doc-firmas__cargo {
      background: #800000;
      color: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .doc-firmas__espacio {
      flex: 1;
      min-height: 44px;
    }

    .doc-firmas__nombre {
      padding: 3px 6px;
      font-size: 10px;
      border-top: 1px solid #000;
    }

    .doc-firmas__etiqueta {
      font-weight: 700;
    }

    .doc-firmas__detalle {
      padding: 0 6px 3px;
      font-size: 8px;
      text-align: center;
    }
  `,
})
export class DocumentoFirmas {
  readonly firmantes = input.required<DocumentoFirmante[]>();
  /** Cabecera de cada caja con la banda de color del formato (ej. guinda en el Reporte de Unidad). */
  readonly banda = input<boolean>(false);
}
