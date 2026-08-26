import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { Articulo, CreateArticuloInput, CreateMovimientoInput, MovimientoInventario } from '../../features/inventario/models/articulo.model';

/**
 * Solo activo mientras no exista el backend real de Inventario — mismo
 * patrón que el resto de mocks (arrays en memoria, delay() para simular
 * latencia). stockActual NUNCA se guarda como campo propio: se calcula
 * siempre a partir de los movimientos, así que un artículo nuevo sin
 * movimientos arranca en 0 y no hay forma de que quede desincronizado.
 */
type ArticuloSeed = Omit<Articulo, 'stockActual'>;

const articulos: ArticuloSeed[] = [
  {
    id: 1, codigo: '0256822', nombre: "DT2 ON/OFF TOOL R/L 5.5'' OD X 3 1/2'' EUE",
    nombreComercial: "DT2 ON/OFF TOOL R/L 5.5'' OD X 3 1/2'' EUE",
    categoria: 'COMPLETION BIENES', subcategoria: 'AMERICAN COMPLETION TOOLS',
    unidadStock: 'Unidad', activo: true,
  },
  {
    id: 2, codigo: '0335035BP', nombre: 'GRASA TUBING/CASING METAL FREE THREAD COMPOUND',
    categoria: 'QUIMICA', subcategoria: 'OTROS', unidadStock: 'GL', activo: true,
  },
  {
    id: 3, codigo: '050-5687-001', nombre: 'MODEL BKR PREMIUM CEMENT RETAINER 5.687" OD',
    categoria: 'COMPLETION BIENES', subcategoria: 'AMERICAN COMPLETION TOOLS',
    unidadStock: 'Unidad', activo: true,
  },
  {
    id: 4, codigo: 'B-065', nombre: 'Inhibidor de Corrosión', categoria: 'QUIMICA', subcategoria: 'OTROS',
    unidadStock: 'GL', activo: true,
  },
  {
    id: 5, codigo: 'HTA-0021', nombre: 'Llave Stilson 36"', categoria: 'HERRAMIENTAS', subcategoria: 'MANUALES',
    unidadStock: 'Unidad', activo: true,
  },
  {
    id: 6, codigo: 'HTA-0045', nombre: 'Extensión hidráulica de torque', categoria: 'HERRAMIENTAS', subcategoria: 'HIDRAULICAS',
    unidadStock: 'Unidad', activo: true,
  },
  {
    id: 7, codigo: 'PMP-INS-010', nombre: 'Empaque de válvula de alta presión 3"', categoria: 'PUMPING BIENES', subcategoria: 'INSUMOS PUMPING',
    unidadStock: 'Unidad', activo: true,
  },
  {
    id: 8, codigo: 'PMP-INS-014', nombre: 'Manguera de succión 4" x 20ft', categoria: 'PUMPING BIENES', subcategoria: 'INSUMOS PUMPING',
    unidadStock: 'Unidad', activo: true,
  },
  {
    id: 9, codigo: 'QM-CL2-01', nombre: 'Fluido de control con cloruro de calcio @ 8.4 ppg', categoria: 'QUIMICA', subcategoria: 'FLUIDOS DE CONTROL',
    unidadStock: 'bbl', activo: true,
  },
  {
    id: 10, codigo: 'HTA-0089', nombre: 'Torquímetro digital 1"', categoria: 'HERRAMIENTAS', subcategoria: 'MEDICION',
    unidadStock: 'Unidad', nota: 'Requiere calibración anual', activo: true,
  },
];
let nextArticuloId = 11;

let movimientos: MovimientoInventario[] = [
  { id: 1, articuloId: 1, tipo: 'entrada', cantidad: 12, fecha: '2026-07-01', motivo: 'Compra inicial', responsable: 'Jorge Hidalgo', saldoResultante: 12 },
  { id: 2, articuloId: 1, tipo: 'salida', cantidad: 3, fecha: '2026-08-10', motivo: 'Consumo en Ticket #3104', responsable: 'Marco Ruiz', saldoResultante: 9 },
  { id: 3, articuloId: 2, tipo: 'entrada', cantidad: 40, fecha: '2026-07-05', motivo: 'Compra inicial', responsable: 'Jorge Hidalgo', saldoResultante: 40 },
  { id: 4, articuloId: 2, tipo: 'salida', cantidad: 15, fecha: '2026-08-15', motivo: 'Consumo en mantenimiento preventivo', responsable: 'Diego Salazar', saldoResultante: 25 },
  { id: 5, articuloId: 5, tipo: 'entrada', cantidad: 6, fecha: '2026-06-20', motivo: 'Compra inicial', responsable: 'Jorge Hidalgo', saldoResultante: 6 },
  { id: 6, articuloId: 7, tipo: 'entrada', cantidad: 20, fecha: '2026-07-12', motivo: 'Compra inicial', responsable: 'Jorge Hidalgo', saldoResultante: 20 },
  { id: 7, articuloId: 7, tipo: 'salida', cantidad: 4, fecha: '2026-08-20', motivo: 'Consumo en Ticket #3118', responsable: 'Marco Ruiz', saldoResultante: 16 },
  { id: 8, articuloId: 9, tipo: 'entrada', cantidad: 700, fecha: '2026-08-01', motivo: 'Compra para trabajo programado', responsable: 'Jorge Hidalgo', saldoResultante: 700 },
];
let nextMovimientoId = 9;

function stockFor(articuloId: number): number {
  return movimientos
    .filter(m => m.articuloId === articuloId)
    .reduce((acc, m) => acc + (m.tipo === 'entrada' ? m.cantidad : -m.cantidad), 0);
}

function toArticulo(seed: ArticuloSeed): Articulo {
  return { ...seed, stockActual: stockFor(seed.id) };
}

function matchId(url: string, base: string): number | null {
  const match = url.match(new RegExp(`${base}/(\\d+)$`));
  return match ? Number(match[1]) : null;
}

export const inventarioMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url === '/api/articulos' && req.method === 'GET') {
    return of(new HttpResponse({ status: 200, body: articulos.map(toArticulo) })).pipe(delay(300));
  }

  if (req.url === '/api/articulos' && req.method === 'POST') {
    const input = req.body as CreateArticuloInput;
    const created: ArticuloSeed = { ...input, id: nextArticuloId++ };
    articulos.push(created);
    return of(new HttpResponse({ status: 201, body: toArticulo(created) })).pipe(delay(400));
  }

  const editArticuloId = matchId(req.url, '/api/articulos');
  if (editArticuloId !== null && req.method === 'PUT') {
    const input = req.body as CreateArticuloInput;
    const idx = articulos.findIndex(a => a.id === editArticuloId);
    if (idx === -1) return of(new HttpResponse({ status: 404 })).pipe(delay(300));
    articulos[idx] = { ...input, id: editArticuloId };
    return of(new HttpResponse({ status: 200, body: toArticulo(articulos[idx]) })).pipe(delay(400));
  }

  const getArticuloId = matchId(req.url, '/api/articulos');
  if (getArticuloId !== null && req.method === 'GET') {
    const found = articulos.find(a => a.id === getArticuloId);
    return of(new HttpResponse({ status: found ? 200 : 404, body: found ? toArticulo(found) : null })).pipe(delay(300));
  }

  if (req.url === '/api/movimientos-inventario' && req.method === 'GET') {
    /**
     * req.url NO trae el query string en un interceptor funcional — los
     * params van aparte en req.params. Usarlo (como hace, con el mismo
     * bug, historial-mantenimiento en maintenance-mock.interceptor.ts)
     * deja articuloId siempre en null/0 y el filtro nunca encuentra nada.
     */
    const articuloId = Number(req.params.get('articuloId'));
    return of(new HttpResponse({ status: 200, body: movimientos.filter(m => m.articuloId === articuloId) })).pipe(delay(300));
  }

  if (req.url === '/api/movimientos-inventario' && req.method === 'POST') {
    const input = req.body as CreateMovimientoInput;
    const stockPrevio = stockFor(input.articuloId);
    if (input.tipo === 'salida' && input.cantidad > stockPrevio) {
      return of(new HttpResponse({ status: 400, body: { message: 'Stock insuficiente' } })).pipe(delay(300));
    }
    const saldoResultante = stockPrevio + (input.tipo === 'entrada' ? input.cantidad : -input.cantidad);
    const created: MovimientoInventario = { ...input, id: nextMovimientoId++, saldoResultante };
    movimientos = [...movimientos, created];
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  return next(req);
};
