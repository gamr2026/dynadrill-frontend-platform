/**
 * Fase 0 — AOT: documento oficial final ("ORDEN DE TRABAJO / RESUMEN DE
 * COSTOS"). Formato verificado 1:1 contra la pestaña "OTQ" de
 * `COMP. 4130_SCHF-246 ticket REV2 final.xlsx`.
 *
 * Se genera cuando el Ticket ya está firmado por el cliente. El encabezado
 * queda fijo; el detalle es el de la prefactura. Firmas físicas.
 */

export interface AotItem {
  codigo: string;
  servicioRequerido: string;
  unidad: string;
  tarifaUnitaria: number;
  cantidad: number;
  total: number;
}

export interface RepresentanteAot {
  nombre: string;
  cargo: string;
}

export type EstadoAot = 'generada' | 'firmada';

export interface Aot {
  id: number;
  pedidoId: number;
  prefacturaId: number;

  /** Secuencial propio (692, 425, 848…), distinto del nº de ticket. */
  numeroOt: number;
  /** Código de ciudad para el número OPR (ej. 'UIO'). */
  ciudad: string;
  /** `${numeroOt}-OPR-${pozo}-${ciudad}-${año}` — asocia ticket ↔ AOT. */
  numeroOpr: string;

  /** = fechaInicioServicio - 1 día. */
  fecha: string;
  numeroContrato: string;
  /** Párrafo largo del contrato — fijo por contrato. */
  contratoTexto: string;
  descripcionRequerimiento: string;
  /** = servicio + '/' + pozo + '/' + rig. */
  servicio: string;
  fechaInicio: string;
  fechaTerminacion: string;

  detalle: AotItem[];
  /** Suma del detalle (derivado). */
  valorOt: number;

  representanteContratista: RepresentanteAot;
  /** Editable — de quien solicitó el servicio. */
  representanteCliente: RepresentanteAot;

  estado: EstadoAot;
  generadaAt: string;
}

export type CreateAotInput = Pick<Aot, 'pedidoId' | 'prefacturaId' | 'ciudad' | 'descripcionRequerimiento' | 'representanteCliente'>;

export function aotValorOt(detalle: AotItem[]): number {
  return Math.round(detalle.reduce((s, i) => s + i.total, 0) * 100) / 100;
}
