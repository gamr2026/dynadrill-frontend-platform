import { DuracionPipe } from './duracion.pipe';

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

describe('DuracionPipe', () => {
  const pipe = new DuracionPipe();

  it('la unidad crece con el tiempo: minutos, después horas y minutos', () => {
    expect(pipe.transform(30_000)).toBe('< 1 min');
    expect(pipe.transform(45 * MIN)).toBe('45 min');
    expect(pipe.transform(3 * HORA + 20 * MIN)).toBe('3 h 20 min');
    expect(pipe.transform(5 * HORA)).toBe('5 h');
  });

  it('con días de diferencia entre etapas no muestra minutos: días y horas', () => {
    expect(pipe.transform(2 * DIA + 3 * HORA + 59 * MIN)).toBe('2 d 3 h');
    expect(pipe.transform(4 * DIA + 10 * MIN)).toBe('4 d');
  });

  it('sin duración (fase sin terminar) dice "en curso"', () => {
    expect(pipe.transform(undefined)).toBe('en curso');
  });
});
