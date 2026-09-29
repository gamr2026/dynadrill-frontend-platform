import { pageWindow } from './pagination.util';

describe('pageWindow', () => {
  it('muestra todas las páginas cuando son pocas', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('abrevia con "…" alrededor de la página actual', () => {
    expect(pageWindow(1, 50)).toEqual([1, 2, 'ellipsis', 50]);
    expect(pageWindow(25, 50)).toEqual([1, 'ellipsis', 24, 25, 26, 'ellipsis', 50]);
    expect(pageWindow(50, 50)).toEqual([1, 'ellipsis', 49, 50]);
  });

  it('no pone "…" para tapar una sola página', () => {
    expect(pageWindow(4, 50)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 50]);
  });

  it('sin páginas no devuelve nada', () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });
});
