import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Cabecera de los formatos Dynadrill: logo | título | código, versión y fecha de elaboración. */
@Component({
  selector: 'app-doc-encabezado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="doc-encabezado">
      <tr>
        <td class="doc-encabezado__logo"><img src="/brand/dynadrill-logo.svg" alt="Dynadrill" /></td>
        <td class="doc-encabezado__titulo">{{ titulo() }}</td>
        <td class="doc-encabezado__meta">
          <div>{{ codigo() }}</div>
          <div>Versión: {{ version() }}</div>
          @if (elaboracion()) {
            <div>ELABORACIÓN: {{ elaboracion() }}</div>
          }
          @if (revision()) {
            <div>REVISIÓN: {{ revision() }}</div>
          }
        </td>
      </tr>
    </table>
  `,
  styles: `
    .doc-encabezado {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .doc-encabezado td {
      border: 1px solid #000;
      padding: 6px 8px;
      vertical-align: middle;
    }

    .doc-encabezado__logo {
      width: 26%;
      text-align: center;

      img {
        max-width: 140px;
        max-height: 54px;
      }
    }

    .doc-encabezado__titulo {
      text-align: center;
      font-size: 18px;
      font-weight: 400;
    }

    .doc-encabezado__meta {
      width: 26%;
      font-size: 9px;
      line-height: 1.4;
      text-align: center;
    }
  `,
})
export class DocumentoEncabezado {
  readonly titulo = input.required<string>();
  readonly codigo = input.required<string>();
  readonly version = input.required<string>();
  readonly elaboracion = input<string>('');
  readonly revision = input<string>('');
}
