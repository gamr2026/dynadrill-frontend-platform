import { pestanasVisibles } from './pedidos-comercial-list-page';

describe('pestanasVisibles', () => {
  it('sin permisos extra solo muestra Pedidos', () => {
    expect(pestanasVisibles(() => false).map(p => p.clave)).toEqual(['pedidos']);
  });

  it('"Por completar" exige poder leer pedidos de AS2', () => {
    const can = (p: string) => p === 'integraciones.as2_pedidos.ver';
    expect(pestanasVisibles(can).map(p => p.clave)).toEqual(['pedidos', 'por-completar']);
  });

  it('la bandeja "Sin analista" exige poder asignar analista', () => {
    const can = (p: string) => p === 'comercial.pedidos.asignar_analista';
    expect(pestanasVisibles(can).map(p => p.clave)).toEqual(['pedidos', 'sin-analista']);
  });

  it('con todos los permisos muestra las tres', () => {
    expect(pestanasVisibles(() => true).map(p => p.clave)).toEqual(['pedidos', 'por-completar', 'sin-analista']);
  });
});
