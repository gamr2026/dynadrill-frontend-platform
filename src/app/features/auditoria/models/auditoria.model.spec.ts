import {
  FILTROS_VACIOS,
  datosLegibles,
  errorDeFiltros,
  etiquetaEvento,
  etiquetaOrigen,
  etiquetaSujeto,
  hayFiltros,
  humanizar,
  paramsDeBusqueda,
  resumenPagina,
  type FiltrosAuditoria,
} from './auditoria.model';

const filtros = (p: Partial<FiltrosAuditoria> = {}): FiltrosAuditoria => ({
  ...FILTROS_VACIOS,
  ...p,
});
const UUID = '0197aa52-1111-7222-8333-944455556666';

describe('auditoría: filtros', () => {
  it('sin filtros no hay nada que limpiar y solo viaja la paginación', () => {
    expect(hayFiltros(filtros())).toBe(false);
    expect(paramsDeBusqueda(filtros(), 2, 25)).toEqual({ pagina: '2', limite: '25' });
  });

  it('cada filtro lleno viaja con el nombre que espera el backend', () => {
    const f = filtros({
      actorId: UUID,
      tipo: 'operaciones.pumping.ticket_creado',
      origen: 'operaciones',
      sujetoTipo: 'pedido',
      sujetoId: ` ${UUID} `,
      clave: 'pedido_codigo',
      valor: ' PED-1 ',
    });
    expect(hayFiltros(f)).toBe(true);
    expect(paramsDeBusqueda(f, 1)).toEqual({
      pagina: '1',
      limite: '25',
      actorId: UUID,
      tipo: 'operaciones.pumping.ticket_creado',
      origen: 'operaciones',
      sujetoTipo: 'pedido',
      sujetoId: UUID,
      clave: 'pedido_codigo',
      valor: 'PED-1',
    });
  });

  it('«hasta» incluye todo el día elegido', () => {
    const p = paramsDeBusqueda(filtros({ desde: '2026-10-20', hasta: '2026-10-20' }), 1);
    expect(new Date(p['hasta']).getTime() - new Date(p['desde']).getTime()).toBe(
      24 * 3600 * 1000 - 1,
    );
  });

  it('avisa lo que falta o sobra, con «usted»', () => {
    expect(errorDeFiltros(filtros())).toBeNull();
    expect(errorDeFiltros(filtros({ sujetoTipo: 'pedido' }))).toMatch(/tipo y su identificador/);
    expect(errorDeFiltros(filtros({ sujetoId: UUID }))).toMatch(/tipo y su identificador/);
    expect(errorDeFiltros(filtros({ sujetoTipo: 'pedido', sujetoId: 'abc' }))).toMatch(/UUID/);
    expect(errorDeFiltros(filtros({ clave: 'pedido_codigo' }))).toMatch(/cuál y su valor/);
    expect(errorDeFiltros(filtros({ valor: 'x' }))).toMatch(/cuál y su valor/);
    expect(errorDeFiltros(filtros({ desde: '2026-10-21', hasta: '2026-10-20' }))).toMatch(
      /no puede ser posterior/,
    );
    expect(
      errorDeFiltros(
        filtros({ sujetoTipo: 'pedido', sujetoId: UUID, clave: 'pedido_id', valor: UUID }),
      ),
    ).toBeNull();
  });
});

describe('auditoría: textos', () => {
  it('humaniza los códigos y deja las siglas en mayúsculas', () => {
    expect(humanizar('ticket_creado')).toBe('Ticket creado');
    expect(humanizar('entrega_epi')).toBe('Entrega EPI');
    expect(etiquetaEvento('qhse.ptw.cerrado')).toBe('Cerrado');
    expect(etiquetaEvento('operaciones.pumping.paso_cambiado')).toBe('Paso cambiado');
    expect(etiquetaSujeto('pumping_ticket')).toBe('Pumping ticket');
    expect(etiquetaSujeto('qhse_ptw')).toBe('QHSE PTW');
  });

  it('nombra los orígenes y no inventa los que no conoce', () => {
    expect(etiquetaOrigen('qhse')).toBe('QHSE');
    expect(etiquetaOrigen('worker')).toBe('Reportería');
    expect(etiquetaOrigen('nuevo_contenedor')).toBe('Nuevo contenedor');
  });

  it('los datos salen con la descripción de su clave; una clave sin catálogo se humaniza', () => {
    expect(
      datosLegibles({ pedido_codigo: 'PED-1', unidad_nueva: 'U-7' }, [
        { codigo: 'pedido_codigo', descripcion: 'Código del pedido' },
      ]),
    ).toEqual([
      { etiqueta: 'Código del pedido', valor: 'PED-1' },
      { etiqueta: 'Unidad nueva', valor: 'U-7' },
    ]);
  });

  it('resume la página', () => {
    expect(resumenPagina(1, 25, 25, 130)).toBe('1–25 de 130');
    expect(resumenPagina(6, 25, 5, 130)).toBe('126–130 de 130');
    expect(resumenPagina(1, 25, 0, 0)).toBe('Sin resultados');
  });
});
