import type { DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';

/** Opciones 00–23 para el selector de hora de las actividades de bitácora. */
export const HOUR_OPTIONS: DynadrillSelectOption[] = Array.from({ length: 24 }, (_, h) => {
  const v = String(h).padStart(2, '0');
  return { value: v, label: v };
});

/** Opciones 00–59 para el selector de minutos de las actividades de bitácora. */
export const MINUTE_OPTIONS: DynadrillSelectOption[] = Array.from({ length: 60 }, (_, m) => {
  const v = String(m).padStart(2, '0');
  return { value: v, label: v };
});

/** 'HH:mm' a 'HH:mm' → horas — mismo criterio que el servidor (turno que cruza medianoche si fin < inicio). */
export function calcDurationHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let minutes = endH * 60 + endM - (startH * 60 + startM);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}
