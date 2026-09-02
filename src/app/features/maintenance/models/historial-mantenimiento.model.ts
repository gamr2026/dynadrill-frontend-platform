import { TipoServicio } from './unidad.model';

/**
 * Registro persistente de un mantenimiento ejecutado (MAN-003, RN-MAN-005-04
 * — trazabilidad histórica). `registrosPrev` en Unidad solo guarda el
 * último registro por tipo de servicio y lo sobreescribe; esta entidad es
 * la que conserva el historial completo, y es la fuente para el
 * cronograma, el informe de mantenimiento y los KPIs.
 */
export interface RegistroMantenimiento {
  id: number;
  unidadId: number;
  unidadCode: string;
  clase: 'Preventivo' | 'Correctivo';
  /** Solo aplica cuando clase = 'Preventivo' y la unidad es de tipo Servicio. */
  tipoServicio?: TipoServicio;
  fecha: string;
  horometro?: number;
  km?: number;
  responsable: string;
  ejecutadoPor: 'Interno' | 'Tercero';
  proveedor?: string;
  observaciones?: string;
  /** Si el mantenimiento se originó en una orden correctiva (MAN-001). */
  ordenId?: number;
  /**
   * Nombre del archivo del checklist de fábrica adjuntado (formato propio
   * del fabricante de la unidad — no hay uno solo porque las unidades son
   * de marcas distintas). Reemplaza la casilla simple que había antes
   * (D2): el cliente pidió que ahora sí quede el documento, no solo la
   * marca de "completado". Solo aplica a mantenimiento Interno.
   */
  checklistFabricanteArchivo?: string;
}

export type CreateRegistroMantenimientoInput = Omit<RegistroMantenimiento, 'id'>;
