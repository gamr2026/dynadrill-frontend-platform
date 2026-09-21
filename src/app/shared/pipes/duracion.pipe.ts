import { Pipe, PipeTransform } from '@angular/core';

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

/** Formatea una duración en milisegundos a un texto corto ("2 d 3 h", "45 min", "en curso" si es `null`/`undefined`). */
@Pipe({ name: 'duracion' })
export class DuracionPipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return 'en curso';
    const abs = Math.max(0, ms);
    if (abs < MINUTO_MS) return '< 1 min';
    if (abs < HORA_MS) return `${Math.floor(abs / MINUTO_MS)} min`;
    if (abs < DIA_MS) {
      const horas = Math.floor(abs / HORA_MS);
      const minutos = Math.floor((abs % HORA_MS) / MINUTO_MS);
      return minutos > 0 ? `${horas} h ${minutos} min` : `${horas} h`;
    }
    const dias = Math.floor(abs / DIA_MS);
    const horas = Math.floor((abs % DIA_MS) / HORA_MS);
    return horas > 0 ? `${dias} d ${horas} h` : `${dias} d`;
  }
}
