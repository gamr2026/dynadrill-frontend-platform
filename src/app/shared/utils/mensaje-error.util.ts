/**
 * Mensaje que el backend nuevo explica en un error HTTP (`detail` o `message`, texto o lista), o `respaldo` si no trae ninguno.
 * Así la pantalla dice por qué falló (por ejemplo «stock insuficiente») en lugar de un «No se pudo…» genérico.
 */
export function mensajeDeError(err: unknown, respaldo: string): string {
  const e = err as { error?: { detail?: unknown; message?: unknown } } | null;
  const candidato = e?.error?.detail ?? e?.error?.message;
  if (typeof candidato === 'string' && candidato.trim()) return candidato;
  if (Array.isArray(candidato) && candidato.length) return candidato.join('. ');
  return respaldo;
}
