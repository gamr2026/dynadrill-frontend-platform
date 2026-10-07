import { parseLocalDateString, toLocalDateString } from './date.util';

describe('toLocalDateString', () => {
  it('usa el día LOCAL: de noche no salta al día siguiente (toISOString es UTC y en Ecuador, UTC-5, sí saltaba)', () => {
    expect(toLocalDateString(new Date(2026, 9, 7, 23, 30))).toBe('2026-10-07');
    expect(toLocalDateString(new Date(2026, 9, 7, 0, 5))).toBe('2026-10-07');
  });

  it('ida y vuelta con parseLocalDateString conserva el día', () => {
    expect(toLocalDateString(parseLocalDateString('2026-01-31'))).toBe('2026-01-31');
  });
});
