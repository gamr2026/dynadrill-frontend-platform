/** Auditoría (`/api/auditoria`): registro central e inmutable de los hechos de negocio. Solo lo ve el Superadmin. */

export const PERMISO_AUDITORIA = 'auditoria.eventos.ver';

export const ORIGENES_ETIQUETA: Record<string, string> = {
  comercial: 'Comercial',
  operaciones: 'Operaciones',
  flota: 'Flota',
  qhse: 'QHSE',
  plataforma: 'Plataforma',
  worker: 'Reportería',
};

export interface ActorAuditoria {
  id: string;
  nombre: string;
  rol: { codigo: string; nombre: string } | null;
}

export interface EventoAuditado {
  id: string;
  /** Código del tipo de evento: `operaciones.pumping.ticket_creado`. */
  tipo: string;
  version: number;
  ocurridoAt: string;
  origen: string;
  sujeto: { tipo: string; id: string };
  actor: ActorAuditoria | null;
  correlacionId: string | null;
  causaId: string | null;
  /** Claves de negocio del evento: `{ pedido_codigo: 'PED-0001' }`. */
  datos: Record<string, string>;
}

export interface PaginaEventos {
  total: number;
  pagina: number;
  limite: number;
  items: EventoAuditado[];
}

export interface CatalogosAuditoria {
  origenes: string[];
  tiposEvento: string[];
  sujetoTipos: string[];
  claves: { codigo: string; descripcion: string }[];
}

/** Filtros de la búsqueda; lo que está vacío no se envía. */
export interface FiltrosAuditoria {
  actorId: string | null;
  tipo: string | null;
  origen: string | null;
  sujetoTipo: string | null;
  sujetoId: string;
  clave: string | null;
  valor: string;
  /** `AAAA-MM-DD` (día local). */
  desde: string | null;
  hasta: string | null;
}

export const FILTROS_VACIOS: FiltrosAuditoria = {
  actorId: null,
  tipo: null,
  origen: null,
  sujetoTipo: null,
  sujetoId: '',
  clave: null,
  valor: '',
  desde: null,
  hasta: null,
};

export const LIMITE_PAGINA = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (v: string): boolean => UUID.test(v.trim());

export function hayFiltros(f: FiltrosAuditoria): boolean {
  return (Object.keys(FILTROS_VACIOS) as (keyof FiltrosAuditoria)[]).some(
    (k) => f[k] !== FILTROS_VACIOS[k],
  );
}

/**
 * Lo que impide buscar con esos filtros (con «usted»), o `null` si se puede. El backend responde 400 por lo mismo, pero se avisa antes
 * y en el campo que corresponde.
 */
export function errorDeFiltros(f: FiltrosAuditoria): string | null {
  if ((f.sujetoTipo === null) !== (f.sujetoId.trim() === '')) {
    return 'Para buscar por entidad indique su tipo y su identificador.';
  }
  if (f.sujetoId.trim() !== '' && !esUuid(f.sujetoId)) {
    return 'El identificador de la entidad debe ser un UUID.';
  }
  if ((f.clave === null) !== (f.valor.trim() === '')) {
    return 'Para buscar por un dato indique cuál y su valor.';
  }
  if (f.desde && f.hasta && f.desde > f.hasta) {
    return 'La fecha «desde» no puede ser posterior a «hasta».';
  }
  return null;
}

/** Parámetros de `GET /auditoria/eventos`. «Hasta» incluye todo el día elegido. */
export function paramsDeBusqueda(
  f: FiltrosAuditoria,
  pagina: number,
  limite = LIMITE_PAGINA,
): Record<string, string> {
  const p: Record<string, string> = { pagina: String(pagina), limite: String(limite) };
  if (f.actorId) p['actorId'] = f.actorId;
  if (f.tipo) p['tipo'] = f.tipo;
  if (f.origen) p['origen'] = f.origen;
  if (f.sujetoTipo && f.sujetoId.trim()) {
    p['sujetoTipo'] = f.sujetoTipo;
    p['sujetoId'] = f.sujetoId.trim();
  }
  if (f.clave && f.valor.trim()) {
    p['clave'] = f.clave;
    p['valor'] = f.valor.trim();
  }
  if (f.desde) p['desde'] = inicioDelDia(f.desde);
  if (f.hasta) p['hasta'] = finDelDia(f.hasta);
  return p;
}

/** Instantes en hora local del navegador (Ecuador no cambia de hora), enviados como UTC. */
const inicioDelDia = (dia: string): string => new Date(`${dia}T00:00:00`).toISOString();
const finDelDia = (dia: string): string => new Date(`${dia}T23:59:59.999`).toISOString();

const SIGLAS = new Set(['epi', 'ptw', 'swa', 'iperc', 'qhse', 'fcr', 'as2', 'ot']);

/** «ticket_creado» → «Ticket creado» (las siglas conocidas quedan en mayúsculas). */
export function humanizar(codigo: string): string {
  const palabras = codigo.split('_').filter(Boolean);
  const texto = palabras.map((p) => (SIGLAS.has(p) ? p.toUpperCase() : p)).join(' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Lo que pasó, en palabras: el último tramo del tipo de evento. */
export function etiquetaEvento(tipo: string): string {
  return humanizar(tipo.split('.').slice(-1)[0] ?? tipo);
}

/** Sobre qué entidad ocurrió (la entidad es el tipo de sujeto). */
export const etiquetaSujeto = humanizar;

export const etiquetaOrigen = (origen: string): string =>
  ORIGENES_ETIQUETA[origen] ?? humanizar(origen);

/** Los datos de negocio del evento con la descripción de cada clave, en el orden del catálogo. */
export function datosLegibles(
  datos: Record<string, string>,
  claves: readonly { codigo: string; descripcion: string }[],
): { etiqueta: string; valor: string }[] {
  const descripcion = new Map(claves.map((c) => [c.codigo, c.descripcion]));
  return Object.entries(datos).map(([k, valor]) => ({
    etiqueta: descripcion.get(k) ?? humanizar(k),
    valor,
  }));
}

/** Resumen «1–25 de 130» del paginador. */
export function resumenPagina(
  pagina: number,
  limite: number,
  enPagina: number,
  total: number,
): string {
  if (total === 0 || enPagina === 0) return 'Sin resultados';
  const desde = (pagina - 1) * limite + 1;
  return `${desde}–${desde + enPagina - 1} de ${total}`;
}
