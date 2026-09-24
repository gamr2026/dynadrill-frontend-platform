/**
 * HSE-AMBIENTAL-002 — Control y respuesta a derrames. "Personal que Detecta
 * Derrame" activa el botón de alerta — igual que STOP/SWA, no pasa por el
 * roleGuard de QHSE (ver header.ts, acceso "Reportar"); la gestión del
 * evento (contención, notificación a MAE, cierre) queda para el staff HSE.
 *
 * Bandas de volumen: HSE-AMBIENTAL-002 SÍ fija los límites exactos (antes
 * se había asumido lo contrario). Un derrame en cuerpo de agua es "Mayor"
 * sin importar el volumen — ver derrameActivaEmergenciaMayor().
 */
export type DerrameVolumen = 'menor' | 'moderado' | 'mayor';

export const DERRAME_VOLUMEN_LABELS: Record<DerrameVolumen, string> = {
  menor: 'Menor (< 1 barril)',
  moderado: 'Moderado (1-5 barriles)',
  mayor: 'Mayor (> 5 barriles, o cualquier volumen en cuerpo de agua)',
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

  /** Volumen real estimado tras la contención (barriles) — alimenta el KPI "Volumen total derramado (barriles/año)" de HSE-MASTER-001. `volumen` (menor/moderado/mayor) es la banda reportada al activar la alerta; este es el número que QHSE confirma después. */
  volumenBarriles?: number;

  /** Obligatoria cuando volumen === 'mayor' (>5 barriles) o ubicacion === 'cuerpo_agua' — ver derrameRequiereNotificacionMae(). */
  notificadoMae: boolean;
  notificadoMaeAt?: string;

  /** Suelo contaminado alimenta Gestión de Desechos como peligroso (integración de HSE-AMBIENTAL-001/002). */
  desechoGeneradoId?: number;

  /** HSE-MASTER-001: derrame mayor escala a Emergencia Mayor (HSE-TRIAGE-001). */
  emergenciaId?: number;

  cerradoAt?: string;

  /** Servicio operativo durante el que ocurrió (HSE-AMBIENTAL-002 se ejecuta "durante HSE-SITIO-001"). */
  ticketTipo?: 'pumping' | 'fcr';
  ticketCode?: string;
}

export type CreateDerrameInput = Pick<
  DerrameEvento,
  'activadoPorNombre' | 'descripcion' | 'ubicacionFisica' | 'volumen' | 'ubicacion' | 'ticketTipo' | 'ticketCode'
>;

/**
 * HSE-MASTER-001: "Derrame mayor (>5 barriles o en agua) → Escalar a
 * Emergencia Mayor" — un derrame en cuerpo de agua escala aunque el
 * volumen todavía esté clasificado como menor/moderado.
 */
export function derrameActivaEmergenciaMayor(d: Pick<DerrameEvento, 'volumen' | 'ubicacion'>): boolean {
  return d.volumen === 'mayor' || d.ubicacion === 'cuerpo_agua';
}

/**
 * HSE-AMBIENTAL-002: "Obligatorio si: Derrame > 5 barriles / Derrame en
 * cuerpo de agua (cualquier volumen) / Derrame en área protegida /
 * Afectación a comunidades." Los dos últimos criterios no están modelados
 * todavía (no hay campo de área protegida/comunidades) — solo volumen y
 * ubicación. Antes esto disparaba notificación para CUALQUIER derrame que
 * no fuera sobre geomembrana (incluyendo suelo descubierto sin ser mayor),
 * más estricto de lo que pide el documento.
 */
export function derrameRequiereNotificacionMae(d: Pick<DerrameEvento, 'ubicacion' | 'volumen'>): boolean {
  return d.volumen === 'mayor' || d.ubicacion === 'cuerpo_agua';
}
