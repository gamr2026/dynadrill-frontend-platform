import { describe, expect, it } from 'vitest';
import {
  enteroDeTexto,
  estadoPasoCascada,
  etiquetaHospital,
  faltantes,
  pasosPendientes,
  pendientesDeCierre,
  resumenSignos,
  type EmergenciaDetalle,
  type PasoCascada,
  type SignosVitales,
} from './emergencia';

const paso = (extra: Partial<PasoCascada> = {}): PasoCascada => ({
  pasoId: 'p',
  orden: 1,
  desde: 'Supervisor',
  hacia: 'Company Man',
  plazoMinutos: 2,
  notificadoAt: null,
  notificadoPor: null,
  minutos: null,
  enPlazo: null,
  vencido: false,
  ...extra,
});

describe('Emergencias: reglas de pantalla', () => {
  it('los faltantes son las personas en la locación menos las evacuadas, nunca negativos', () => {
    expect(faltantes({ totalEnLocacion: 20, evacuados: 15 })).toBe(5);
    expect(faltantes({ totalEnLocacion: 20, evacuados: 20 })).toBe(0);
    expect(faltantes({ totalEnLocacion: 3, evacuados: 5 })).toBe(0);
  });

  it('dice qué pasos de la cascada faltan', () => {
    const e = {
      cascada: [paso({ pasoId: 'a', notificadoAt: '2026-10-24T10:00:00Z' }), paso({ pasoId: 'b' })],
    };
    expect(pasosPendientes(e).map((p) => p.pasoId)).toEqual(['b']);
  });

  it('un paso notificado informa si fue en plazo; uno sin notificar, si ya venció', () => {
    expect(estadoPasoCascada(paso({ notificadoAt: 'x', enPlazo: true, minutos: 1.5 }))).toEqual({
      texto: 'En plazo (1.5 min)',
      tono: 'success',
    });
    expect(estadoPasoCascada(paso({ notificadoAt: 'x', enPlazo: false, minutos: 7 })).tono).toBe(
      'warning',
    );
    expect(estadoPasoCascada(paso({ vencido: true })).tono).toBe('error');
    expect(estadoPasoCascada(paso())).toEqual({ texto: 'Plazo 2 min', tono: 'neutral' });
  });

  it('lista lo que falta para cerrar, en orden', () => {
    const base: Pick<
      EmergenciaDetalle,
      'estado' | 'reporteFlash' | 'nivel' | 'requiereInvestigacion' | 'investigacionAbierta'
    > = {
      estado: 'activa',
      reporteFlash: null,
      nivel: null,
      requiereInvestigacion: false,
      investigacionAbierta: null,
    };
    expect(pendientesDeCierre(base)).toEqual([
      'Marcar la emergencia como controlada',
      'Emitir el Reporte Flash',
      'Declarar el nivel de la emergencia',
    ]);
    expect(
      pendientesDeCierre({
        ...base,
        estado: 'controlada',
        nivel: { valor: 3, declaradoPor: null, declaradoAt: null },
        reporteFlash: {
          resumenEjecutivo: 'a',
          personalAfectado: 'b',
          accionesTomadas: 'c',
          estadoActual: 'd',
          proximosPasos: 'e',
          emitidoAt: 'x',
          emitidoPor: null,
          minutos: 10,
          fueraDePlazo: false,
        },
        requiereInvestigacion: true,
        investigacionAbierta: false,
      }),
    ).toEqual(['Abrir la investigación de incidentes (HSE-TRIAGE-002)']);
    // con la investigación abierta, o si el módulo no está instalado (verdadero), ya no falta nada
    expect(
      pendientesDeCierre({
        ...base,
        estado: 'controlada',
        nivel: { valor: 2, declaradoPor: null, declaradoAt: null },
        reporteFlash: {
          resumenEjecutivo: 'a',
          personalAfectado: 'b',
          accionesTomadas: 'c',
          estadoActual: 'd',
          proximosPasos: 'e',
          emitidoAt: 'x',
          emitidoPor: null,
          minutos: 10,
          fueraDePlazo: false,
        },
        requiereInvestigacion: true,
        investigacionAbierta: true,
      }),
    ).toEqual([]);
  });

  it('resume una toma de signos vitales con la presión completa', () => {
    const s = (extra: Partial<SignosVitales>): SignosVitales => ({
      registradoAt: 'x',
      registradoPor: null,
      pulso: null,
      presionSistolica: null,
      presionDiastolica: null,
      respiracion: null,
      consciencia: null,
      ...extra,
    });
    expect(
      resumenSignos(
        s({
          pulso: 90,
          presionSistolica: 120,
          presionDiastolica: 80,
          respiracion: 18,
          consciencia: 'voz',
        }),
      ),
    ).toBe('Pulso 90 · Presión 120/80 · Resp. 18 · Responde a la voz');
    expect(resumenSignos(s({ consciencia: 'inconsciente' }))).toBe('Inconsciente');
  });

  it('convierte un campo de texto en un entero solo si lo es', () => {
    expect(enteroDeTexto(' 45 ')).toBe(45);
    expect(enteroDeTexto('')).toBeUndefined();
    expect(enteroDeTexto('4.5')).toBeUndefined();
    expect(enteroDeTexto('abc')).toBeUndefined();
  });

  it('etiqueta el hospital con su ciudad', () => {
    expect(etiquetaHospital({ nombre: 'Hospital Metropolitano', ciudad: 'Quito' })).toBe(
      'Hospital Metropolitano · Quito',
    );
  });
});
