import { CABECERA_PLANTILLA_AS2, MAX_FILAS_PLANTILLA, aNumero, leerFilasPlantillaAs2 } from './plantilla-as2.util';

const cabecera = [CABECERA_PLANTILLA_AS2, 'Unidad', 'Cantidad', 'Descripción', 'Precio', 'Descuento'];

describe('aNumero', () => {
  it('entiende los formatos de número habituales', () => {
    expect(aNumero('12')).toBe(12);
    expect(aNumero('12,5')).toBe(12.5);
    expect(aNumero('1,500.50')).toBe(1500.5);
    expect(aNumero('1.500,50')).toBe(1500.5);
    expect(aNumero('$ 20.00')).toBe(20);
    expect(aNumero(7)).toBe(7);
  });

  it('devuelve null si no es un número', () => {
    expect(aNumero('')).toBeNull();
    expect(aNumero('abc')).toBeNull();
    expect(aNumero(undefined)).toBeNull();
  });
});

describe('leerFilasPlantillaAs2', () => {
  it('lee código, cantidad, precio y descuento debajo de la cabecera', () => {
    const r = leerFilasPlantillaAs2([['Pedido cliente'], [], cabecera, ['SRV-1', 'DIA', '3', 'Servicio uno', '100.00', '5'], ['MAT-2', 'UN', '', 'Material dos', '', '']]);
    expect(r.error).toBeNull();
    expect(r.filas).toEqual([
      { codigo: 'SRV-1', cantidad: 3, precio: 100, descuentoPct: 5 },
      { codigo: 'MAT-2', cantidad: 1 },
    ]);
  });

  it('la primera fila sin código cierra los datos', () => {
    const r = leerFilasPlantillaAs2([cabecera, ['A', 'U', '1'], ['', '', ''], ['B', 'U', '1']]);
    expect(r.filas.map(f => f.codigo)).toEqual(['A']);
  });

  it('avisa si no es la plantilla de AS2', () => {
    const r = leerFilasPlantillaAs2([['otra cosa'], ['A', 'U', '1']]);
    expect(r.error).toMatch(/Codigo Producto AS2/);
    expect(r.filas).toEqual([]);
  });

  it('avisa si no hay líneas', () => {
    expect(leerFilasPlantillaAs2([cabecera]).error).toMatch(/ninguna línea/);
  });

  it('separa las filas con cantidad ilegible o no positiva', () => {
    const r = leerFilasPlantillaAs2([cabecera, ['A', 'U', 'mucho'], ['B', 'U', '0'], ['C', 'U', '2']]);
    expect(r.filas.map(f => f.codigo)).toEqual(['C']);
    expect(r.ilegibles.map(i => i.codigo)).toEqual(['A', 'B']);
    expect(r.error).toBeNull();
  });

  it('descarta un descuento fuera de 0-100 en vez de enviarlo', () => {
    const r = leerFilasPlantillaAs2([cabecera, ['A', 'U', '1', '', '10', '150']]);
    expect(r.filas[0]).toEqual({ codigo: 'A', cantidad: 1, precio: 10 });
  });

  it('rechaza más filas de las que acepta el backend', () => {
    const filas = Array.from({ length: MAX_FILAS_PLANTILLA + 1 }, (_, i) => [`C${i}`, 'U', '1']);
    expect(leerFilasPlantillaAs2([cabecera, ...filas]).error).toMatch(/máximo/);
  });
});
