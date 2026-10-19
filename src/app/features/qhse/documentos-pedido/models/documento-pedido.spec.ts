import { describe, expect, it } from 'vitest';
import {
  exigeFecha,
  exigeMotivoSuplencia,
  fechaIso,
  insigniaArt,
  insigniaDocumento,
  pendientesDeCarga,
  type ArtVigente,
} from './documento-pedido';

const art = (extra: Partial<ArtVigente>): ArtVigente => ({
  id: 'a',
  archivoId: 'f',
  emitidoEl: '2026-11-01',
  vigenteHasta: '2026-11-16',
  venceEnDias: 10,
  vencido: false,
  porVencer: false,
  ...extra,
});

describe('documentos por pedido: reglas de pantalla', () => {
  it('un documento está cargado o pendiente', () => {
    expect(insigniaDocumento({ id: 'd', archivoId: 'f' })).toEqual({
      text: 'Cargado',
      tone: 'success',
    });
    expect(insigniaDocumento(null)).toEqual({ text: 'Pendiente', tone: 'warning' });
  });

  it('el ART avisa 3 días antes de vencer y marca el vencido', () => {
    expect(insigniaArt(null)).toEqual({ text: 'Sin ART', tone: 'neutral' });
    expect(insigniaArt(art({}))).toEqual({ text: 'Vigente (10 días)', tone: 'success' });
    expect(insigniaArt(art({ venceEnDias: 3, porVencer: true }))).toEqual({
      text: 'Vence en 3 días',
      tone: 'warning',
    });
    expect(insigniaArt(art({ venceEnDias: 1, porVencer: true })).text).toBe('Vence en 1 día');
    expect(insigniaArt(art({ venceEnDias: 0, porVencer: true })).text).toBe('Vence hoy');
    expect(insigniaArt(art({ venceEnDias: -2, vencido: true }))).toEqual({
      text: 'Vencido',
      tone: 'error',
    });
  });

  it('la fecha enviada es la del día local, con ceros a la izquierda', () => {
    expect(fechaIso(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05');
    expect(fechaIso(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('solo el ART y el PT piden fecha', () => {
    expect(exigeFecha('art')).toBe(true);
    expect(exigeFecha('pt')).toBe(true);
    expect(exigeFecha('sfi')).toBe(false);
    expect(exigeFecha('formato_recepcion')).toBe(false);
  });

  it('dice qué falta para cargar', () => {
    const archivo = new File(['x'], 'a.pdf');
    expect(pendientesDeCarga({ tipo: null, fecha: null, archivo: null })).toEqual([
      'elegir el tipo de documento',
      'elegir el archivo',
    ]);
    expect(pendientesDeCarga({ tipo: 'art', fecha: null, archivo })).toEqual([
      'indicar la fecha de emisión',
    ]);
    expect(pendientesDeCarga({ tipo: 'pt', fecha: null, archivo })).toEqual([
      'indicar el día de operación',
    ]);
    expect(pendientesDeCarga({ tipo: 'sfi', fecha: null, archivo })).toEqual([]);
    expect(pendientesDeCarga({ tipo: 'art', fecha: new Date(), archivo })).toEqual([]);
  });

  it('quien sube el Acta sin ser el supervisor asignado debe dar un motivo', () => {
    expect(exigeMotivoSuplencia('sup-1', 'sup-1')).toBe(false);
    expect(exigeMotivoSuplencia('sup-1', 'otro')).toBe(true);
    expect(exigeMotivoSuplencia(null, 'otro')).toBe(false);
  });
});
