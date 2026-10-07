/** Una actividad editable del Reporte Job de un día (la fecha es fija: no se mueven actividades entre días). */
export interface FilaActividad {
  startTime: string;
  endTime: string;
  detail: string;
}

const HORA_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Mismo criterio que el DTO del backend (`ActividadDiaBitacoraDto`): horas HH:mm y detalle no vacío. */
export function filaActividadValida(fila: FilaActividad): boolean {
  return HORA_HHMM.test(fila.startTime) && HORA_HHMM.test(fila.endTime) && fila.detail.trim().length > 0;
}

export function filasActividadValidas(filas: FilaActividad[]): boolean {
  return filas.every(filaActividadValida);
}
