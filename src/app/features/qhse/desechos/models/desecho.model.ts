/**
 * HSE-AMBIENTAL-001 — Gestión de desechos. Clasificación CRETIB
 * (Corrosivo/Reactivo/Explosivo/Tóxico/Inflamable/Biológico-infeccioso)
 * para peligrosos; "No Peligroso" para el resto.
 */
export type ClasificacionDesecho = 'peligroso' | 'no_peligroso';

export const CRETIB_CARACTERISTICAS = ['Corrosivo', 'Reactivo', 'Explosivo', 'Tóxico', 'Inflamable', 'Biológico-infeccioso'] as const;
export type CretibCaracteristica = (typeof CRETIB_CARACTERISTICAS)[number];

/** Código de color de contenedor — convención interna, no una norma citada en HSE-AMBIENTAL-001. */
export type ContenedorColor = 'rojo' | 'negro' | 'gris' | 'verde' | 'azul';

export const CONTENEDOR_COLOR_LABELS: Record<ContenedorColor, string> = {
  rojo: 'Rojo — biológico-infeccioso',
  negro: 'Negro — peligroso general',
  gris: 'Gris — no peligroso / común',
  verde: 'Verde — orgánico',
  azul: 'Azul — reciclable',
};

export type DesechoEstado = 'almacenado' | 'con_manifiesto' | 'dispuesto';

export const DESECHO_ESTADO_LABELS: Record<DesechoEstado, string> = {
  almacenado: 'Almacenado',
  con_manifiesto: 'Con manifiesto',
  dispuesto: 'Dispuesto',
};

/** "Una línea": usuario + fecha (decisión del plan de desarrollo de QHSE, misma que PTW/IPERC). */
export interface DesechoFirma {
  nombre: string;
  firmadoAt: string;
}

/**
 * Manifiesto Único — 3 firmas, con las mismas etiquetas del documento real
 * (DYN-SGI-RE-063 Guía de remisión de desechos: "DESPACHADO POR" /
 * "TRANSPORTADO POR" / "RECIBIDO POR"). `numero`/`gestorLicenciaSuia` no
 * están en ese formato pero se mantienen como control interno adicional
 * (SUIA es un registro ambiental real en Ecuador).
 */
export interface ManifiestoUnico {
  numero: string;
  fecha: string;
  gestorNombre: string;
  /** Verificación de que el gestor tiene licencia ambiental vigente (SUIA) — campo obligatorio para poder generar el manifiesto. */
  gestorLicenciaSuia: string;
  firmaDespachadoPor?: DesechoFirma;
  firmaTransportadoPor?: DesechoFirma;
  firmaRecibidoPor?: DesechoFirma;
}

export interface CertificadoDisposicionFinal {
  fecha: string;
  fileName: string;
}

/**
 * Línea de la tabla de ítems del documento real — columnas exactas de
 * DYN-SGI-RE-063: DESCRIPCIÓN, # DE LOTE DEL ENVASE, CÓDIGO DEL DESECHO,
 * CANTIDAD EN GLNS, No. BULTOS/CONTENEDORES.
 */
export interface DesechoItem {
  id: number;
  descripcion: string;
  numeroLote?: string;
  codigo: string;
  cantidadGalones: number;
  bultos: number;
}

/** Bloque "TRANSPORTISTA" del documento real. */
export interface DesechoTransportista {
  companiaNombre?: string;
  conductorNombre?: string;
  cedulaConductor?: string;
  vehiculo?: string;
  placas?: string;
}

/**
 * DYN-SGI-RE-063 "Guía de remisión de desechos" — remodelado a la forma
 * real (Fase 6, PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS): antes era un
 * registro por lote con `pesoKg` único; ahora es una guía con línea de
 * ítems, igual que `GuiaRemision` de Facturación (mismo patrón, campos
 * propios porque las columnas del formato son distintas).
 */
export interface Desecho {
  id: number;
  code: string;
  clasificacion: ClasificacionDesecho;
  /** Solo aplica cuando clasificacion === 'peligroso'. */
  cretib: CretibCaracteristica[];
  contenedorColor: ContenedorColor;
  descripcion: string;
  items: DesechoItem[];
  ubicacion?: string;
  generadoPorNombre: string;
  estado: DesechoEstado;

  // Encabezado de la guía real.
  cliente?: string;
  clienteRuc?: string;
  solicitadoPor?: string;
  despachadoPor?: string;
  horaSalida?: string;
  horaLlegada?: string;
  transportista?: DesechoTransportista;

  createdAt: string;
  /** AM 142 — máximo 12 meses de almacenamiento. */
  limiteAlmacenamientoHasta: string;

  manifiesto?: ManifiestoUnico;
  certificado?: CertificadoDisposicionFinal;
}

export type CreateDesechoInput = Pick<
  Desecho,
  | 'clasificacion'
  | 'cretib'
  | 'contenedorColor'
  | 'descripcion'
  | 'items'
  | 'ubicacion'
  | 'generadoPorNombre'
  | 'cliente'
  | 'clienteRuc'
  | 'solicitadoPor'
  | 'despachadoPor'
  | 'horaSalida'
  | 'horaLlegada'
  | 'transportista'
>;

/** Total de galones de la guía — para la fila "TOTAL DESECHOS GENERADOS" del formato real. */
export function desechoTotalGalones(items: DesechoItem[]): number {
  return items.reduce((total, i) => total + i.cantidadGalones, 0);
}

export function desechoLimiteAlmacenamiento(fechaIso: string): string {
  const d = new Date(fechaIso);
  d.setMonth(d.getMonth() + 12);
  return d.toISOString();
}

export function desechoVencido(d: Pick<Desecho, 'limiteAlmacenamientoHasta' | 'estado'>, ahora = new Date()): boolean {
  return d.estado !== 'dispuesto' && new Date(d.limiteAlmacenamientoHasta).getTime() < ahora.getTime();
}

/** Plazo de 30 días para el certificado de disposición final, contado desde el manifiesto. */
export function certificadoPlazoVence(manifiestoFechaIso: string): string {
  const d = new Date(manifiestoFechaIso);
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

export function manifiestoCompleto(m: ManifiestoUnico): boolean {
  return !!(m.firmaDespachadoPor && m.firmaTransportadoPor && m.firmaRecibidoPor);
}
