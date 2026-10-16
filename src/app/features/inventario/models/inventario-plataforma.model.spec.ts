import { formatearCantidad, mensajeErrorInventario } from './inventario-plataforma.model';

describe('mensajeErrorInventario', () => {
  it('muestra el detalle que manda el servidor (p. ej. stock insuficiente)', () => {
    expect(mensajeErrorInventario({ status: 409, error: { detail: 'Stock insuficiente: hay 5 en la bodega y se piden 8' } }, 'x')).toBe(
      'Stock insuficiente: hay 5 en la bodega y se piden 8',
    );
  });

  it('junta los errores de validación', () => {
    expect(mensajeErrorInventario({ status: 400, error: { message: ['a', 'b'] } }, 'x')).toBe('a. b');
  });

  it('explica el 403 y no muestra el texto de un error del servidor', () => {
    expect(mensajeErrorInventario({ status: 403, error: {} }, 'x')).toBe('No tiene permiso para esta acción.');
    expect(mensajeErrorInventario({ status: 500, error: { detail: 'Error interno: stack' } }, 'No se pudo guardar')).toBe('No se pudo guardar');
    expect(mensajeErrorInventario(null, 'No se pudo guardar')).toBe('No se pudo guardar');
  });
});

describe('formatearCantidad', () => {
  it('muestra hasta tres decimales', () => {
    expect(formatearCantidad(1.5)).toBe('1,5');
    expect(formatearCantidad(12)).toBe('12');
    expect(formatearCantidad(0.125)).toBe('0,125');
  });
});
