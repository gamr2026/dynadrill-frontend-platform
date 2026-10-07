import type { FcrActivityLogEntry, FcrDiaBitacoraEnviado } from './fcr.model';
import { agruparBitacoraPorDia, estadoDiaBitacora } from './fcr-bitacora-dias';

function entrada(id: number, date: string, startTime: string, durationHours: number): FcrActivityLogEntry {
  return { id, date, startTime, endTime: '23:00', durationHours, detail: `Actividad ${id}`, author: 'Operador' };
}

describe('agruparBitacoraPorDia', () => {
  it('agrupa por fecha en orden ascendente y ordena las actividades por hora de inicio', () => {
    const dias = agruparBitacoraPorDia(
      [entrada(1, '2026-10-06', '14:00', 2), entrada(2, '2026-10-05', '08:00', 1), entrada(3, '2026-10-06', '08:00', 3)],
      [],
    );
    expect(dias.map(d => d.fecha)).toEqual(['2026-10-05', '2026-10-06']);
    expect(dias[1].actividades.map(a => a.id)).toEqual([3, 1]);
  });

  it('suma las horas del día redondeando a 2 decimales', () => {
    const [dia] = agruparBitacoraPorDia([entrada(1, '2026-10-06', '08:00', 1.25), entrada(2, '2026-10-06', '10:00', 0.1)], []);
    expect(dia.totalHoras).toBe(1.35);
  });

  it('marca como pendiente el día que no está en la lista de enviados', () => {
    const [dia] = agruparBitacoraPorDia([entrada(1, '2026-10-06', '08:00', 1)], []);
    expect(dia.envio).toBeNull();
  });

  it('adjunta el registro de envío al día ya enviado', () => {
    const envio: FcrDiaBitacoraEnviado = { fecha: '2026-10-06', enviadoAt: '2026-10-06T20:00:00.000Z', enviadoPor: 'op@dynadrill.com' };
    const [dia] = agruparBitacoraPorDia([entrada(1, '2026-10-06', '08:00', 1)], [envio]);
    expect(dia.envio).toEqual(envio);
  });

  it('devuelve lista vacía sin actividades', () => {
    expect(agruparBitacoraPorDia([], [])).toEqual([]);
  });
});

describe('estadoDiaBitacora', () => {
  const enviado: FcrDiaBitacoraEnviado = { fecha: '2026-10-06', enviadoAt: '2026-10-06T20:00:00.000Z', enviadoPor: 'op@dynadrill.com' };

  it('pendiente cuando el día no fue enviado', () => {
    expect(estadoDiaBitacora(null)).toBe('pendiente');
  });

  it('enviado cuando nadie lo corrigió', () => {
    expect(estadoDiaBitacora(enviado)).toBe('enviado');
  });

  it('enviado cuando lo corrigió el propio operador', () => {
    expect(estadoDiaBitacora({ ...enviado, modificadoRol: 'Operador', modificadoAt: '2026-10-07T10:00:00.000Z' })).toBe('enviado');
  });

  it('corregido_facturacion cuando la última corrección fue de Facturación', () => {
    expect(estadoDiaBitacora({ ...enviado, modificadoRol: 'Facturación', modificadoAt: '2026-10-07T10:00:00.000Z' })).toBe(
      'corregido_facturacion',
    );
  });
});
