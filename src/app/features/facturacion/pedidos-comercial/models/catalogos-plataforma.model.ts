/**
 * Catálogos del backend nuevo (plataforma, vía `/api/v2/catalogos`). Los ids son UUID (texto); a diferencia de la demo,
 * `legacyId` es el id numérico antiguo y no debe usarse en pedidos nuevos.
 */
export interface BloquePlataforma {
  id: string;
  legacyId: number | null;
  nombre: string;
  habilitado: boolean;
}

export interface CampoPlataforma {
  id: string;
  legacyId: number | null;
  nombre: string;
  zonaId: string | null;
  zona: string | null;
  habilitado: boolean;
}

export interface TaladroPlataforma {
  id: string;
  legacyId: number | null;
  nombre: string;
  rigContractual: string | null;
  habilitado: boolean;
}

export interface PozoPlataforma {
  id: string;
  legacyId: number | null;
  codigo: string;
  nombreCompleto: string;
  campoId: string;
  bloqueId: string;
  habilitado: boolean;
  campo: CampoPlataforma | null;
  bloque: BloquePlataforma | null;
}

export interface ClientePlataforma {
  id: string;
  legacyId: number | null;
  tipoIdentificacion: string;
  identificacion: string;
  nombreComercial: string;
  nombreFiscal: string | null;
  activo: boolean;
}

export type TipoPersonaPlataforma = 'representante_campo' | 'representante_quito' | 'analista_facturacion' | 'agente_comercial';

export interface PersonaPlataforma {
  id: string;
  legacyId: number | null;
  tipo: TipoPersonaPlataforma;
  nombre: string;
  cedula?: string;
  activo: boolean;
}

/** Bodega o condición de pago (catálogos de plataforma; `as2Id` es el id en AS2). */
export interface CatalogoSimplePlataforma {
  id: string;
  as2Id: number | null;
  nombre: string;
  habilitado: boolean;
}

export type BodegaPlataforma = CatalogoSimplePlataforma;
export type CondicionPagoPlataforma = CatalogoSimplePlataforma;

/** Opciones de un catálogo: las habilitadas más la vigente aunque haya sido inhabilitada (para no dejar el select vacío). */
export function opcionesDeCatalogo(lista: readonly CatalogoSimplePlataforma[], vigenteId: string | null): { label: string; value: string }[] {
  return lista
    .filter(x => x.habilitado || x.id === vigenteId)
    .map(x => ({ label: x.habilitado ? x.nombre : `${x.nombre} (inhabilitado)`, value: x.id }));
}

/** Lo que emite el selector de ubicación del pedido: todo con UUID. */
export interface UbicacionPedido {
  pozoId: string | null;
  pozo: string;
  campoId: string | null;
  campo: string;
  bloqueId: string | null;
  bloque: string;
  /** `null` cuando el trabajo es rigless. */
  taladroId: string | null;
  taladro: string;
  rigless: boolean;
  zona: string;
}

export const UBICACION_PEDIDO_VACIA: UbicacionPedido = {
  pozoId: null,
  pozo: '',
  campoId: null,
  campo: '',
  bloqueId: null,
  bloque: '',
  taladroId: null,
  taladro: '',
  rigless: false,
  zona: '',
};

export const esTaladroRigless = (nombre: string | null | undefined): boolean => (nombre ?? '').trim().toUpperCase() === 'RIGLESS';

/** Valor de la opción "RIGLESS" del select de taladro: no es un taladro del catálogo, es un trabajo sin taladro. */
export const OPCION_RIGLESS = '__rigless__';

/**
 * Arma la ubicación a partir de las selecciones. `rigless` (opción propia del select) o un taladro llamado RIGLESS en
 * el catálogo se traducen a `rigless = true` sin taladro.
 */
export function construirUbicacion(pozo: PozoPlataforma | undefined, taladro: TaladroPlataforma | undefined, campos: readonly CampoPlataforma[] = [], sinTaladro = false): UbicacionPedido {
  const campo = pozo ? (pozo.campo ?? campos.find(c => c.id === pozo.campoId)) : undefined;
  const rigless = sinTaladro || esTaladroRigless(taladro?.nombre);
  return {
    pozoId: pozo?.id ?? null,
    pozo: pozo?.codigo ?? '',
    campoId: pozo?.campoId ?? null,
    campo: campo?.nombre ?? '',
    bloqueId: pozo?.bloqueId ?? null,
    bloque: pozo?.bloque?.nombre ?? '',
    taladroId: rigless ? null : (taladro?.id ?? null),
    taladro: rigless ? 'RIGLESS' : (taladro?.nombre ?? ''),
    rigless,
    zona: campo?.zona ?? '',
  };
}

export type TipoIdentificacionTransporte = 'ruc' | 'cedula' | 'pasaporte';

export interface TransportistaPlataforma {
  id: string;
  nombreFiscal: string;
  tipoIdentificacion: TipoIdentificacionTransporte;
  identificacion: string;
  codigo: string | null;
  habilitado: boolean;
}

export interface TipoVehiculoPlataforma {
  id: string;
  nombre: string;
  habilitado: boolean;
}

export interface VehiculoPlataforma {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  tipoVehiculo: { id: string; nombre: string } | null;
  transportista: { id: string; nombreFiscal: string } | null;
  habilitado: boolean;
}

export interface ChoferPlataforma {
  id: string;
  transportistaId: string;
  licencia: string;
  nombre: string;
  habilitado: boolean;
}
