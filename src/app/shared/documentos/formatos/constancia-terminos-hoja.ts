import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { AceptacionTerminos, TerminosPumping } from '../../../features/operations/pumping/models/terminos.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaHoraDoc } from '../documento-format.util';

/**
 * Constancia de aceptación de los Términos y condiciones de uso de equipos
 * de un ticket de Pumping: el texto aceptado (versión + SHA-256) y, por
 * operador, nombre, cédula, fecha/hora del servidor y la cuenta que registró.
 * No es un formato DYN-* del SGI todavía — sin código ni revisión.
 */
@Component({
  selector: 'app-doc-constancia-terminos',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './constancia-terminos-hoja.html',
  styleUrl: './constancia-terminos-hoja.scss',
})
export class ConstanciaTerminosHoja {
  readonly ticketCode = input.required<string>();
  readonly terminos = input.required<TerminosPumping>();
  readonly aceptaciones = input.required<AceptacionTerminos[]>();

  protected readonly fechaHora = fechaHoraDoc;
}
