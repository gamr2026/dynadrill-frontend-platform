import type { FcrActivityLogEntry, FcrDiaBitacoraEnviado } from './fcr.model';

/** Un día de la bitácora de actividades — unidad de envío a Facturación (specs/fcr-bitacora-envio-diario). */
export interface FcrBitacoraDia {
  fecha: string;
  actividades: FcrActivityLogEntry[];
  totalHoras: number;
  /** `null` = pendiente de enviar a Facturación. */
  envio: FcrDiaBitacoraEnviado | null;
}

export function agruparBitacoraPorDia(log: FcrActivityLogEntry[], enviados: FcrDiaBitacoraEnviado[]): FcrBitacoraDia[] {
  const porFecha = new Map<string, FcrActivityLogEntry[]>();
  for (const e of log) porFecha.set(e.date, [...(porFecha.get(e.date) ?? []), e]);

  return [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, actividades]) => ({
      fecha,
      actividades: [...actividades].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      totalHoras: Math.round(actividades.reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100,
      envio: enviados.find(d => d.fecha === fecha) ?? null,
    }));
}

export type EstadoDiaBitacora = 'pendiente' | 'enviado' | 'corregido_facturacion';

/** Estado visible de un día: la última corrección manda — si fue de Facturación, el Operador debe enterarse. */
export function estadoDiaBitacora(envio: FcrDiaBitacoraEnviado | null): EstadoDiaBitacora {
  if (!envio) return 'pendiente';
  return envio.modificadoRol === 'Facturación' ? 'corregido_facturacion' : 'enviado';
}
