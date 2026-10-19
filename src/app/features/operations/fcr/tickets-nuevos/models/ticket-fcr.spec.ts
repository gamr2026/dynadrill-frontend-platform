import { describe, expect, it } from 'vitest';
import {
  FIRMAS,
  duracionHoras,
  etiquetaRoles,
  faltaParaFirmar,
  fechaEnServicio,
  inspeccionEditable,
  mensajeErrorTicket,
  pendientesDelPaso,
  puedeFirmar,
  resumenHerramientas,
  siguienteFirma,
  validarActividades,
  validarAsignacion,
  validarLlegada,
  validarPicker,
  type FirmaInspeccion,
  type HerramientaTicket,
  type RequisitoTicket,
  type RolFirma,
} from './ticket-fcr';

const requisito = (paso: string, estado: RequisitoTicket['estado']): RequisitoTicket => ({
  id: paso + estado,
  codigo: 'x',
  nombre: 'x',
  descripcion: null,
  modulo: 'fcr',
  ambito: 'ticket',
  paso,
  para: null,
  vehiculoId: null,
  usuarioId: null,
  estado,
  cumplidoAt: null,
  origen: null,
  motivo: null,
});

const firma = {} as FirmaInspeccion;
const sinFirmas = (): Record<RolFirma, FirmaInspeccion | null> => ({
  reparado_por: null,
  revisado_por: null,
  liberado_qhse: null,
});

describe('tickets de FCR (modelo)', () => {
  it('solo cuenta los requisitos pendientes del paso actual', () => {
    const t = {
      paso: {
        codigo: 'preparacion_herramientas',
        nombre: '',
        macro: 'en_proceso' as const,
        roles: [],
      },
      requisitos: [
        requisito('preparacion_herramientas', 'pendiente'),
        requisito('preparacion_herramientas', 'cumplido'),
        requisito('asignacion', 'pendiente'),
      ],
    };
    expect(pendientesDelPaso(t)).toHaveLength(1);
  });

  it('une los roles con su nombre', () => {
    expect(etiquetaRoles(['supervisor', 'rol_raro'])).toContain('rol_raro');
  });

  it('prefiere el texto del backend y cae al por defecto sin respuesta', () => {
    expect(mensajeErrorTicket({ status: 500 }, 'Falló')).toBe('Falló');
    expect(mensajeErrorTicket({ status: 403 }, 'Falló')).toContain('otro rol');
    expect(mensajeErrorTicket({ status: 409 }, 'Falló')).toContain('cambió');
  });

  it('las firmas de la inspección van en orden y la cabecera se bloquea al firmar «reparado por»', () => {
    expect(FIRMAS).toEqual(['reparado_por', 'revisado_por', 'liberado_qhse']);
    const f = sinFirmas();
    expect(siguienteFirma(f)).toBe('reparado_por');
    f.reparado_por = firma;
    expect(siguienteFirma(f)).toBe('revisado_por');
    f.revisado_por = firma;
    f.liberado_qhse = firma;
    expect(siguienteFirma(f)).toBeNull();
    expect(inspeccionEditable({ estado: 'borrador', firmas: sinFirmas() })).toBe(true);
    expect(
      inspeccionEditable({ estado: 'borrador', firmas: { ...sinFirmas(), reparado_por: firma } }),
    ).toBe(false);
    expect(inspeccionEditable({ estado: 'enviada', firmas: sinFirmas() })).toBe(false);
  });

  it('exige quién inspeccionó y quién reparó antes de firmar', () => {
    expect(faltaParaFirmar({ inspeccionadoPor: null, reparadoPor: 'dynadrill' })).not.toBeNull();
    expect(
      faltaParaFirmar({ inspeccionadoPor: 'dynadrill', reparadoPor: 'proveedor_externo' }),
    ).toBeNull();
    expect(puedeFirmar('liberado_qhse', undefined)).toBe(false);
  });

  it('cuenta las herramientas por estado', () => {
    const l = [
      { estado: 'recibida' },
      { estado: 'recibida' },
      { estado: 'devuelta' },
    ] as HerramientaTicket[];
    expect(resumenHerramientas(l).find((r) => r.estado === 'recibida')?.cantidad).toBe(2);
    expect(resumenHerramientas(l)).toHaveLength(2);
  });

  it('calcula las horas de una actividad, también cuando cruza la medianoche', () => {
    expect(duracionHoras('08:00', '10:30')).toBe(2.5);
    expect(duracionHoras('22:00', '02:00')).toBe(4);
  });

  it('valida las actividades de la bitácora', () => {
    expect(
      validarActividades([{ horaInicio: '08:00', horaFin: '09:00', detalle: 'Bajada' }]),
    ).toBeNull();
    expect(validarActividades([{ horaInicio: '8', horaFin: '09:00', detalle: 'x' }])).toContain(
      'HH:mm',
    );
    expect(validarActividades([{ horaInicio: '08:00', horaFin: '08:00', detalle: 'x' }])).toContain(
      'misma hora',
    );
    expect(validarActividades([{ horaInicio: '08:00', horaFin: '09:00', detalle: ' ' }])).toContain(
      'detalle',
    );
  });

  it('el día debe caer dentro de las fechas del servicio', () => {
    const s = { desde: '2026-10-10', hasta: '2026-10-20' };
    expect(fechaEnServicio('2026-10-15', s)).toBe(true);
    expect(fechaEnServicio('2026-10-09', s)).toBe(false);
    expect(fechaEnServicio('2026-10-21', s)).toBe(false);
    expect(fechaEnServicio('15/10/2026', s)).toBe(false);
    expect(fechaEnServicio('2026-10-15', { desde: null, hasta: null })).toBe(true);
  });

  it('el picker pide completación en venta y tipo de trabajo en servicios', () => {
    const ok = { tipoPickerId: 'p', presion: 100, peso: 5 };
    expect(validarPicker('venta', { ...ok })).toContain('completación');
    expect(validarPicker('servicio', { ...ok })).toContain('trabajo');
    expect(validarPicker('venta', { ...ok, tipoCompletacionId: 'c' })).toBeNull();
    expect(validarPicker('servicio', { ...ok, tipoTrabajoId: 't', presion: -1 })).toContain(
      'presión',
    );
  });

  it('el reporte de llegada exige día y combustible, y el detalle si se interrumpió', () => {
    expect(validarLlegada({ fecha: '2026-10-18', combustible: 0 })).toBeNull();
    expect(validarLlegada({ fecha: '', combustible: 1 })).toContain('día');
    expect(validarLlegada({ fecha: '2026-10-18', combustible: null })).toContain('combustible');
    expect(
      validarLlegada({ fecha: '2026-10-18', combustible: 1, operacionInterrumpida: true }),
    ).toContain('interrumpió');
  });

  it('la asignación exige supervisor, operadores y sin repetidos', () => {
    const f = (u: string | null) => ({ usuarioId: u, vehiculoId: null });
    expect(validarAsignacion(null, [f('a')], false)).toContain('supervisor');
    expect(validarAsignacion(null, [f('a')], true)).toBeNull();
    expect(validarAsignacion('s', [], false)).toContain('operador');
    expect(validarAsignacion('s', [f('a'), f('a')], false)).toContain('dos veces');
    expect(validarAsignacion('a', [f('a')], false)).toContain('también operador');
  });
});
