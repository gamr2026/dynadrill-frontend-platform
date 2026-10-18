import { describe, expect, it } from 'vitest';
import { PASOS_PUMPING, pendientesDelPaso, validarAsignacion, TONO_MACRO, etiquetaRol, etiquetaRoles, etiquetaTipoServicio, mensajeErrorTicket, nombrePaso, validarMovimientoQuimicos, validarQuimicos } from './ticket-pumping';

describe('tickets de Pumping (modelo)', () => {
  it('escribe los roles con su nombre y deja pasar los desconocidos', () => {
    expect(etiquetaRol('jefe_base')).toBe('Jefe de Base');
    expect(etiquetaRoles(['supervisor', 'supervisor_pumping'])).toBe('Supervisor / Supervisor Pumping');
    expect(etiquetaRol('otro_rol')).toBe('otro_rol');
  });

  it('humaniza los códigos de tipo de servicio y los nombres de paso', () => {
    expect(etiquetaTipoServicio('control_fluidos')).toBe('Control fluidos');
    expect(etiquetaTipoServicio('pumping')).toBe('Pumping');
    expect(nombrePaso('revision_inicial')).toBe('Revisión inicial');
    expect(nombrePaso('inexistente')).toBe('inexistente');
    expect(nombrePaso(null)).toBe('');
  });

  it('los 10 pasos (sin mantenimiento) están en orden y cada macro tiene tono', () => {
    expect(PASOS_PUMPING).toHaveLength(10);
    expect(PASOS_PUMPING[0].codigo).toBe('revision_inicial');
    expect(PASOS_PUMPING[9].codigo).toBe('cierre');
    expect(Object.keys(TONO_MACRO).sort()).toEqual(['aprobado', 'en_proceso', 'esperando_aprobacion', 'pendiente', 'rechazado']);
  });

  it('muestra el mensaje del backend o uno claro según el código', () => {
    expect(mensajeErrorTicket({ status: 403, error: { detail: 'El paso "Asignación" lo atiende otro rol' } }, 'x')).toContain('lo atiende otro rol');
    expect(mensajeErrorTicket({ status: 403, error: {} }, 'x')).toContain('otro rol');
    expect(mensajeErrorTicket({ status: 409, error: {} }, 'x')).toContain('cambió de paso');
    expect(mensajeErrorTicket({ status: 500 }, 'por defecto')).toBe('por defecto');
  });

  it('la asignación pide supervisor y, por cada fila, un operador con su unidad, sin repetir personas', () => {
    expect(validarAsignacion(null, [{ usuarioId: 'o1', vehiculoId: 'v1' }])).toContain('supervisor');
    expect(validarAsignacion('s1', [])).toContain('operador');
    expect(validarAsignacion('s1', [{ usuarioId: null, vehiculoId: 'v1' }])).toContain('operador de cada fila');
    expect(validarAsignacion('s1', [{ usuarioId: 'o1', vehiculoId: null }])).toContain('unidad de cada operador');
    expect(validarAsignacion('s1', [{ usuarioId: 'o1', vehiculoId: 'v1' }, { usuarioId: 'o1', vehiculoId: 'v2' }])).toContain('no puede repetirse');
    expect(validarAsignacion('s1', [{ usuarioId: 's1', vehiculoId: 'v1' }])).toContain('también operador');
    expect(validarAsignacion('s1', [{ usuarioId: 'o1', vehiculoId: 'v1' }, { usuarioId: 'o2', vehiculoId: 'v1' }])).toBeNull(); // dos operadores pueden compartir unidad
  });

  it('los requisitos pendientes son los del paso actual', () => {
    const r = (paso: string, estado: 'pendiente' | 'cumplido') => ({ paso, estado }) as never;
    const t = { paso: { codigo: 'traslado_salida' }, requisitos: [r('traslado_salida', 'pendiente'), r('traslado_salida', 'cumplido'), r('revision_reportes_salida', 'pendiente')] } as never;
    expect(pendientesDelPaso(t)).toHaveLength(1);
  });
});

describe('validarQuimicos (asignación)', () => {
  const fila = { articuloId: 'a-1', bodegaId: 'b-1', cantidad: 5 };

  it('sin químicos no pide nada; con químicos pide el documento de mezcla', () => {
    expect(validarQuimicos([], false)).toBeNull();
    expect(validarQuimicos([fila], false)).toContain('documento de mezcla');
    expect(validarQuimicos([fila], true)).toBeNull();
  });

  it('cada fila necesita químico, bodega y cantidad; no se repite el mismo químico en la misma bodega', () => {
    expect(validarQuimicos([{ ...fila, articuloId: null }], true)).toContain('químico');
    expect(validarQuimicos([{ ...fila, bodegaId: null }], true)).toContain('bodega');
    expect(validarQuimicos([{ ...fila, cantidad: null }], true)).toContain('cantidad');
    expect(validarQuimicos([{ ...fila, cantidad: 0 }], true)).toContain('cantidad');
    expect(validarQuimicos([fila, fila], true)).toContain('repetirse');
    expect(validarQuimicos([fila, { ...fila, bodegaId: 'b-2' }], true)).toBeNull();
  });
});

describe('validarMovimientoQuimicos (consumo y devolución)', () => {
  const fila = { articuloId: 'a-1', pendiente: 4, cantidad: null as number | null, bodegaId: null as string | null };

  it('pide al menos una cantidad y no deja pasar de lo que el ticket tiene a su cargo', () => {
    expect(validarMovimientoQuimicos([fila], false)).toContain('al menos');
    expect(validarMovimientoQuimicos([{ ...fila, cantidad: 5 }], false)).toContain('a su cargo');
    expect(validarMovimientoQuimicos([{ ...fila, cantidad: -1 }], false)).toContain('negativas');
    expect(validarMovimientoQuimicos([{ ...fila, cantidad: 4 }], false)).toBeNull();
  });

  it('la devolución exige la bodega de cada químico que se devuelve; las filas sin cantidad no cuentan', () => {
    expect(validarMovimientoQuimicos([{ ...fila, cantidad: 2 }], true)).toContain('bodega');
    expect(validarMovimientoQuimicos([{ ...fila, cantidad: 2, bodegaId: 'b-1' }, { ...fila, articuloId: 'a-2' }], true)).toBeNull();
  });
});
