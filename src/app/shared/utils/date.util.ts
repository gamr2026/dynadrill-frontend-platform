/**
 * `Date.prototype.toISOString()` y `new Date('yyyy-MM-dd')` operan en UTC, no en
 * hora local. Para un `Date` que representa un día del calendario (sin hora
 * significativa, como el valor de un `dynadrill-datetime-picker mode="date"`),
 * eso desplaza la fecha un día en cualquier zona horaria con offset negativo
 * (ej. Ecuador, UTC-5) apenas la hora local cae después de las ~19:00–24:00,
 * o produce el efecto contrario en offsets positivos al reconstruir un Date
 * desde el string guardado. Estas dos funciones operan siempre en hora local.
 */

/** Formatea un Date como `yyyy-MM-dd` usando sus componentes de fecha LOCALES (no UTC). */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parsea un string `yyyy-MM-dd` como medianoche LOCAL (no UTC). */
export function parseLocalDateString(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** `formatDate(..., 'es')` devuelve el día de la semana/mes en minúscula ("viernes, ..."). */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
