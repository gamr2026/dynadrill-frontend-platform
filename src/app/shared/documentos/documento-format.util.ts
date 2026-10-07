/** "2026-09-29" / "2026-09-29T20:43:52Z" → "29/09/2026". Si no es una fecha ISO se devuelve tal cual; vacío → "". */
export function fechaDoc(valor: string | null | undefined): string {
  if (!valor) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-08-27" → "27-ago-2026": separador de día del Reporte Job, igual que el formato en Excel (DYN-SGI-RE-047). */
export function fechaDiaDoc(valor: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '');
  return m ? `${m[3]}-${MESES_CORTOS[Number(m[2]) - 1]}-${m[1]}` : (valor ?? '');
}

/** ISO con hora → "29/09/2026 20:43" (hora local). Sin hora se comporta como `fechaDoc`. */
export function fechaHoraDoc(valor: string | null | undefined): string {
  if (!valor) return '';
  if (!/T\d{2}:\d{2}/.test(valor)) return fechaDoc(valor);
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Marca del casillero del formato: "√" = OK, "X" = defectuoso, vacío = sin revisar. */
export function marcaInspeccion(estado: 'ok' | 'defectuoso' | null | undefined): string {
  return estado === 'ok' ? '√' : estado === 'defectuoso' ? 'X' : '';
}

/** Una línea por renglón del formato ("1 ____"): el texto libre se parte por saltos de línea y se completa con renglones vacíos. */
export function renglones(texto: string | null | undefined, minimo: number): string[] {
  const lineas = (texto ?? '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  while (lineas.length < minimo) lineas.push('');
  return lineas;
}
