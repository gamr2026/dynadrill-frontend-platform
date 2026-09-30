import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DocumentoEncabezado } from '../documento-encabezado';

export interface EncuestaSatisfaccionDatos {
  numeroOtq: string;
  cliente: string;
  fecha: string;
  pozo: string;
  bloque: string;
}

const TEMAS = [
  'Cumplimiento de requisitos técnicos del servicio',
  'Disponibilidad y estado de equipos',
  'Competencia técnica del personal',
  'Comunicación y coordinación durante la operación',
  'Desempeño en seguridad y ambiente',
  'Satisfacción general del servicio',
];

const ESCALA = ['1 (Muy deficiente)', '2 (Deficiente)', '3 (Aceptable)', '4 (Bueno)', '5 (Excelente)'];

/**
 * Formato "Encuesta de satisfacción del cliente". Se imprime con los datos del servicio ya llenos y las
 * calificaciones, comentarios, nombres y firmas en blanco: la responde el cliente.
 */
@Component({
  selector: 'app-doc-encuesta-satisfaccion',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './encuesta-satisfaccion-hoja.html',
  styleUrl: './encuesta-satisfaccion-hoja.scss',
})
export class EncuestaSatisfaccionHoja {
  readonly datos = input.required<EncuestaSatisfaccionDatos>();

  protected readonly temas = TEMAS;
  protected readonly escala = ESCALA;
}
