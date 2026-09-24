/**
 * Matriz de Aspectos e Impactos Ambientales (MATRIZ DE ASPECTOS AMBIENTALES
 * Rev00) — un registro por aspecto/actividad evaluada, misma lógica de
 * actividad → aspecto/impacto → valoración de riesgo → control → seguimiento
 * que IPERC, pero para impacto ambiental (no riesgo laboral) y con
 * Probabilidad×Consecuencia directo en vez de GTC-45.
 */
export type Clasificacion = 'BAJO' | 'MODERADO' | 'ALTO';

export const CLASIFICACION_LABELS: Record<Clasificacion, string> = {
  BAJO: 'Bajo',
  MODERADO: 'Moderado',
  ALTO: 'Alto',
};

export function calcularNivelRiesgo(probabilidad: number, consecuencia: number): number {
  return probabilidad * consecuencia;
}

export interface AspectoAmbiental {
  id: number;
  code: string;
  clasificacion: Clasificacion;

  // Identificación
  fecha: string;
  etapaCicloVida: string;
  proceso: string;
  actividad: string;
  produccionDelAspecto?: string;
  riesgoGestion?: string;
  aspectoAmbiental: string;
  impactoAmbiental: string;
  factorAmbiental?: string;
  condicionesOperacion?: string;
  tipoResponsabilidad?: string;
  tipoImpacto?: string;

  // Valoración del riesgo ambiental
  fechaValoracion?: string;
  probabilidad: number;
  consecuencia: number;
  significancia?: string;

  // Control del aspecto e impacto
  ncar?: string;
  planAccionExistente?: string;
  planTratamiento?: string;
  responsable?: string;
  presupuesto?: string;
  plazo?: string;
  estadoControl?: string;

  // Seguimiento y monitoreo
  seguimientoIndicador?: string;
  seguimientoResponsable?: string;
  seguimientoFrecuencia?: string;
  seguimientoEstado?: string;
  eficaciaControles?: string;

  createdAt: string;
}

export type CreateAspectoAmbientalInput = Omit<AspectoAmbiental, 'id' | 'code' | 'createdAt'>;

export function nivelRiesgo(a: Pick<AspectoAmbiental, 'probabilidad' | 'consecuencia'>): number {
  return calcularNivelRiesgo(a.probabilidad, a.consecuencia);
}
