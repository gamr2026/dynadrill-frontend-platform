import type { FcrTicket } from './fcr.model';
import { FCR_EMPTY_FILTERS, applyFcrFilters, fcrActiveFilterChips, fcrFilterOptions } from './fcr-ticket-filters';

const DIA_MS = 24 * 60 * 60 * 1000;

function ticket(id: number, overrides: Partial<FcrTicket> = {}): FcrTicket {
  return {
    id,
    code: `FCR-${id}`,
    status: 'en_ejecucion',
    wellName: `Pozo Sacha-${id}`,
    clientName: 'EP Petroecuador',
    estimatedDate: '2026-10-01',
    assignedSupervisor: 'M. Ortiz',
    assignedOperator: '',
    unitCode: 'U-1',
    currentPhase: 'revision_inicial',
    tipoOt: 'venta',
    tools: [],
    observations: [],
    phaseHistory: [],
    ...overrides,
  } as FcrTicket;
}

const tickets = [
  ticket(1),
  ticket(2, { tipoOt: 'servicio', clientName: 'Repsol Ecuador', estimatedDate: '2026-10-20' }),
  ticket(3, { status: 'cerrado', currentPhase: 'cierre', pedidoCode: 'PED-2291' }),
];

const ids = (list: FcrTicket[]) => list.map(t => t.id);

describe('applyFcrFilters', () => {
  it('sin filtros devuelve todo', () => {
    expect(ids(applyFcrFilters(tickets, FCR_EMPTY_FILTERS, 'Supervisor'))).toEqual([1, 2, 3]);
  });

  it('busca por código, pozo o cliente', () => {
    expect(ids(applyFcrFilters(tickets, { ...FCR_EMPTY_FILTERS, texto: 'repsol' }, ''))).toEqual([2]);
    expect(ids(applyFcrFilters(tickets, { ...FCR_EMPTY_FILTERS, texto: 'sacha-3' }, ''))).toEqual([3]);
  });

  it('el código también acepta el código de pedido', () => {
    expect(ids(applyFcrFilters(tickets, { ...FCR_EMPTY_FILTERS, codigo: 'PED-2291' }, ''))).toEqual([3]);
  });

  it('combina criterios con Y', () => {
    const f = { ...FCR_EMPTY_FILTERS, tipos: ['servicio' as const], clientes: ['EP Petroecuador'] };
    expect(applyFcrFilters(tickets, f, '')).toEqual([]);
  });

  it('filtra por rango de fecha estimada inclusive', () => {
    const f = { ...FCR_EMPTY_FILTERS, desde: '2026-10-01', hasta: '2026-10-01' };
    expect(ids(applyFcrFilters(tickets, f, ''))).toEqual([1, 3]);
  });

  it('filtra por estado', () => {
    expect(ids(applyFcrFilters(tickets, { ...FCR_EMPTY_FILTERS, estado: 'activos' }, ''))).toEqual([1, 2]);
    expect(ids(applyFcrFilters(tickets, { ...FCR_EMPTY_FILTERS, estado: 'cerrados' }, ''))).toEqual([3]);
  });

  it('filtra por tiempo en la etapa con los datos del backend', () => {
    const conTiempo = [
      ticket(4, { timelineResumen: { tiempoEnFaseActualMs: 2 * 60 * 60 * 1000 } as FcrTicket['timelineResumen'] }),
      ticket(5, { timelineResumen: { tiempoEnFaseActualMs: 8 * DIA_MS } as FcrTicket['timelineResumen'] }),
    ];
    expect(ids(applyFcrFilters(conTiempo, { ...FCR_EMPTY_FILTERS, tiempos: ['menos_1d'] }, ''))).toEqual([4]);
    expect(ids(applyFcrFilters(conTiempo, { ...FCR_EMPTY_FILTERS, tiempos: ['estancado'] }, ''))).toEqual([5]);
  });
});

describe('fcrActiveFilterChips', () => {
  it('genera un chip por criterio activo y cada chip limpia solo el suyo', () => {
    const f = { ...FCR_EMPTY_FILTERS, tipos: ['servicio' as const], pozo: 'Sacha' };
    const chips = fcrActiveFilterChips(f);
    expect(chips.map(c => c.label)).toEqual(['Tipo: Servicio', 'Pozo: Sacha']);
    expect(chips[0].clear(f)).toEqual({ ...f, tipos: [] });
  });

  it('no genera chips sin filtros', () => {
    expect(fcrActiveFilterChips(FCR_EMPTY_FILTERS)).toEqual([]);
  });
});

it('fcrFilterOptions devuelve valores únicos y ordenados, sin vacíos', () => {
  expect(fcrFilterOptions(tickets).clientes).toEqual(['EP Petroecuador', 'Repsol Ecuador']);
  expect(fcrFilterOptions(tickets).operadores).toEqual([]);
});
