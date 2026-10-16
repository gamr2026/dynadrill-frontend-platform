import { describe, expect, it, vi } from 'vitest';
import { aItemCampana, type AvisoApi } from './avisos-feeder.service';

const aviso: AvisoApi = {
  id: 'a1',
  titulo: 'Nuevo pedido de Pumping: PED-004999',
  detalle: 'EP PETROECUADOR · Pozo ESTACION NORTE 2 — pendiente de revisión inicial',
  enlace: '/modulos/operativo/pumping/pedidos/tk-1',
  tono: 'warning',
  creadoAt: '2026-11-02T10:00:00Z',
};

describe('campanita: avisos del servidor', () => {
  it('convierte el aviso en un ítem de la campana, con su enlace y su tono', () => {
    const item = aItemCampana(aviso);
    expect(item).toMatchObject({
      id: 'aviso-a1',
      title: 'Nuevo pedido de Pumping: PED-004999',
      description: 'EP PETROECUADOR · Pozo ESTACION NORTE 2 — pendiente de revisión inicial',
      tone: 'warning',
      link: '/modulos/operativo/pumping/pedidos/tk-1',
    });
  });

  it('un aviso sin detalle ni enlace no inventa nada', () => {
    const item = aItemCampana({ ...aviso, detalle: null, enlace: null, tono: 'info' });
    expect(item.description).toBeUndefined();
    expect(item.link).toBeUndefined();
    expect(item.tone).toBe('info');
    expect('alAbrir' in item).toBe(false);
  });

  it('al abrirlo se ejecuta la acción de marcarlo como leído', () => {
    const marcar = vi.fn();
    const item = aItemCampana(aviso, marcar);
    item.alAbrir?.();
    expect(marcar).toHaveBeenCalledTimes(1);
  });
});
