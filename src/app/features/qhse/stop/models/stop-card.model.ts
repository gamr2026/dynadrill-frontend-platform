/**
 * HSE-SEGUIMIENTO-002 — Tarjetas STOP. Estructura fiel al formato físico
 * DYN-SGI-RE-008 ("Tarjeta de observación Dynadrill Ecuador C.A."): dos
 * bloques — Acciones y Condiciones — cada uno con 5 subcategorías y un
 * checklist de ítems puntuales que se marcan Seguro/Inseguro. No es una
 * única clasificación acto/condición por tarjeta (así era la versión
 * anterior, antes de leer el Excel real) — cada tarjeta puede traer
 * varios ítems marcados, de cualquier bloque, a la vez.
 *
 * "Cualquier Trabajador... tiene autoridad y obligación de observar" — por
 * eso la creación de la tarjeta no pasa por el roleGuard de QHSE (ver
 * header.ts, acceso "Reportar"); solo la bandeja/dashboard de tendencias
 * queda reservada al staff HSE.
 */
export type StopBloque = 'acciones' | 'condiciones';

export type StopItemEstado = 'seguro' | 'inseguro' | null;

export interface StopChecklistItem {
  bloque: StopBloque;
  subcategoria: string;
  label: string;
  estado: StopItemEstado;
}

/** Subcategorías e ítems del bloque ACCIONES — orden y texto exactos del formato DYN-SGI-RE-008. */
export const STOP_ACCIONES: Record<string, string[]> = {
  'Uso de EPP': [
    'Protección de la cabeza',
    'Protección de los ojos y cara',
    'Protección auditiva',
    'Protección respiratoria',
    'Protección de manos y brazos',
    'Protección de los pies',
    'Protección del cuerpo',
    'Otros',
  ],
  'Herramientas y equipos': ['Equipos de trabajo', 'Herramientas', 'Equipos auxiliares', 'Vehículos', 'Otros'],
  'Manejo de cargas': ['Levantamiento mecánico', 'Manipulación manual'],
  'Posiciones de trabajo': ['Son adecuadas', 'Ergonomía / portura forzada', 'Posiciones balanceadas', 'Otros'],
  'Comportamiento en oficina': [
    'Cuidado del ambiente y recursos',
    'Colocación de materiales',
    'Fatiga visual',
    'Cables o material de oficina sueltos',
    'Aplicación procedimientos de antisoborno',
    'Otros',
  ],
};

/** Subcategorías e ítems del bloque CONDICIONES — orden y texto exactos del formato DYN-SGI-RE-008. */
export const STOP_CONDICIONES: Record<string, string[]> = {
  'Riesgo de caídas a distinto nivel': ['Trabajos en alturas', 'Equipos anticaídas', 'Escaleras y accesos'],
  'Seguridad en la zona de trabajo': ['Señalización', 'Entorno de trabajo'],
  'Riesgos del entorno': [
    'Golpeado por',
    'Contra objetos',
    'Caídas al mismo nivel',
    'Caídas a diferente nivel',
    'Altas temperaturas',
    'Energía eléctrica',
    'Exposición química',
    'Niveles altos de ruido',
    'Potencial de fuego',
    'Nivel de iluminación',
    'Vectores',
    'Contaminación',
    'Derrames',
  ],
  'Orden y limpieza': ['Orden y limpieza en el sitio de trabajo'],
  'Seguridad vial': ['Conducción de vehículos', 'Conservación de elementos de seguridad', 'Respeto de señalización/ Peatones'],
};

/** Arma el checklist completo (~55 ítems) sin ningún ítem marcado — el observador solo llena lo que realmente observó. */
export function crearStopChecklist(): StopChecklistItem[] {
  const items: StopChecklistItem[] = [];
  for (const [subcategoria, labels] of Object.entries(STOP_ACCIONES)) {
    for (const label of labels) items.push({ bloque: 'acciones', subcategoria, label, estado: null });
  }
  for (const [subcategoria, labels] of Object.entries(STOP_CONDICIONES)) {
    for (const label of labels) items.push({ bloque: 'condiciones', subcategoria, label, estado: null });
  }
  return items;
}

/**
 * Ciclo de vida (Fase 4, PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS): 'abierto'
 * al crearse, y QHSE la deriva o la resuelve — nunca queda "creada y ya".
 */
export type StopEstado = 'abierto' | 'derivado_mantenimiento' | 'resuelto_qhse' | 'derivado_otro' | 'cerrado';

export const STOP_ESTADO_LABELS: Record<StopEstado, string> = {
  abierto: 'Abierta',
  derivado_mantenimiento: 'Derivada a Mantenimiento',
  resuelto_qhse: 'Resuelta por QHSE',
  derivado_otro: 'Derivada a otro departamento',
  cerrado: 'Cerrada',
};

export interface StopCard {
  id: number;
  code: string;
  checklist: StopChecklistItem[];

  /** "Qué observa" / "Acciones" — un par por cada bloque, tal como el formato físico (no un solo campo compartido). */
  queObservaAcciones?: string;
  accionesAcciones?: string;
  queObservaCondiciones?: string;
  accionesCondiciones?: string;

  // "Quién Reporta" — footer del formato físico.
  observadorNombre: string;
  fecha: string;
  locacion: string;
  operadora: string;
  contacto?: string;
  /** Código de la Unidad relacionada (opcional) — si se deriva a Mantenimiento, habilita abrir un Reporte de Unidad real. */
  equipoCodigo?: string;

  createdAt: string;

  estado: StopEstado;
  derivadoA?: 'mantenimiento' | 'qhse' | 'otro';
  derivadoObservacion?: string;
  derivadoPor?: string;
  derivadoAt?: string;
  cerradoPor?: string;
  cerradoAt?: string;
}

export type CreateStopCardInput = Omit<StopCard, 'id' | 'code' | 'createdAt' | 'estado' | 'derivadoA' | 'derivadoObservacion' | 'derivadoPor' | 'derivadoAt' | 'cerradoPor' | 'cerradoAt'>;

/** ¿Algún ítem del bloque quedó marcado "Inseguro"? — usado para el acento de la tarjeta y el KPI de la bandeja. */
export function stopCardTieneInseguroEn(card: Pick<StopCard, 'checklist'>, bloque: StopBloque): boolean {
  return card.checklist.some(i => i.bloque === bloque && i.estado === 'inseguro');
}

/** Ítems marcados "Inseguro" — para el Pareto por subcategoría de la bandeja. */
export function stopCardInseguros(card: Pick<StopCard, 'checklist'>): StopChecklistItem[] {
  return card.checklist.filter(i => i.estado === 'inseguro');
}
