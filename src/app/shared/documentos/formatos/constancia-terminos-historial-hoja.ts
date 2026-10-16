import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { AceptacionTerminosHistorial } from '../../../features/qhse/entrega-epi/models/aceptacion-terminos';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaHoraDoc } from '../documento-format.util';

/**
 * Constancia de aceptación de los Términos y condiciones de uso de equipos por un operador de un ticket de Pumping: quién aceptó
 * (con su cédula del perfil), en qué ticket, qué versión (con la huella SHA-256 del texto) y cuándo (hora del servidor). La
 * aceptación la hizo el propio operador con su cuenta; esta hoja solo la reproduce.
 */
@Component({
  selector: 'app-doc-constancia-terminos-historial',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="doc-hoja">
      <app-doc-encabezado titulo="Constancia de aceptación de términos y condiciones de uso de equipos" [version]="aceptacion().versionCodigo" etiquetaVersion="Versión" />
      <table class="doc-tabla">
        <tbody>
          <tr><th>Operador</th><td>{{ aceptacion().operador.nombre }}</td></tr>
          <tr><th>Cédula</th><td>{{ aceptacion().operador.cedula ?? '—' }}</td></tr>
          <tr><th>Ticket</th><td>{{ aceptacion().ticketNumero ?? '—' }} — pedido {{ aceptacion().pedidoCodigo }}</td></tr>
          <tr><th>Versión aceptada</th><td>{{ aceptacion().versionCodigo }}</td></tr>
          <tr><th>Huella del texto (SHA-256)</th><td style="word-break: break-all">{{ aceptacion().textoHash }}</td></tr>
          <tr><th>Fecha y hora (servidor)</th><td>{{ fechaHora(aceptacion().aceptadoAt) }}</td></tr>
        </tbody>
      </table>
      <p>El operador aceptó estos términos con su propia cuenta; la hora la registró el servidor.</p>
    </div>
  `,
  styleUrl: './constancia-terminos-hoja.scss',
})
export class ConstanciaTerminosHistorialHoja {
  readonly aceptacion = input.required<AceptacionTerminosHistorial>();

  protected readonly fechaHora = fechaHoraDoc;
}
