/**
 * Checklist digital "Inspección y reparación de herramientas" — se llena una
 * vez por cada `FcrTool` del ticket (no una vez por ticket), exclusivo de la
 * rama SERVICIOS (fase `inspeccion`). Espejo exacto del backend
 * (`libs/domains/operaciones/src/fcr-tickets/fcr-tool-inspecciones.service.ts`).
 */
export type FcrToolInspectionEstado = 'borrador' | 'enviado' | 'aprobado' | 'rechazado';

export type FcrToolInspectionParteResultado = 'ok' | 'defectuoso' | '';

/** 'dynadrill' | 'proveedor_externo' — quién inspeccionó/reparó la herramienta. */
export type FcrToolInspectionResponsable = 'dynadrill' | 'proveedor_externo' | '';

export const FCR_TOOL_INSPECTION_RESPONSABLE_LABELS: Record<Exclude<FcrToolInspectionResponsable, ''>, string> = {
  dynadrill: 'Dynadrill',
  proveedor_externo: 'Proveedor externo',
};

/** Firma NO es un canvas dibujado — checkbox de confirmación + usuario logueado + fecha (mismo patrón que `FirmaActaDialog`). */
export type FcrToolInspectionFirmaRol = 'reparadoPor' | 'revisadoPor' | 'liberadoQhse';

export const FCR_TOOL_INSPECTION_FIRMA_ROLES: FcrToolInspectionFirmaRol[] = ['reparadoPor', 'revisadoPor', 'liberadoQhse'];

export const FCR_TOOL_INSPECTION_FIRMA_LABELS: Record<FcrToolInspectionFirmaRol, string> = {
  reparadoPor: 'Reparado por',
  revisadoPor: 'Revisado por',
  liberadoQhse: 'Liberado por QHSE',
};

/**
 * `roleName` (nombre de rol de UI, mismo criterio que `roleName()` en
 * `ticket-detail-page.ts`) habilitado para dejar cada firma. Espejo del
 * `FCR_TOOL_INSPECTION_FIRMA_ROLES_PERMITIDOS` del backend
 * (`fcr-tool-inspecciones.constants.ts`), que valida por `RoleCode` — acá se
 * compara por nombre de rol porque el frontend no tiene un enum de
 * `RoleCode` propio, solo `roleName` (ver "auto-switch de rol para demo" en
 * `AuthService`/`ticket-detail-page.ts`). `revisadoPor` es el `Supervisor`
 * genérico — NO el `Supervisor Operaciones FCR` que aprueba el checklist
 * completo en la fase siguiente.
 */
export const FCR_TOOL_INSPECTION_FIRMA_ROLES_REQUERIDOS: Record<FcrToolInspectionFirmaRol, readonly string[]> = {
  reparadoPor: ['Operador'],
  revisadoPor: ['Supervisor'],
  liberadoQhse: ['Técnico HSE', 'Coordinador HSE', 'Gerente HSE'],
};

/** Firma que debe estar hecha ANTES de poder firmar esta — `reparadoPor` no tiene predecesora. Espejo del backend. */
export const FCR_TOOL_INSPECTION_FIRMA_ROL_ANTERIOR: Partial<Record<FcrToolInspectionFirmaRol, FcrToolInspectionFirmaRol>> = {
  revisadoPor: 'reparadoPor',
  liberadoQhse: 'revisadoPor',
};

export interface FcrToolInspectionFirma {
  nombre: string;
  fecha: string;
  firmado: boolean;
}

export interface FcrToolInspectionParte {
  id: number;
  orden: number;
  /** Etiqueta del ítem tal como aparece en el documento de origen (numérica, con sufijo o alfabética). */
  item: string;
  codigo: string;
  descripcion: string;
  cantidadEsperada: number;
  visualResultado: FcrToolInspectionParteResultado;
  endResultado: FcrToolInspectionParteResultado;
  /** "Cambio de elemento → Cantidad": dato informativo, no dispara movimiento de kardex. */
  cambioCantidad: number | null;
  accion: string;
}

export interface FcrToolInspection {
  id: number;
  ticketId: number;
  toolId: number;
  articuloId: number | null;
  cliente: string;
  pozo: string;
  fechaInspeccion: string | null;
  fechaReparacion: string | null;
  fechaEnvio: string | null;
  descripcionHerramienta: string;
  numeroSerie: string;
  inspeccionadoPor: FcrToolInspectionResponsable;
  reparadoPor: string;
  estado: FcrToolInspectionEstado;
  observaciones: string;
  firmas: Partial<Record<FcrToolInspectionFirmaRol, FcrToolInspectionFirma>>;
  partes: FcrToolInspectionParte[];
}

export interface FcrToolInspectionHeaderInput {
  cliente?: string;
  pozo?: string;
  fechaInspeccion?: string | null;
  fechaReparacion?: string | null;
  fechaEnvio?: string | null;
  descripcionHerramienta?: string;
  numeroSerie?: string;
  inspeccionadoPor?: FcrToolInspectionResponsable;
  reparadoPor?: string;
}

export interface FcrToolInspectionParteInput {
  visualResultado?: FcrToolInspectionParteResultado;
  endResultado?: FcrToolInspectionParteResultado;
  cambioCantidad?: number | null;
  accion?: string;
}
