import type {
  AlertaPreventivaFlota,
  PreventivoFlota,
  TipoUnidadFlota,
} from '../../flota/models/unidad-flota.model';
import type { RegistroMantenimiento } from './historial-mantenimiento.model';
import type { AlertaPreventiva, UnidadTipo } from './unidad.model';

/**
 * Traductor puro entre Flota (backend nuevo: códigos estables en minúscula, ids UUID) y los textos que ya usan las pantallas de
 * Mantenimiento (Preventivo, Historial). La regla del semáforo y las tolerancias las calcula el servidor; aquí solo se presenta.
 */

const TIPO_UNIDAD: Record<TipoUnidadFlota, UnidadTipo> = {
  servicio: 'Servicio',
  auxiliar: 'Auxiliar',
  transporte: 'Transporte',
};

const UNIDAD_DE_METRICA = { horas: 'horas', km: 'km', dias: 'días' } as const;
const SUFIJO = { horas: 'h', km: 'km', dias: 'días' } as const;

const numero = (n: number) =>
  new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 }).format(n);

export function alertaDesdeFlota(a: AlertaPreventivaFlota): AlertaPreventiva {
  const sufijo = SUFIJO[a.metrica];
  const restante = Math.round(a.restante);
  const actual = a.metrica === 'dias' ? a.consumido : a.valorActual;
  return {
    unidadId: a.unidad.id,
    unidadCode: a.unidad.codigo,
    unidadNombre: a.unidad.nombre,
    unidadTipo: TIPO_UNIDAD[a.unidad.tipo],
    descripcion: a.descripcion,
    consumido: Math.max(a.consumido, 0),
    intervalo: a.intervalo,
    actualLabel: actual === null || actual === undefined ? '—' : `${numero(actual)} ${sufijo}`,
    restante,
    unidad: UNIDAD_DE_METRICA[a.metrica],
    nivel: a.nivel,
    proximoEn:
      restante > 0
        ? `${restante} ${sufijo}`
        : a.enVentana
          ? `En ventana (${-restante} ${sufijo} sobre lo previsto)`
          : 'Vencido',
    tipoServicio: a.tipoServicio === 'a' ? 'A' : a.tipoServicio === 'b' ? 'B' : undefined,
    valorActual: a.valorActual ?? undefined,
  };
}

/** Un mantenimiento preventivo de Flota como registro del historial (clase «Preventivo»). */
export function registroDesdePreventivo(
  p: PreventivoFlota,
  unidad: { id: string; codigo: string; tipo: TipoUnidadFlota },
): RegistroMantenimiento {
  const medida = p.valor ?? undefined;
  return {
    id: p.id,
    unidadId: unidad.id,
    unidadCode: unidad.codigo,
    clase: 'Preventivo',
    tipoServicio: p.tipoServicio === 'a' ? 'A' : p.tipoServicio === 'b' ? 'B' : undefined,
    fecha: p.fecha.slice(0, 10),
    horometro: unidad.tipo === 'servicio' ? medida : undefined,
    km: unidad.tipo === 'transporte' ? medida : undefined,
    responsable: p.responsable?.nombre ?? 'Carga inicial',
    ejecutadoPor: p.ejecutadoPor === 'tercero' ? 'Tercero' : 'Interno',
    proveedor: p.proveedor?.nombre,
    observaciones: p.observaciones ?? undefined,
  };
}
