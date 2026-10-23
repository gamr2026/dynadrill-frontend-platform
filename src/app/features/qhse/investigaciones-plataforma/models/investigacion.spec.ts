import { describe, expect, it } from 'vitest';
import {
  causasDe,
  conPlazoVencido,
  decimalNoNegativo,
  diaDeIso,
  diasParaInformeFinal,
  enteroNoNegativo,
  esEditable,
  horaDeBackend,
  numeroATexto,
  textoDePlazo,
  type CausaFormato,
  type PlazosInvestigacion,
} from './investigacion';

const plazos = (parcial: Partial<PlazosInvestigacion> = {}): PlazosInvestigacion => ({
  inicioLimite: '2026-10-01T10:00:00.000Z',
  inicioVencido: false,
  preliminarLimite: null,
  finalLimite: '2026-10-31T10:00:00.000Z',
  finalVencido: false,
  ...parcial,
});

describe('Investigaciones: reglas de pantalla', () => {
  it('solo se llena con la investigación abierta o en investigación', () => {
    expect(esEditable('abierta')).toBe(true);
    expect(esEditable('en_investigacion')).toBe(true);
    expect(esEditable('en_revision')).toBe(false);
    expect(esEditable('cerrada')).toBe(false);
  });

  it('el plazo vencido cuenta el informe vencido, o el inicio vencido solo si sigue sin iniciarse', () => {
    expect(conPlazoVencido({ estado: 'abierta', plazos: plazos({ inicioVencido: true }) })).toBe(
      true,
    );
    // ya iniciada tarde: el inicio vencido es historia, no un plazo que corra
    expect(
      conPlazoVencido({ estado: 'en_investigacion', plazos: plazos({ inicioVencido: true }) }),
    ).toBe(false);
    expect(
      conPlazoVencido({ estado: 'en_investigacion', plazos: plazos({ finalVencido: true }) }),
    ).toBe(true);
    expect(conPlazoVencido({ estado: 'cerrada', plazos: plazos({ finalVencido: true }) })).toBe(
      false,
    );
  });

  it('el texto del plazo: cerrada, vencido o los días que quedan', () => {
    const ahora = new Date('2026-10-21T10:00:00.000Z');
    expect(textoDePlazo({ estado: 'cerrada', plazos: plazos() }, ahora)).toBe('Cerrada');
    expect(
      textoDePlazo({ estado: 'en_investigacion', plazos: plazos({ finalVencido: true }) }, ahora),
    ).toBe('Plazo vencido');
    expect(textoDePlazo({ estado: 'en_investigacion', plazos: plazos() }, ahora)).toBe(
      '10 días restantes',
    );
    expect(diasParaInformeFinal({ estado: 'cerrada', plazos: plazos() }, ahora)).toBeNull();
    expect(
      diasParaInformeFinal(
        { estado: 'abierta', plazos: plazos({ finalLimite: '2026-10-20T00:00:00.000Z' }) },
        ahora,
      ),
    ).toBe(0);
  });

  it('la hora y los días que devuelve el backend se muestran en el formato de los campos', () => {
    expect(horaDeBackend('1970-01-01T06:30:00.000Z')).toBe('06:30');
    expect(horaDeBackend(null)).toBe('');
    expect(diaDeIso('2026-10-20T00:00:00.000Z')).toBe('2026-10-20');
    expect(diaDeIso(undefined)).toBe('');
    expect(numeroATexto('4.50')).toBe('4.50');
    expect(numeroATexto(12)).toBe('12');
    expect(numeroATexto(null)).toBe('');
  });

  it('enteros y decimales no negativos: vacío no se envía, válido se convierte, inválido se rechaza', () => {
    expect(enteroNoNegativo('')).toBeUndefined();
    expect(enteroNoNegativo('12')).toBe(12);
    expect(enteroNoNegativo('0')).toBe(0);
    expect(enteroNoNegativo('-1')).toBeNull();
    expect(enteroNoNegativo('2.5')).toBeNull();
    expect(enteroNoNegativo('abc')).toBeNull();
    expect(decimalNoNegativo('')).toBeUndefined();
    expect(decimalNoNegativo('1500,5')).toBe(1500.5);
    expect(decimalNoNegativo('-3')).toBeNull();
    expect(decimalNoNegativo('mucho')).toBeNull();
  });

  it('las causas de un tipo salen en su orden', () => {
    const causas: CausaFormato[] = [
      { tipo: 'acto_inseguro', orden: 2, descripcion: 'segundo' },
      { tipo: 'condicion_insegura', orden: 1, descripcion: 'otra' },
      { tipo: 'acto_inseguro', orden: 1, descripcion: 'primero' },
    ];
    expect(causasDe(causas, 'acto_inseguro').map((c) => c.descripcion)).toEqual([
      'primero',
      'segundo',
    ]);
    expect(causasDe(causas, 'fuente_gestion')).toEqual([]);
  });
});
