/**
 * Historial de aceptaciones de los Términos y condiciones de uso de equipos. Los guarda **Pumping** (`pumping.aceptacion_terminos`,
 * contenedor operaciones); QHSE solo los consulta. La cédula sale del perfil de la cuenta del operador (no se captura).
 * Endpoint acordado con Pumping (ver documentacion/modulos/REGISTRO-DE-CAMBIOS-COMPARTIDOS.md):
 * `GET /api/operaciones/pumping/terminos/aceptaciones?cedula=&nombre=` con el permiso `pumping.terminos.historial`.
 */
export const PERMISO_TERMINOS_HISTORIAL = 'pumping.terminos.historial';

export interface AceptacionTerminosHistorial {
  id: string;
  ticketId: string;
  ticketNumero: number | null;
  pedidoCodigo: string;
  operador: { id: string; nombre: string; cedula: string | null };
  versionCodigo: string;
  /** SHA-256 del texto aceptado: prueba de qué se leyó. */
  textoHash: string;
  aceptadoAt: string;
}

export interface FiltroAceptaciones {
  cedula?: string;
  nombre?: string;
}
