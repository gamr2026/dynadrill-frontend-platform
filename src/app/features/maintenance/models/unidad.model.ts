/**
 * Tipos de unidad según MAN-002 — determinan la regla preventiva aplicable:
 * - Servicio: control por horas de operación (horómetro)
 * - Auxiliar: control por tiempo (cada 6 meses)
 * - Transporte: control por kilometraje (cada 5.000 km)
 */
export type UnidadTipo = 'Servicio' | 'Auxiliar' | 'Transporte';

/**
 * Intervalos de mantenimiento preventivo para unidades de Servicio (horas).
 * Cada intervalo representa un tipo de trabajo distinto según MAN-002.
 */
export const INTERVALOS_SERVICIO = [
  { horas: 250,  descripcion: 'Aceite de motor + filtros de combustible' },
  { horas: 500,  descripcion: 'Filtro de aire' },
  { horas: 1000, descripcion: 'Filtro de aceite hidráulico' },
  { horas: 2000, descripcion: 'Sistema hidráulico + filtros' },
] as const;

export type IntervaloServicio = typeof INTERVALOS_SERVICIO[number]['horas'];

/** Registro del último mantenimiento ejecutado para un intervalo específico (Servicio). */
export interface RegistroPreventivo {
  intervaloHoras: IntervaloServicio;
  ultimoEnHoras: number;
  ultimaFecha: string;
}

export interface Unidad {
  id: number;
  code: string;
  nombre: string;
  tipo: UnidadTipo;

  // ── Unidades de Servicio ──
  /** Horómetro total actual (horas de operación acumuladas). */
  horometroActual?: number;
  /** Historial de mantenimientos preventivos por intervalo. */
  registrosPrev?: RegistroPreventivo[];
  /**
   * Fecha en que se registró el último mantenimiento tipo 250h.
   * Se usa para aplicar la regla de 6 meses sin alcanzar las 250h.
   */
  fechaUltimoMantenimiento?: string;

  // ── Vehículos de Transporte ──
  kmActual?: number;
  kmUltimoMantenimiento?: number;
  fechaUltimoMantenimientoKm?: string;

  // ── Equipos Auxiliares ──
  fechaUltimoMantenimientoAux?: string;
}

/** Nivel de alerta del semáforo preventivo. */
export type AlertaPreventivaNivel = 'rojo' | 'amarillo' | 'verde';

/** Alerta calculada para una unidad y un intervalo/regla específica. */
export interface AlertaPreventiva {
  unidadId: number;
  unidadCode: string;
  unidadNombre: string;
  descripcion: string;
  /** Valor consumido desde el último mantenimiento (para la barra de progreso). */
  consumido: number;
  /** Valor total del intervalo (para la barra de progreso). */
  intervalo: number;
  /** Texto del valor actual (ej. "1480 h", "4800 km", "185 días"). */
  actualLabel: string;
  /** Horas/km/días restantes hasta el próximo mantenimiento (negativo = vencido). */
  restante: number;
  unidad: 'horas' | 'km' | 'días';
  nivel: AlertaPreventivaNivel;
  proximoEn: string;
}

// ── Tolerancias según el Plan de Mantenimiento 2026 ──
const TOLERANCIA_250H = 30;
const TOLERANCIA_2000H = 50;
const TOLERANCIA_KM = 500;
const MESES_SIN_HORAS = 6;
const UMBRAL_AMARILLO_PCT = 0.15; // alerta amarilla cuando queda ≤ 15% del intervalo

function nivelAlerta(restante: number, intervalo: number): AlertaPreventivaNivel {
  if (restante <= 0) return 'rojo';
  if (restante <= intervalo * UMBRAL_AMARILLO_PCT) return 'amarillo';
  return 'verde';
}

function diasDesde(isoFecha: string): number {
  return Math.floor((Date.now() - new Date(isoFecha).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * MAN-002 — calcula todas las alertas preventivas para una unidad.
 * Retorna una alerta por cada intervalo/regla que aplique.
 */
export function calcularAlertas(u: Unidad): AlertaPreventiva[] {
  const alertas: AlertaPreventiva[] = [];

  if (u.tipo === 'Servicio' && u.horometroActual !== undefined) {
    for (const intervalo of INTERVALOS_SERVICIO) {
      const registro = u.registrosPrev?.find(r => r.intervaloHoras === intervalo.horas);
      const ultimoEn = registro?.ultimoEnHoras ?? 0;
      const consumido = u.horometroActual - ultimoEn;
      const restante = intervalo.horas - consumido;
      alertas.push({
        unidadId: u.id,
        unidadCode: u.code,
        unidadNombre: u.nombre,
        descripcion: `${intervalo.horas}h — ${intervalo.descripcion}`,
        consumido,
        intervalo: intervalo.horas,
        actualLabel: `${u.horometroActual} h`,
        restante: Math.round(restante),
        unidad: 'horas',
        nivel: nivelAlerta(restante, intervalo.horas),
        proximoEn: restante > 0 ? `${Math.round(restante)} h` : 'Vencido',
      });
    }

    // Regla de 6 meses sin alcanzar 250h
    if (u.fechaUltimoMantenimiento) {
      const diasTranscurridos = diasDesde(u.fechaUltimoMantenimiento);
      const diasLimite = MESES_SIN_HORAS * 30;
      const restanteDias = diasLimite - diasTranscurridos;
      const horasDesdeUltimo = u.horometroActual - (u.registrosPrev?.find(r => r.intervaloHoras === 250)?.ultimoEnHoras ?? 0);
      if (horasDesdeUltimo < 250) {
        alertas.push({
          unidadId: u.id,
          unidadCode: u.code,
          unidadNombre: u.nombre,
          descripcion: '6 meses sin alcanzar 250h — mantenimiento por tiempo',
          consumido: diasTranscurridos,
          intervalo: diasLimite,
          actualLabel: `${diasTranscurridos} días`,
          restante: restanteDias,
          unidad: 'días',
          nivel: nivelAlerta(restanteDias, diasLimite),
          proximoEn: restanteDias > 0 ? `${restanteDias} días` : 'Vencido',
        });
      }
    }
  }

  if (u.tipo === 'Auxiliar' && u.fechaUltimoMantenimientoAux) {
    const diasTranscurridos = diasDesde(u.fechaUltimoMantenimientoAux);
    const diasLimite = 6 * 30;
    const restanteDias = diasLimite - diasTranscurridos;
    alertas.push({
      unidadId: u.id,
      unidadCode: u.code,
      unidadNombre: u.nombre,
      descripcion: 'Mantenimiento semestral — equipo auxiliar',
      consumido: diasTranscurridos,
      intervalo: diasLimite,
      actualLabel: `${diasTranscurridos} días`,
      restante: restanteDias,
      unidad: 'días',
      nivel: nivelAlerta(restanteDias, diasLimite),
      proximoEn: restanteDias > 0 ? `${restanteDias} días` : 'Vencido',
    });
  }

  if (u.tipo === 'Transporte' && u.kmActual !== undefined && u.kmUltimoMantenimiento !== undefined) {
    const kmDesdeUltimo = u.kmActual - u.kmUltimoMantenimiento;
    const restanteKm = 5000 - kmDesdeUltimo;
    alertas.push({
      unidadId: u.id,
      unidadCode: u.code,
      unidadNombre: u.nombre,
      descripcion: 'Cada 5.000 km — vehículo de transporte',
      consumido: kmDesdeUltimo,
      intervalo: 5000,
      actualLabel: `${u.kmActual.toLocaleString()} km`,
      restante: Math.round(restanteKm),
      unidad: 'km',
      nivel: nivelAlerta(restanteKm, 5000),
      proximoEn: restanteKm > 0 ? `${Math.round(restanteKm)} km` : 'Vencido',
    });
  }

  return alertas;
}
