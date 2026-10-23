import {
  estadoDeVerificacion,
  huellaCorta,
  ordenarEvidencia,
  sePuedeVerificar,
  type FirmaEvidencia,
  type VerificacionFirma,
} from './firmas.model';

const firma = (p: Partial<FirmaEvidencia> = {}): FirmaEvidencia => ({
  id: 'f',
  rolFirmante: { codigo: 'trabajador', descripcion: 'Trabajador' },
  firmante: { id: 'u', nombre: 'Ana' },
  firmadaAt: '2026-10-22T10:00:00.000Z',
  metodo: 'linea',
  vigente: true,
  hashDocumento: 'a'.repeat(64),
  archivo: null,
  verificacion: null,
  ...p,
});
const lectura = (p: Partial<VerificacionFirma>): VerificacionFirma => ({
  id: 'v',
  resultado: 'firma_detectada',
  confianza: 0.9,
  nombreCoincide: null,
  verificadaAt: '2026-10-22T11:00:00.000Z',
  solicitadaPor: { id: 'u', nombre: 'Ana' },
  ...p,
});

describe('evidencia de firmas', () => {
  it('sin lectura la firma queda «sin verificar»', () => {
    expect(estadoDeVerificacion(null)).toEqual({ texto: 'Sin verificar', tono: 'neutral' });
  });

  it('una lectura con firma detectada es correcta salvo que el nombre no coincida', () => {
    expect(estadoDeVerificacion(lectura({}))).toEqual({
      texto: 'Firma detectada',
      tono: 'success',
    });
    expect(estadoDeVerificacion(lectura({ nombreCoincide: true })).tono).toBe('success');
    expect(estadoDeVerificacion(lectura({ nombreCoincide: false }))).toEqual({
      texto: 'Firma detectada, el nombre no coincide',
      tono: 'warning',
    });
  });

  it('una lectura sin firma o no concluyente pide revisar', () => {
    expect(estadoDeVerificacion(lectura({ resultado: 'firma_no_detectada' }))).toEqual({
      texto: 'No se detectó firma',
      tono: 'warning',
    });
    expect(estadoDeVerificacion(lectura({ resultado: 'no_concluyente' }))).toEqual({
      texto: 'No concluyente',
      tono: 'warning',
    });
  });

  it('las vigentes van primero y cada grupo del más reciente al más antiguo', () => {
    const lista = [
      firma({ id: 'vieja', vigente: false, firmadaAt: '2026-10-20T10:00:00.000Z' }),
      firma({ id: 'a', vigente: true, firmadaAt: '2026-10-21T10:00:00.000Z' }),
      firma({ id: 'b', vigente: true, firmadaAt: '2026-10-22T10:00:00.000Z' }),
      firma({ id: 'antes', vigente: false, firmadaAt: '2026-10-21T08:00:00.000Z' }),
    ];
    expect(ordenarEvidencia(lista).map((f) => f.id)).toEqual(['b', 'a', 'antes', 'vieja']);
    expect(lista[0].id).toBe('vieja');
  });

  it('acorta la huella sin perder los extremos', () => {
    expect(huellaCorta('0123456789abcdef0123456789abcdef')).toBe('01234567…89abcdef');
    expect(huellaCorta('abc')).toBe('abc');
  });

  it('solo se verifica la firma manuscrita con su archivo', () => {
    const archivo = { id: 'a', nombre: 'x.pdf', sha256: 'b'.repeat(64) };
    expect(sePuedeVerificar(firma())).toBe(false);
    expect(sePuedeVerificar(firma({ metodo: 'electronica', archivo, hashDocumento: null }))).toBe(
      false,
    );
    expect(sePuedeVerificar(firma({ metodo: 'manuscrita', archivo, hashDocumento: null }))).toBe(
      true,
    );
  });
});
