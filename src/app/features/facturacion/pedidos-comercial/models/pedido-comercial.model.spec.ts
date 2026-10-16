import {
  claveSubtipo,
  errorCoherencia,
  etiquetaTipoOt,
  etiquetaTipoServicio,
  etiquetasSubtipos,
  etiquetasTiposServicio,
  esConflicto,
  estaSinAnalista,
  faltantesParaAbrir,
  formatoDia,
  formatoMoneda,
  haySiguiente,
  importesItem,
  mensajeDeError,
  pasosDeFlujo,
  puedeDarPaso,
  resumenPaginacion,
  opcionesSubtipos,
  subtipoDesdeClave,
  subtiposVigentes,
  tiposCompatibles,
  tiposDeLinea,
  totalFinalAs2,
  totalesItems,
  type BorradorPedido,
  type CatalogoServicios,
  type TransicionDisponible,
} from './pedido-comercial.model';

const completo: BorradorPedido = {
  clienteId: 'c1',
  lineaServicio: 'fcr',
  tipoOt: 'servicio',
  tiposServicio: ['milling'],
  campoId: 'ca1',
  pozoId: 'p1',
  taladroId: 't1',
  rigless: false,
  numeroContrato: 'CT-1',
  fechaInicioServicio: '2026-10-01',
  fechaFinServicio: '2026-10-05',
  tecnicoHseId: 'u1',
  bodegaId: 'b1',
  cantidadItems: 2,
};

describe('importes', () => {
  it('calcula bruto, descuento y neto a dos decimales (igual que el backend)', () => {
    expect(importesItem(3, 10.5, 10)).toEqual({ bruto: 31.5, descuento: 3.15, neto: 28.35 });
  });

  it('sin descuento el neto es el bruto', () => {
    expect(importesItem(2, 5, null)).toEqual({ bruto: 10, descuento: 0, neto: 10 });
  });

  it('suma los totales del pedido', () => {
    const t = totalesItems([
      { bruto: 100, descuento: 10 },
      { bruto: 50.5, descuento: 0.5 },
    ]);
    expect(t).toEqual({ subtotal: 150.5, descuento: 10.5, neto: 140 });
  });

  it('el total final de AS2 es total - descuento + impuesto', () => {
    expect(totalFinalAs2(1000, 100, 108)).toBe(1008);
    expect(totalFinalAs2(1000, null, null)).toBe(1000);
    expect(totalFinalAs2(null, 1, 1)).toBeNull();
  });
});

describe('formato', () => {
  it('moneda en dólares con dos decimales y guion si no hay valor', () => {
    expect(formatoMoneda(1234.5)).toBe('$1,234.50');
    expect(formatoMoneda(null)).toBe('—');
    expect(formatoMoneda(undefined)).toBe('—');
  });

  it('fecha dd/mm/aaaa sin correr el día por zona horaria', () => {
    expect(formatoDia('2026-10-01')).toBe('01/10/2026');
    expect(formatoDia('2026-10-01T23:30:00.000Z')).toBe('01/10/2026');
    expect(formatoDia(null)).toBe('—');
  });
});

const catalogo: CatalogoServicios = {
  lineas: [
    {
      linea: 'fcr',
      tipos: [
        { codigo: 'milling', nombre: 'Milling', subtipos: ['Milling', 'Mill Cement & CR'] },
        { codigo: 'fishing_services', nombre: 'Fishing Services', subtipos: ['Milling', 'Pesca CTU'] },
      ],
    },
    { linea: 'pumping', tipos: [{ codigo: 'cementing', nombre: 'Cementing', subtipos: [] }] },
  ],
};

describe('catálogo de servicios', () => {
  it('cada línea ofrece solo sus tipos', () => {
    expect(tiposDeLinea(catalogo, 'pumping').map(t => t.codigo)).toEqual(['cementing']);
    expect(tiposDeLinea(catalogo, 'fcr')).toHaveLength(2);
    expect(tiposDeLinea(catalogo, null)).toEqual([]);
    expect(tiposDeLinea(null, 'fcr')).toEqual([]);
  });

  it('al cambiar de línea se descartan los tipos que ya no corresponden', () => {
    expect(tiposCompatibles(catalogo, 'pumping', ['milling', 'cementing'])).toEqual(['cementing']);
    expect(tiposCompatibles(catalogo, null, ['milling'])).toEqual([]);
  });

  it('los nombres de tipo salen del catálogo y, sin él, se humanizan', () => {
    expect(etiquetaTipoServicio(catalogo, 'fishing_services')).toBe('Fishing Services');
    expect(etiquetaTipoServicio(null, 'wellbore_cleanup')).toBe('Wellbore Cleanup');
    expect(etiquetasTiposServicio(catalogo, ['milling', 'cementing'])).toBe('Milling, Cementing');
    expect(etiquetasTiposServicio(catalogo, [])).toBe('—');
  });

  it('los subtipos se agrupan por tipo y el mismo nombre bajo dos tipos no se confunde', () => {
    const o = opcionesSubtipos(catalogo, 'fcr', ['milling', 'fishing_services']);
    expect(o.filter(x => x.label === 'Milling').map(x => x.group)).toEqual(['Milling', 'Fishing Services']);
    expect(new Set(o.map(x => x.value)).size).toBe(o.length);
    expect(opcionesSubtipos(catalogo, 'fcr', [])).toEqual([]);
    expect(opcionesSubtipos(catalogo, 'fcr', ['cementing'])).toEqual([]);
  });

  it('la clave de un subtipo ida y vuelta', () => {
    const s = { tipo: 'milling', subtipo: 'Mill Cement & CR' };
    expect(subtipoDesdeClave(claveSubtipo(s))).toEqual(s);
    expect(subtipoDesdeClave('sin-separador')).toBeNull();
  });

  it('al quitar un tipo se quitan sus subtipos', () => {
    const elegidos = [
      { tipo: 'milling', subtipo: 'Milling' },
      { tipo: 'fishing_services', subtipo: 'Milling' },
      { tipo: 'fishing_services', subtipo: 'Pesca CTU' },
    ];
    expect(subtiposVigentes(catalogo, 'fcr', ['fishing_services'], elegidos)).toEqual(elegidos.slice(1));
    expect(subtiposVigentes(catalogo, 'fcr', [], elegidos)).toEqual([]);
  });

  it('muestra cada subtipo con su tipo', () => {
    expect(etiquetasSubtipos(catalogo, [{ tipo: 'fishing_services', subtipo: 'Milling' }])).toBe('Milling (Fishing Services)');
    expect(etiquetasSubtipos(catalogo, [])).toBe('—');
  });
});

describe('tipo de OT desde el catálogo', () => {
  const tipos = [{ codigo: 'venta', nombre: 'Venta' }, { codigo: 'servicio', nombre: 'Servicio' }];
  it('muestra el nombre del catálogo y, si falta, el código', () => {
    expect(etiquetaTipoOt(tipos, 'venta')).toBe('Venta');
    expect(etiquetaTipoOt([], 'servicio')).toBe('servicio');
    expect(etiquetaTipoOt(tipos, null)).toBe('—');
  });
});

describe('faltantesParaAbrir', () => {
  it('un pedido completo no tiene faltantes', () => {
    expect(faltantesParaAbrir(completo)).toEqual([]);
  });

  it('lista en español todo lo que falta', () => {
    const f = faltantesParaAbrir({
      ...completo,
      clienteId: null,
      tiposServicio: [],
      pozoId: null,
      taladroId: null,
      numeroContrato: '  ',
      bodegaId: null,
      cantidadItems: 0,
    });
    expect(f).toEqual(['cliente', 'tipo de servicio', 'pozo', 'taladro (o marcar "rigless")', 'número de contrato', 'bodega', 'al menos un ítem de la lista de precios']);
  });

  it('rigless reemplaza al taladro', () => {
    expect(faltantesParaAbrir({ ...completo, taladroId: null, rigless: true })).toEqual([]);
  });
});

describe('errorCoherencia', () => {
  it('rechaza fin anterior a inicio', () => {
    expect(errorCoherencia({ fechaInicioServicio: '2026-10-05', fechaFinServicio: '2026-10-01', rigless: false, taladroId: null })).toMatch(/fecha de fin/);
  });

  it('rechaza rigless con taladro', () => {
    expect(errorCoherencia({ fechaInicioServicio: null, fechaFinServicio: null, rigless: true, taladroId: 't1' })).toMatch(/rigless/);
  });

  it('acepta datos coherentes', () => {
    expect(errorCoherencia({ fechaInicioServicio: '2026-10-01', fechaFinServicio: '2026-10-01', rigless: false, taladroId: 't1' })).toBeNull();
  });
});

describe('pasos del flujo (los dicta el backend)', () => {
  const siguientes: TransicionDisponible[] = [
    { estado: 'abierto', nombre: 'Abierto', requiereMotivo: false, regla: 'pedido_completo' },
    { estado: 'en_correccion', nombre: 'En corrección', requiereMotivo: true, regla: null },
    { estado: 'anulado', nombre: 'Anulado', requiereMotivo: true, regla: null },
    { estado: 'prefactura_generada', nombre: 'Prefactura generada', requiereMotivo: false, regla: null },
  ];

  it('los botones de flujo omiten Anular y Rechazar, que tienen botón propio', () => {
    expect(pasosDeFlujo(siguientes).map(s => s.estado)).toEqual(['abierto', 'prefactura_generada']);
  });

  it('Anular y Rechazar solo existen si el backend los permite', () => {
    expect(puedeDarPaso(siguientes, 'anulado')?.requiereMotivo).toBe(true);
    expect(puedeDarPaso([siguientes[3]], 'anulado')).toBeUndefined();
  });
});

describe('paginación', () => {
  it('describe el rango y las páginas con total conocido', () => {
    expect(resumenPaginacion(2, 10, 10, 35)).toBe('Mostrando 11–20 de 35 · Página 2 de 4');
    expect(resumenPaginacion(4, 10, 5, 35)).toBe('Mostrando 31–35 de 35 · Página 4 de 4');
  });

  it('sin total (AS2 con filtro de líneas) no inventa páginas', () => {
    expect(resumenPaginacion(1, 10, 10, null)).toBe('Mostrando 1–10 · Página 1');
    expect(resumenPaginacion(1, 10, 0, 0)).toBe('Sin resultados');
  });

  it('hay siguiente por total o por hayMas', () => {
    expect(haySiguiente(1, 10, 35, false)).toBe(true);
    expect(haySiguiente(4, 10, 35, true)).toBe(false);
    expect(haySiguiente(1, 10, null, true)).toBe(true);
    expect(haySiguiente(3, 10, null, false)).toBe(false);
  });
});

describe('bandeja sin analista', () => {
  it('cuenta los pedidos sin analista que no están anulados', () => {
    expect(estaSinAnalista({ analistaFacturacionNombre: null, estado: 'facturado' })).toBe(true);
    expect(estaSinAnalista({ analistaFacturacionNombre: 'Ana', estado: 'facturado' })).toBe(false);
    expect(estaSinAnalista({ analistaFacturacionNombre: null, estado: 'anulado' })).toBe(false);
  });
});

describe('errores del backend', () => {
  it('toma el mensaje (texto o lista) del cuerpo del error', () => {
    expect(mensajeDeError({ error: { message: 'El pedido está incompleto' } }, 'x')).toBe('El pedido está incompleto');
    expect(mensajeDeError({ error: { message: ['uno', 'dos'] } }, 'x')).toBe('uno. dos');
    expect(mensajeDeError(new Error('sin cuerpo'), 'por defecto')).toBe('por defecto');
    expect(mensajeDeError(null, 'por defecto')).toBe('por defecto');
  });

  it('reconoce el 409', () => {
    expect(esConflicto({ status: 409 })).toBe(true);
    expect(esConflicto({ status: 400 })).toBe(false);
  });
});
