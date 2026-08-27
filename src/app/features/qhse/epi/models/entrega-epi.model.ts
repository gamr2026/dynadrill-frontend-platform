/**
 * DYN-SGI-RE-032 — Registro de entrega de EPI (Equipo de Protección
 * Individual) y ropa de trabajo. No pertenece a ningún proceso HSE-XXX
 * numerado de la documentación de flujo — es un formato de Talento
 * Humano/HSE que hasta ahora no tenía ninguna representación en el
 * sistema (confirmado leyendo el Excel real, no había mención en ningún
 * MD ni en el plan de desarrollo).
 *
 * Estructura fiel al Excel: un registro por trabajador/sesión de entrega,
 * con una tabla de ítems (cada EPI entregado) y dos firmas — la del
 * trabajador (declaración de responsabilidad) y la de Talento Humano
 * (recibe conforme, cierra el expediente).
 */

/** "Una línea": usuario + fecha, sin captura de firma manuscrita — mismo criterio que el resto del módulo QHSE (IPERC, PTW, Desechos). */
export interface EpiFirma {
  nombre: string;
  firmadoAt: string;
}

export interface EpiItem {
  id: number;
  /** Elemento de protección individual entregado (ej. "Casco de seguridad", "Guantes de nitrilo"). */
  elemento: string;
  cantidad: number;
  talla?: string;
  /**
   * Columna "CÓDIGO O CÉDULA" del formato real — ambigua en el propio
   * Excel (podría ser el código del artículo o la cédula del receptor).
   * Se deja como texto libre para no forzar una interpretación que el
   * formato no aclara.
   */
  codigoOCedula?: string;
  recibioCapacitacion: boolean;
  observaciones?: string;
  entregadoAt: string;
}

export interface EntregaEpi {
  id: number;
  code: string;
  lugar: string;
  trabajadorNombre: string;
  trabajadorCargo: string;
  items: EpiItem[];

  /** Declaración: "Firmo y acepto ser responsable por los elementos... y me comprometo a dar uso adecuado...". */
  firmaTrabajador?: EpiFirma;
  /** "Recibe conforme Talento Humano" — cierra el expediente (NOTA del formato: "entregar el registro al file del trabajador en talento Humano"). */
  firmaTalentoHumano?: EpiFirma;

  createdAt: string;
}

export type CreateEntregaEpiInput = Pick<EntregaEpi, 'lugar' | 'trabajadorNombre' | 'trabajadorCargo' | 'items'>;

/** Expediente completo — declarado por el trabajador y recibido conforme por Talento Humano. */
export function entregaEpiCompleta(e: Pick<EntregaEpi, 'firmaTrabajador' | 'firmaTalentoHumano'>): boolean {
  return !!e.firmaTrabajador && !!e.firmaTalentoHumano;
}

export function entregaEpiSinCapacitacion(e: Pick<EntregaEpi, 'items'>): EpiItem[] {
  return e.items.filter(i => !i.recibioCapacitacion);
}
