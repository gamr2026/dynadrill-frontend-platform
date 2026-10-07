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

/** Fechas del servicio del Pedido (`YYYY-MM-DD`); `null` = Ventas no la cargó y no limita. */
export interface RangoServicio {
  desde: string | null;
  hasta: string | null;
}

/** Espejo de la validación del backend (`assertFechaEnServicio`): la bitácora no se sale del servicio del Pedido. */
export function fueraDelServicio(fecha: string, rango: RangoServicio): boolean {
  return (!!rango.desde && fecha < rango.desde) || (!!rango.hasta && fecha > rango.hasta);
}

/** Fecha sugerida para una actividad nueva: hoy, o el día más cercano dentro del servicio si hoy cae afuera. */
export function fechaSugeridaEnServicio(hoy: string, rango: RangoServicio): string {
  if (rango.desde && hoy < rango.desde) return rango.desde;
  if (rango.hasta && hoy > rango.hasta) return rango.hasta;
  return hoy;
}

/** Agrupa registros por día (`date`), en orden de fecha y sin cambiar el orden dentro del día — mismo criterio que la bitácora. */
export function agruparPorFecha<T extends { date: string }>(items: T[]): { fecha: string; items: T[] }[] {
  const porFecha = new Map<string, T[]>();
  for (const item of items) porFecha.set(item.date, [...(porFecha.get(item.date) ?? []), item]);
  return [...porFecha.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, items]) => ({ fecha, items }));
}
