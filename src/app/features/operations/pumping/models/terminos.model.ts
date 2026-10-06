/** Texto vigente de los Términos y condiciones de uso de equipos (lo publica el backend, versionado). */
export interface TerminosPumping {
  version: string;
  titulo: string;
  texto: string;
  /** SHA-256 del texto — queda en cada aceptación como prueba de qué se leyó. */
  textoHash: string;
}

/** Constancia inmutable: una por operador asignado y ticket. Fecha, versión, hash y cuenta los pone el servidor. */
export interface AceptacionTerminos {
  id: number;
  pumpingTicketId: number;
  operadorNombre: string;
  operadorCedula: string;
  version: string;
  textoHash: string;
  registradoPor: string;
  registradoRol: string;
  aceptadoAt: string;
}

export interface AceptarTerminosInput {
  operadorNombre: string;
  operadorCedula: string;
}

/** Cédula ecuatoriana: 10 dígitos — misma regla que valida el backend. */
export function esCedulaValida(cedula: string): boolean {
  return /^\d{10}$/.test(cedula.trim());
}
