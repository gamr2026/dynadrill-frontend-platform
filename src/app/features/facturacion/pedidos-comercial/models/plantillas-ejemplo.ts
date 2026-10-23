import type { LineaServicio } from './pedido-comercial.model';

/**
 * Plantillas de ejemplo (mismo formato de AS2) armadas con las líneas de tickets reales del cliente: 4368 y 4412 de Pumping y 4426 de FCR.
 * «Cargar» las valida contra la lista de precios del cliente y fija la línea y el tipo de servicio que usó ese ticket; también se pueden
 * descargar y subir con la carga de plantilla.
 */
export interface PlantillaEjemplo {
  id: string;
  titulo: string;
  detalle: string;
  archivo: string;
  linea: LineaServicio;
  tipoServicio: string;
}

export const PLANTILLAS_EJEMPLO: readonly PlantillaEjemplo[] = [
  {
    id: 'pumping-bes',
    titulo: 'Pumping · Limpieza de equipo BES con CTU',
    detalle: 'Ticket 4368: 37 líneas, 5 químicos',
    archivo: 'pedido-pumping-limpieza-bes-4368.xlsx',
    linea: 'pumping',
    tipoServicio: 'coiled_tubing',
  },
  {
    id: 'pumping-linea',
    titulo: 'Pumping · Limpieza de línea de superficie y flushing',
    detalle: 'Ticket 4412: 38 líneas, 4 químicos',
    archivo: 'pedido-pumping-limpieza-linea-4412.xlsx',
    linea: 'pumping',
    tipoServicio: 'coiled_tubing',
  },
  {
    id: 'fcr-sarta',
    titulo: 'FCR · Sarta de limpieza de casing 7"',
    detalle: 'Ticket 4426: sarta de limpieza, subs y movilización (4 líneas)',
    archivo: 'pedido-fcr-sarta-limpieza-4426.xlsx',
    linea: 'fcr',
    tipoServicio: 'wellbore_cleanup_tools',
  },
];
