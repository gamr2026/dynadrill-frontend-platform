/**
 * Catálogos de ubicación operativa — fuente: export "EVENTOS CON TORRE".
 * Backend: /api/catalogos/{bloques,campos,taladros,pozos}.
 */

export interface Bloque {
  id: number;
  nombre: string;
}

export interface Campo {
  id: number;
  nombre: string;
  /** Activo operativo de Petroecuador: AIT, AM, AP... */
  activo?: string | null;
  /** Región comercial (ZONA OESTE/ESTE/NORTE/LITORAL/MACHALA...) — nullable, no todos los campos la traen. */
  zona?: string | null;
}

export interface Taladro {
  id: number;
  nombre: string;
  /** "RIG CONTRACTUAL" — solo los taladros de contratista lo traen. */
  rigContractual?: string | null;
  habilitado: boolean;
}

export interface Pozo {
  id: number;
  codigo: string;
  nombreCompleto: string;
  campoId: number;
  bloqueId: number;
  habilitado: boolean;
  campo: { id: number; nombre: string; activo?: string | null; zona?: string | null } | null;
  bloque: { id: number; nombre: string } | null;
}

/**
 * Lo que emite `<app-ubicacion-selector>`. Lleva los ids (trazabilidad) y
 * los strings (para los payloads que hoy ya guardan `campo`, `pozo`,
 * `wellName`, `taladroRig`, etc. sin tener que migrar cada tabla).
 */
export interface UbicacionSeleccion {
  pozoId: number | null;
  /** código del pozo (GNAA-001) */
  pozo: string;
  /** nombre completo del pozo (GINTA-A001) */
  nombreCompletoPozo: string;
  campoId: number | null;
  campo: string;
  bloqueId: number | null;
  bloque: string;
  taladroId: number | null;
  taladro: string;
  rigContractual: string;
  /** Región comercial del Campo elegido — auto-completada, no se tipea (ver FACT-001). */
  zona: string;
}

export const UBICACION_VACIA: UbicacionSeleccion = {
  pozoId: null,
  pozo: '',
  nombreCompletoPozo: '',
  campoId: null,
  campo: '',
  bloqueId: null,
  bloque: '',
  taladroId: null,
  taladro: '',
  rigContractual: '',
  zona: '',
};

/** 'representante_campo' (= Company Man, mismo rol) | 'representante_quito' | 'analista_facturacion' | 'agente_comercial'. */
export type TipoPersonaContacto = 'representante_campo' | 'representante_quito' | 'analista_facturacion' | 'agente_comercial';

export interface PersonaContacto {
  id: number;
  tipo: TipoPersonaContacto;
  nombre: string;
  activo: boolean;
}

export interface ClienteCatalogo {
  id: number;
  tipoIdentificacion: string;
  identificacion: string;
  nombreComercial: string;
  nombreFiscal?: string | null;
  activo: boolean;
}

export const TIPO_PERSONA_LABELS: Record<TipoPersonaContacto, string> = {
  representante_campo: 'Representante Campo',
  representante_quito: 'Representante Quito',
  analista_facturacion: 'Analista de Facturación',
  agente_comercial: 'Agente Comercial',
};
