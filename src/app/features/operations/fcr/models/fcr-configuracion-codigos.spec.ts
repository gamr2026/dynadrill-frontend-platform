import type { CodigoClienteFcr } from './fcr-configuracion-codigos';
import { errorDelKit, filtrarCodigos, resumenKit } from './fcr-configuracion-codigos';

function fila(codigo: string, parcial: Partial<CodigoClienteFcr> = {}): CodigoClienteFcr {
  return {
    codigo,
    descripcion: `Descripción ${codigo}`,
    unidad: 'día',
    enListaPrecios: true,
    id: null,
    clase: null,
    kit: [],
    ...parcial,
  };
}

describe('filtrarCodigos', () => {
  const filas = [
    fila('SH1101', { id: 1, clase: 'herramienta', descripcion: 'Sarta de limpieza' }),
    fila('SFS6146', { id: 2, clase: 'servicio' }),
    fila('SFS6057'),
    fila('VIEJO', { id: 3, clase: 'servicio', enListaPrecios: false }),
  ];
  const codigos = (r: CodigoClienteFcr[]) => r.map((f) => f.codigo);

  it('"todos" no filtra', () => {
    expect(codigos(filtrarCodigos(filas, 'todos', ''))).toEqual([
      'SH1101',
      'SFS6146',
      'SFS6057',
      'VIEJO',
    ]);
  });

  it('filtra por clase, sin configurar y huérfanos', () => {
    expect(codigos(filtrarCodigos(filas, 'herramienta', ''))).toEqual(['SH1101']);
    expect(codigos(filtrarCodigos(filas, 'sin_configurar', ''))).toEqual(['SFS6057']);
    expect(codigos(filtrarCodigos(filas, 'huerfanos', ''))).toEqual(['VIEJO']);
  });

  it('busca por código o descripción sin distinguir mayúsculas', () => {
    expect(codigos(filtrarCodigos(filas, 'todos', 'sarta'))).toEqual(['SH1101']);
    expect(codigos(filtrarCodigos(filas, 'todos', ' sfs6 '))).toEqual(['SFS6146', 'SFS6057']);
  });
});

describe('resumenKit', () => {
  const nombres = new Map([
    [10, 'Casing scraper 7"'],
    [11, 'Cepillo'],
  ]);

  it('lista nombre y cantidad de cada herramienta', () => {
    expect(
      resumenKit(
        [
          { articuloId: 10, cantidad: 1 },
          { articuloId: 11, cantidad: 2 },
        ],
        nombres,
      ),
    ).toBe('Casing scraper 7" ×1 · Cepillo ×2');
  });

  it('marca un artículo que ya no está en el catálogo activo', () => {
    expect(resumenKit([{ articuloId: 99, cantidad: 1 }], nombres)).toBe(
      'Artículo #99 (inactivo) ×1',
    );
  });
});

describe('errorDelKit', () => {
  it('acepta un kit vacío o válido', () => {
    expect(errorDelKit([])).toBeNull();
    expect(errorDelKit([{ articuloId: 10, cantidad: 2 }])).toBeNull();
  });

  it('pide elegir la herramienta de cada fila', () => {
    expect(errorDelKit([{ articuloId: null, cantidad: 1 }])).toBe(
      'Elija la herramienta de cada fila.',
    );
  });

  it('exige cantidades enteras de 1 o más', () => {
    expect(errorDelKit([{ articuloId: 10, cantidad: 0 }])).toBe(
      'La cantidad debe ser un número entero de 1 o más.',
    );
    expect(errorDelKit([{ articuloId: 10, cantidad: 1.5 }])).toBe(
      'La cantidad debe ser un número entero de 1 o más.',
    );
  });

  it('no permite la misma herramienta dos veces', () => {
    expect(
      errorDelKit([
        { articuloId: 10, cantidad: 1 },
        { articuloId: 10, cantidad: 1 },
      ]),
    ).toBe('Una herramienta aparece dos veces: use una sola fila con la cantidad total.');
  });
});
