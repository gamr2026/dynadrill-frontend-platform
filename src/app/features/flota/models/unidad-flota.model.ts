/**
 * Modelos de Flota (contenedor `operaciones`, `/api/operaciones/flota`). La autoridad de los datos, de las lecturas y de las alertas
 * preventivas es el backend; aquí solo se describen las respuestas.
 */

export type TipoUnidadFlota = 'servicio' | 'auxiliar' | 'transporte';
export type CategoriaPesoFlota = 'pesado' | 'liviano';
export type TipoLecturaFlota = 'horometro' | 'odometro';
export type NivelAlertaFlota = 'rojo' | 'amarillo' | 'verde';

export const TIPO_UNIDAD_LABEL: Record<TipoUnidadFlota, string> = {
  servicio: 'Servicio',
  auxiliar: 'Auxiliar',
  transporte: 'Transporte',
};

export const CATEGORIA_PESO_LABEL: Record<CategoriaPesoFlota, string> = {
  pesado: 'Pesado',
  liviano: 'Liviano',
};

export const FUENTE_LECTURA_LABEL: Record<string, string> = {
  carga_inicial: 'Carga inicial',
  manual: 'Manual',
  inspeccion: 'Inspección de vehículo',
  reporte_unidad: 'Reporte de unidad',
  mantenimiento: 'Mantenimiento',
};

export interface LecturaVigente {
  id: string;
  valor: number;
  leidaAt: string;
}

export interface UnidadFlota {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoUnidadFlota;
  categoriaPeso: CategoriaPesoFlota | null;
  activa: boolean;
  predeterminada: boolean;
  nota: string | null;
  vehiculo: {
    id: string;
    placa: string;
    marca: string | null;
    modelo: string | null;
    anio: number | null;
    tipoVehiculo: string | null;
  } | null;
  proveedorMantenimiento: { id: string; nombre: string } | null;
  responsablePatrimonial: { id: string; nombre: string } | null;
  documentos: {
    fechaMatricula: string | null;
    caducidadMatricula: string | null;
    caducidadPoliza: string | null;
    vigenciaOtroDocumento: string | null;
  };
  horometro: LecturaVigente | null;
  odometro: LecturaVigente | null;
}

export interface UnidadEntrada {
  codigo: string;
  nombre: string;
  tipo: TipoUnidadFlota;
  categoriaPeso?: CategoriaPesoFlota | null;
  vehiculoId?: string | null;
  proveedorMantenimientoId?: string | null;
  fechaMatricula?: string | null;
  caducidadMatricula?: string | null;
  caducidadPoliza?: string | null;
  vigenciaOtroDocumento?: string | null;
  responsablePatrimonialId?: string | null;
  predeterminada?: boolean;
  nota?: string | null;
  lecturaInicial?: number | null;
}

/** Lo que se puede cambiar de una unidad ya creada (no su código ni su tipo). */
export type UnidadCambios = Partial<Omit<UnidadEntrada, 'codigo' | 'tipo' | 'lecturaInicial'>>;

export interface LecturaFlota {
  id: string;
  unidadId: string;
  tipo: TipoLecturaFlota;
  valor: number;
  leidaAt: string;
  fuente: string;
  registradaPor: { id: string; nombre: string } | null;
}

export interface PreventivoFlota {
  id: string;
  tipoServicio: 'a' | 'b' | null;
  fecha: string;
  valor: number | null;
  ejecutadoPor: 'interno' | 'tercero';
  observaciones: string | null;
  proveedor: { id: string; nombre: string } | null;
  responsable: { id: string; nombre: string } | null;
}

export interface PreventivoEntrada {
  tipoServicio?: 'a' | 'b' | null;
  fecha: string;
  valor?: number | null;
  ejecutadoPor: 'interno' | 'tercero';
  proveedorMantenimientoId?: string | null;
  observaciones?: string | null;
}

export interface AlertaPreventivaFlota {
  unidad: { id: string; codigo: string; nombre: string; tipo: TipoUnidadFlota };
  reglaCodigo: string;
  descripcion: string;
  metrica: 'horas' | 'km' | 'dias';
  tipoServicio: 'a' | 'b' | null;
  consumido: number;
  intervalo: number;
  restante: number;
  valorActual: number | null;
  nivel: NivelAlertaFlota;
  enVentana: boolean;
}

export interface ProveedorMantenimiento {
  id: string;
  nombre: string;
  activo: boolean;
}

export const METRICA_LABEL: Record<AlertaPreventivaFlota['metrica'], string> = {
  horas: 'h',
  km: 'km',
  dias: 'días',
};
