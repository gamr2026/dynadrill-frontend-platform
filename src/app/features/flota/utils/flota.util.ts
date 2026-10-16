import type { HttpErrorResponse } from '@angular/common/http';

/** Fecha local (medianoche) a `AAAA-MM-DD`; no usa UTC para no correr el día en Ecuador (UTC-5). */
export function aFechaIso(fecha: Date | null | undefined): string | null {
  if (!fecha) return null;
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** `AAAA-MM-DD` a medianoche LOCAL (`new Date('2026-01-10')` es UTC y el selector de fecha lo mostraría un día antes). */
export function deFechaIso(iso: string | null | undefined): Date | null {
  return iso ? new Date(`${iso.slice(0, 10)}T00:00:00`) : null;
}

/** Texto del error del backend (`detail` de Problem Details); si no hay, el de respaldo. */
export function mensajeDeError(e: HttpErrorResponse, respaldo: string): string {
  const detalle: unknown = e?.error?.detail ?? e?.error?.message;
  if (typeof detalle === 'string' && detalle) return detalle;
  if (Array.isArray(detalle)) return detalle.join('. ');
  return respaldo;
}

/** `1.480` / `87.400,5`: miles con punto y un decimal solo si hace falta. */
export function formatoNumero(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 }).format(n);
}

/** Día `AAAA-MM-DD` mostrado como `dd/mm/aaaa`. */
export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
