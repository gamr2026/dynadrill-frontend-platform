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

/** Manifiesto Único — 3 firmas: generador, transportista, gestor final. */
export interface ManifiestoUnico {
  numero: string;
  fecha: string;
  gestorNombre: string;
  /** Verificación de que el gestor tiene licencia ambiental vigente (SUIA) — campo obligatorio para poder generar el manifiesto. */
  gestorLicenciaSuia: string;
  firmaGenerador?: DesechoFirma;
  firmaTransportista?: DesechoFirma;
  firmaGestor?: DesechoFirma;
}

export interface CertificadoDisposicionFinal {
  fecha: string;
  fileName: string;
}

export interface Desecho {
  id: number;
  code: string;
  clasificacion: ClasificacionDesecho;
  /** Solo aplica cuando clasificacion === 'peligroso'. */
  cretib: CretibCaracteristica[];
  contenedorColor: ContenedorColor;
  descripcion: string;
  pesoKg: number;
  ubicacion?: string;
  generadoPorNombre: string;
  estado: DesechoEstado;

  createdAt: string;
  /** AM 142 — máximo 12 meses de almacenamiento. */
  limiteAlmacenamientoHasta: string;

  manifiesto?: ManifiestoUnico;
  certificado?: CertificadoDisposicionFinal;
}

export type CreateDesechoInput = Pick<
  Desecho,
  'clasificacion' | 'cretib' | 'contenedorColor' | 'descripcion' | 'pesoKg' | 'ubicacion' | 'generadoPorNombre'
>;

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
  return !!(m.firmaGenerador && m.firmaTransportista && m.firmaGestor);
}
