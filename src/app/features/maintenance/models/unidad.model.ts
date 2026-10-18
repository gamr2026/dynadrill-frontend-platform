/**
 * Tipos de unidad según MAN-002 — determinan la regla preventiva aplicable:
 * - Servicio: control por horas de operación (horómetro)
 * - Auxiliar: control por tiempo (cada 6 meses)
 * - Transporte: control por kilometraje (cada 5.000 km)
 */
export type UnidadTipo = 'Servicio' | 'Auxiliar' | 'Transporte';

/** Subclasificación de tamaño/peso pedida por el cliente para Indicadores de Mantenimiento — solo aplica a unidades de Transporte (camiones vs. camionetas); Servicio y Auxiliar no la usan por ahora. */
export type UnidadCategoriaPeso = 'Pesado' | 'Liviano';

/**
 * Servicios de mantenimiento preventivo para unidades de Servicio (horas),
 * según el diagrama de flujo y el Plan de Mantenimiento 2026 del cliente —
 * dos tipos, no cuatro intervalos independientes. El tipo B es acumulativo:
 * incluye las actividades de A, así que ejecutar un B resetea también el
 * contador de A (ver 2.2 en calcularAlertas y el mock de registro).
 */
export const TIPOS_SERVICIO = [
  {
    tipo: 'A',
    horas: 250,
    tolerancia: 30,
    descripcion: 'Tipo A — aceites, filtros, inspección visual y pruebas',
  },
  {
    tipo: 'B',
    horas: 2000,
    tolerancia: 50,
    descripcion: 'Tipo B — incluye A + transmisiones, cajas, hidráulico',
  },
] as const;

export type TipoServicio = (typeof TIPOS_SERVICIO)[number]['tipo'];

/** Registro del último mantenimiento ejecutado para un tipo de servicio específico (A o B). */
export interface RegistroPreventivo {
  tipoServicio: TipoServicio;
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
  /** Solo Transporte — camiones/cabezales = Pesado, camionetas = Liviano. Ver Indicadores de Mantenimiento. */
  categoriaPeso?: UnidadCategoriaPeso;

  // ── Equipos Auxiliares ──
  fechaUltimoMantenimientoAux?: string;

  /**
   * Proveedor externo a cargo del mantenimiento preventivo — típico en
   * camionetas/camiones (Plan 2026: "el reporte de mantenimiento vinculado
   * es el proporcionado por el proveedor de servicio"). Si está vacío, el
   * mantenimiento se asume interno (Dynadrill).
   */
  proveedorMantenimiento?: string;

  /**
   * ── Datos patrimoniales (módulo Inventario) ──
   * Mismo registro que usa Mantenimiento (una sola fuente, no un
   * "vehículo" duplicado) — Inventario solo agrega los campos de
   * registro/activo fijo que a Mantenimiento no le hacían falta.
   * Se editan aparte, vía PATCH /api/unidades/:id/patrimonio, sin tocar
   * los campos operativos (horómetro/km/mantenimiento) de esta misma
   * interfaz — esos siguen viviendo exclusivamente en el flujo de
   * registrarMantenimiento().
   */
  placa?: string;
  marca?: string;
  modelo?: string;
  anio?: string;
  /**
   * ── Documentos legales del vehículo (ISO fecha) ──
   * Antes se tipeaban a mano en cada Inspección de Vehículos (DYN-SGI-RE-068).
   * Son datos maestros: no cambian de viaje a viaje. La inspección los
   * precarga y bloquea; se editan solo acá, en Inventario.
   */
  fechaMatricula?: string;
  caducidadMatricula?: string;
  caducidadPoliza?: string;
  vigenciaOtroDocumento?: string;
  /** Responsable administrativo/patrimonial del activo — no es el operador que lo usa en campo. */
  responsablePatrimonial?: string;
  /** Unidad de referencia dentro de su categoría (informativo). */
  predeterminado?: boolean;
  /** false = dado de baja / fuera de servicio patrimonial. Por defecto true si no se ha registrado nada. */
  activo?: boolean;
  notaInventario?: string;
}

/** Campos patrimoniales editables desde Inventario — no incluye nada operativo de Mantenimiento. */
export type UpdatePatrimonioInput = Pick<
  Unidad,
  | 'placa'
  | 'marca'
  | 'modelo'
  | 'anio'
  | 'fechaMatricula'
  | 'caducidadMatricula'
  | 'caducidadPoliza'
  | 'vigenciaOtroDocumento'
  | 'responsablePatrimonial'
  | 'predeterminado'
  | 'activo'
  | 'notaInventario'
>;

/**
 * Alta de una unidad nueva — a diferencia de UpdatePatrimonioInput (solo
 * patrimonial) o RegistrarPMInput (solo un mantenimiento puntual), esto sí
 * necesita capturar la línea base operativa (horómetro/km de arranque)
 * junto con los datos patrimoniales, porque calcularAlertas() no tiene de
 * dónde más sacarla — una unidad creada sin esto no generaría ninguna
 * alerta preventiva hasta el primer registrarMantenimiento().
 */
export type CreateUnidadInput = Pick<
  Unidad,
  | 'code'
  | 'nombre'
  | 'tipo'
  | 'horometroActual'
  | 'fechaUltimoMantenimiento'
  | 'kmActual'
  | 'kmUltimoMantenimiento'
  | 'categoriaPeso'
  | 'fechaUltimoMantenimientoAux'
  | 'proveedorMantenimiento'
  | 'placa'
  | 'marca'
  | 'modelo'
  | 'anio'
  | 'fechaMatricula'
  | 'caducidadMatricula'
  | 'caducidadPoliza'
  | 'vigenciaOtroDocumento'
  | 'responsablePatrimonial'
  | 'predeterminado'
  | 'activo'
  | 'notaInventario'
>;

/** Nivel de alerta del semáforo preventivo. */
export type AlertaPreventivaNivel = 'rojo' | 'amarillo' | 'verde';

/** Alerta calculada para una unidad y un intervalo/regla específica. */
export interface AlertaPreventiva {
  /** Número en la demo, UUID en Flota. */
  unidadId: number | string;
  /** Tipo de la unidad (lo informa Flota; la demo no lo traía en la alerta). */
  unidadTipo?: UnidadTipo;
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
  /** Solo para Servicio: tipo de servicio que generó esta alerta (A o B). */
  tipoServicio?: TipoServicio;
  /** Valor actual de la métrica principal (horómetro o km). */
  valorActual?: number;
}

// ── Tolerancias según el Plan de Mantenimiento 2026 ──
const TOLERANCIA_KM = 500;
const MESES_SIN_HORAS = 6;
const UMBRAL_AMARILLO_PCT = 0.15; // alerta amarilla cuando queda ≤ 15% del intervalo

/**
 * `tolerancia` es la ventana ± que el Plan de Mantenimiento 2026 admite
 * como normal (ej. 250h ±30h): dentro de esa ventana la unidad sigue
 * "amarillo" (próximo), no "rojo" — recién al superarla se considera
 * realmente vencida.
 */
function nivelAlerta(restante: number, intervalo: number, tolerancia = 0): AlertaPreventivaNivel {
  if (restante < -tolerancia) return 'rojo';
  if (restante <= intervalo * UMBRAL_AMARILLO_PCT) return 'amarillo';
  return 'verde';
}

/** Texto del "próximo en" respetando la ventana de tolerancia — "Vencido" solo cuando ya la supera. */
function proximoEnTexto(restante: number, tolerancia: number, unidad: string): string {
  if (restante > 0) return `${Math.round(restante)} ${unidad}`;
  if (restante >= -tolerancia)
    return `En ventana (${Math.round(-restante)} ${unidad} sobre lo previsto)`;
  return 'Vencido';
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

  if (u.tipo === 'Servicio') {
    if (u.horometroActual !== undefined) {
      const registroA = u.registrosPrev?.find((r) => r.tipoServicio === 'A');
      const registroB = u.registrosPrev?.find((r) => r.tipoServicio === 'B');
      for (const svc of TIPOS_SERVICIO) {
        // Un servicio B incluye las actividades de A, así que también resetea su contador.
        const ultimoEn =
          svc.tipo === 'A'
            ? Math.max(registroA?.ultimoEnHoras ?? 0, registroB?.ultimoEnHoras ?? 0)
            : (registroB?.ultimoEnHoras ?? 0);
        const consumido = u.horometroActual - ultimoEn;
        const restante = svc.horas - consumido;
        alertas.push({
          unidadId: u.id,
          unidadCode: u.code,
          unidadNombre: u.nombre,
          descripcion: `Tipo ${svc.tipo} (${svc.horas}h) — ${svc.descripcion}`,
          consumido,
          intervalo: svc.horas,
          actualLabel: `${u.horometroActual} h`,
          restante: Math.round(restante),
          unidad: 'horas',
          nivel: nivelAlerta(restante, svc.horas, svc.tolerancia),
          proximoEn: proximoEnTexto(restante, svc.tolerancia, 'h'),
          tipoServicio: svc.tipo,
          valorActual: u.horometroActual,
        });
      }
    }

    /**
     * Regla de 6 meses sin alcanzar el tipo A (250h) — aplica a TODA unidad
     * de Servicio, tenga horómetro o no (ej. cisternas y tanques, que el
     * cliente nombra explícitamente como equipos de servicio sin
     * horómetro). Antes vivía dentro del `if (horometroActual !== undefined)`
     * de arriba y esas unidades no generaban ninguna alerta.
     */
    if (u.fechaUltimoMantenimiento) {
      const diasTranscurridos = diasDesde(u.fechaUltimoMantenimiento);
      const diasLimite = MESES_SIN_HORAS * 30;
      const restanteDias = diasLimite - diasTranscurridos;
      const registroA = u.registrosPrev?.find((r) => r.tipoServicio === 'A');
      const registroB = u.registrosPrev?.find((r) => r.tipoServicio === 'B');
      const ultimoEnA = Math.max(registroA?.ultimoEnHoras ?? 0, registroB?.ultimoEnHoras ?? 0);
      const horasDesdeUltimo = u.horometroActual === undefined ? 0 : u.horometroActual - ultimoEnA;
      if (horasDesdeUltimo < 250) {
        alertas.push({
          unidadId: u.id,
          unidadCode: u.code,
          unidadNombre: u.nombre,
          descripcion: '6 meses sin alcanzar tipo A (250h) — mantenimiento por tiempo',
          consumido: diasTranscurridos,
          intervalo: diasLimite,
          actualLabel: `${diasTranscurridos} días`,
          restante: restanteDias,
          unidad: 'días',
          nivel: nivelAlerta(restanteDias, diasLimite),
          proximoEn: restanteDias > 0 ? `${restanteDias} días` : 'Vencido',
          tipoServicio: 'A',
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

  if (
    u.tipo === 'Transporte' &&
    u.kmActual !== undefined &&
    u.kmUltimoMantenimiento !== undefined
  ) {
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
      nivel: nivelAlerta(restanteKm, 5000, TOLERANCIA_KM),
      proximoEn: proximoEnTexto(restanteKm, TOLERANCIA_KM, 'km'),
      valorActual: u.kmActual,
    });
  }

  return alertas;
}
