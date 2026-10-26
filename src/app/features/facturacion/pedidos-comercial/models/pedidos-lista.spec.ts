import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PedidosComercialService } from '../services/pedidos-comercial.service';
import type { EstadoCatalogo, PedidoResumen } from './pedido-comercial.model';
import { chipsFiltros, diasDesdeFin, filaPedido, filtrarPedidos, kpisPedidos, tonoDias } from './pedidos-lista';

const pedido = (p: Partial<PedidoResumen> = {}): PedidoResumen => ({
  id: 'p1',
  codigo: 'PEC-000101',
  ticketNumero: null,
  origen: 'portal',
  estado: 'abierto',
  estadoNombre: 'Abierto',
  macroEstado: 'pendiente',
  rolResponsable: null,
  clienteId: 'c1',
  clienteNombre: 'EP Petroecuador',
  lineaServicio: 'pumping',
  tipoOt: null,
  tiposServicio: [],
  campoNombre: 'AUCA',
  pozoNombre: 'ACAC-166',
  taladroNombre: null,
  agenteComercialNombre: null,
  analistaFacturacionNombre: null,
  fechaInicioServicio: '2026-10-01',
  fechaFinServicio: '2026-10-20',
  valorEstimado: 97915.876,
  as2Numero: null,
  as2Estado: null,
  as2SyncEstado: 'no_aplica',
  version: 1,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  ...p,
});

const estado = (codigo: string, terminal = false): EstadoCatalogo => ({
  codigo,
  nombre: codigo,
  macroEstado: 'pendiente',
  orden: 1,
  rolResponsable: null,
  terminal,
});

describe('lista de pedidos (diseño de la demo)', () => {
  const hoy = new Date(2026, 9, 26);

  it('cuenta los días desde el fin del servicio y usa el semáforo de la demo', () => {
    expect(diasDesdeFin('2026-10-23', hoy)).toBe(3);
    expect(diasDesdeFin('2026-10-30', hoy)).toBe(0);
    expect(diasDesdeFin(null, hoy)).toBeNull();
    expect([tonoDias(3), tonoDias(7), tonoDias(8), tonoDias(null)]).toEqual(['success', 'warning', 'error', 'neutral']);
  });

  it('arma la fila: código o "Sin código", campo — pozo, origen en mayúsculas, valor con 2 decimales y estado del catálogo', () => {
    const f = filaPedido(pedido(), true, hoy);
    expect(f).toMatchObject({
      code: 'PEC-000101',
      ubicacion: 'AUCA — ACAC-166',
      linea: 'Pumping',
      origen: 'PORTAL',
      estimado: '$97915.88',
      dias: '6 d',
      diasBadge: { text: '6 d', tone: 'warning' },
      estadoBadge: { text: 'Abierto', tone: 'warning' },
      editable: true,
    });
    const borrador = filaPedido(pedido({ codigo: null, fechaFinServicio: null, campoNombre: null, pozoNombre: null }), true, hoy);
    expect(borrador).toMatchObject({ code: 'Sin código', ubicacion: '—', dias: '—', diasTono: 'neutral' });
  });

  it('no deja editar sin permiso ni un pedido anulado o facturado', () => {
    expect(filaPedido(pedido(), false, hoy).editable).toBe(false);
    expect(filaPedido(pedido({ estado: 'anulado' }), true, hoy).editable).toBe(false);
    expect(filaPedido(pedido({ estado: 'facturado' }), true, hoy).editable).toBe(false);
  });

  it('filtra por línea, estado, origen y texto (también el número de AS2) y ordena del más reciente', () => {
    const lista = [
      pedido({ id: 'a', createdAt: '2026-10-01T00:00:00Z' }),
      pedido({ id: 'b', lineaServicio: 'fcr', origen: 'as2', as2Numero: 'PEC-004685', createdAt: '2026-10-05T00:00:00Z' }),
      pedido({ id: 'c', estado: 'anulado', clienteNombre: 'Otra', createdAt: '2026-10-03T00:00:00Z' }),
    ];
    const base = { busqueda: '', linea: null, estado: null, origen: null };
    expect(filtrarPedidos(lista, base).map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(filtrarPedidos(lista, { ...base, linea: 'fcr' }).map((p) => p.id)).toEqual(['b']);
    expect(filtrarPedidos(lista, { ...base, estado: 'anulado' }).map((p) => p.id)).toEqual(['c']);
    expect(filtrarPedidos(lista, { ...base, origen: 'as2' }).map((p) => p.id)).toEqual(['b']);
    expect(filtrarPedidos(lista, { ...base, busqueda: '4685' }).map((p) => p.id)).toEqual(['b']);
    expect(filtrarPedidos(lista, { ...base, busqueda: 'otra' }).map((p) => p.id)).toEqual(['c']);
  });

  it('las tarjetas: "En proceso" excluye los estados terminales del catálogo; firmados y origen AS2', () => {
    const estados = [estado('abierto'), estado('ticket_firmado'), estado('facturado', true), estado('anulado', true)];
    const lista = [
      pedido({ estado: 'abierto' }),
      pedido({ estado: 'ticket_firmado', origen: 'as2' }),
      pedido({ estado: 'aot_generada' }),
      pedido({ estado: 'facturado' }),
      pedido({ estado: 'anulado' }),
    ];
    expect(kpisPedidos(lista, estados).map((k) => [k.label, k.value])).toEqual([
      ['Pedidos', 5],
      ['En proceso', 3],
      ['Firmados / con OT', 2],
      ['Origen AS2', 1],
    ]);
  });

  it('los chips de filtros nombran el estado con el catálogo', () => {
    const estados = [{ ...estado('en_operacion'), nombre: 'En operación' }];
    expect(chipsFiltros({ linea: 'fcr', estado: 'en_operacion', origen: 'as2' }, estados).map((c) => c.label)).toEqual([
      'Línea: FCR',
      'Estado: En operación',
      'Origen: AS2',
    ]);
  });
});

describe('PedidosComercialService.listarTodos', () => {
  it('recorre todas las páginas de 100 y junta los pedidos', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const servicio = TestBed.inject(PedidosComercialService);
    const http = TestBed.inject(HttpTestingController);
    let resultado: PedidoResumen[] = [];
    servicio.listarTodos({ linea: 'fcr' }).subscribe((r) => (resultado = r));

    const pagina1 = http.expectOne((r) => r.params.get('page') === '1');
    expect(pagina1.request.params.get('limit')).toBe('100');
    expect(pagina1.request.params.get('linea')).toBe('fcr');
    pagina1.flush({ items: Array.from({ length: 100 }, (_, i) => pedido({ id: `a${i}` })), total: 150, page: 1, limit: 100 });
    http.expectOne((r) => r.params.get('page') === '2').flush({
      items: Array.from({ length: 50 }, (_, i) => pedido({ id: `b${i}` })),
      total: 150,
      page: 2,
      limit: 100,
    });
    http.verify();
    expect(resultado).toHaveLength(150);
  });
});
