import { pestanasVisibles } from './pedidos-comercial-list-page';

describe('pestanasVisibles', () => {
  it('sin permisos extra solo muestra Todos los pedidos', () => {
    expect(pestanasVisibles(() => false).map((p) => p.clave)).toEqual(['pedidos']);
  });

  it('"Por completar" exige poder leer pedidos de AS2', () => {
    const can = (p: string) => p === 'integraciones.as2_pedidos.ver';
    expect(pestanasVisibles(can).map((p) => p.clave)).toEqual(['pedidos', 'por-completar']);
  });

  it('no hay pestaña de "Sin analista" y los nombres son claros', () => {
    expect(pestanasVisibles(() => true).map((p) => p.label)).toEqual([
      'Todos los pedidos',
      'Pedidos de AS2 por completar',
    ]);
  });
});
