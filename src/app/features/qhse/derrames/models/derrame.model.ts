/**
 * HSE-AMBIENTAL-002 — Control y respuesta a derrames. "Personal que Detecta
 * Derrame" activa el botón de alerta — igual que STOP/SWA, no pasa por el
 * roleGuard de QHSE (ver header.ts, acceso "Reportar"); la gestión del
 * evento (contención, notificación a MAE, cierre) queda para el staff HSE.
 *
 * Bandas de volumen: HSE-AMBIENTAL-002 no fija los límites exactos en el
 * documento — se adoptan bandas razonables (menor <1 barril ~159 L,
 * moderado 1-10 barriles, mayor >10 barriles) hasta que QHSE confirme los
 * umbrales oficiales; queda anotado como supuesto a validar.
 */
export type DerrameVolumen = 'menor' | 'moderado' | 'mayor';

export const DERRAME_VOLUMEN_LABELS: Record<DerrameVolumen, string> = {
  menor: 'Menor (< 1 barril)',
  moderado: 'Moderado (1-10 barriles)',
  mayor: 'Mayor (> 10 barriles)',
};

export type DerrameUbicacion = 'geomembrana' | 'suelo' | 'cuerpo_agua';

export const DERRAME_UBICACION_LABELS: Record<DerrameUbicacion, string> = {
  geomembrana: 'Sobre geomembrana (contenido)',
  suelo: 'Suelo natural',
  cuerpo_agua: 'Cuerpo de agua',
};

export type DerrameEstado = 'activo' | 'contenido' | 'cerrado';

export const DERRAME_ESTADO_LABELS: Record<DerrameEstado, string> = {
  activo: 'Derrame activo',
  contenido: 'Contenido',
  cerrado: 'Cerrado',
};

export interface DerrameChecklistItem {
  label: string;
  checked: boolean;
}

/** Contención en los primeros 5 minutos (HSE-AMBIENTAL-002). */
export const DEFAULT_CONTENCION_CHECKLIST: DerrameChecklistItem[] = [
  { label: 'Detener la fuente del derrame si es seguro hacerlo', checked: false },
  { label: 'Delimitar el área con barreras/absorbentes', checked: false },
  { label: 'Evitar que llegue a drenajes o cuerpos de agua', checked: false },
  { label: 'Usar EPP adecuado antes de intervenir', checked: false },
  { label: 'Notificar a QHSE inmediatamente', checked: false },
];

export interface DerrameEvento {
  id: number;
  code: string;
  estado: DerrameEstado;

  activadoPorNombre: string;
  descripcion: string;
  ubicacionFisica?: string;
  volumen: DerrameVolumen;
  ubicacion: DerrameUbicacion;
  activadoAt: string;

  checklistContencion: DerrameChecklistItem[];
  contenidoAt?: string;

  /** Obligatoria cuando ubicacion !== 'geomembrana', o cuando volumen === 'mayor'. */
  notificadoMae: boolean;
  notificadoMaeAt?: string;

  /** Suelo contaminado alimenta Gestión de Desechos como peligroso (integración de HSE-AMBIENTAL-001/002). */
  desechoGeneradoId?: number;

  cerradoAt?: string;
}

export type CreateDerrameInput = Pick<DerrameEvento, 'activadoPorNombre' | 'descripcion' | 'ubicacionFisica' | 'volumen' | 'ubicacion'>;

/** Derrame mayor debería activar Emergencia Mayor (HSE-TRIAGE-001) — todavía no construido, ver Fase 4 del plan de desarrollo. */
export function derrameActivaEmergenciaMayor(d: Pick<DerrameEvento, 'volumen'>): boolean {
  return d.volumen === 'mayor';
}

export function derrameRequiereNotificacionMae(d: Pick<DerrameEvento, 'ubicacion' | 'volumen'>): boolean {
  return d.ubicacion !== 'geomembrana' || d.volumen === 'mayor';
}
