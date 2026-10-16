import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  ActualizarArticuloInput,
  ArticuloInventario,
  ArticuloInventarioDetalle,
  BodegaInventario,
  CategoriaInventario,
  CrearArticuloInput,
  FiltroArticulos,
  MotivoMovimiento,
  MovimientoKardex,
  ParteArticulo,
  ParteArticuloInput,
  RegistrarMovimientoInput,
  UnidadStockInventario,
} from '../models/inventario-plataforma.model';

/**
 * Inventario del backend nuevo (el gateway enruta `/api/operaciones/*` al contenedor operaciones). Los servicios de la demo
 * (`ArticulosService`, `MovimientosInventarioService`) siguen apuntando a `/api/articulos` para las pantallas que aún no migran.
 */
@Injectable({ providedIn: 'root' })
export class InventarioPlataformaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/inventario`;

  // --- artículos ---
  articulos(filtro: FiltroArticulos = {}): Observable<ArticuloInventario[]> {
    let params = new HttpParams();
    if (filtro.q) params = params.set('q', filtro.q);
    if (filtro.categoriaId) params = params.set('categoriaId', filtro.categoriaId);
    if (filtro.subcategoriaId) params = params.set('subcategoriaId', filtro.subcategoriaId);
    if (filtro.activo !== undefined) params = params.set('activo', String(filtro.activo));
    if (filtro.conStock !== undefined) params = params.set('conStock', String(filtro.conStock));
    if (filtro.quimicos !== undefined) params = params.set('quimicos', String(filtro.quimicos));
    return this.http.get<ArticuloInventario[]>(`${this.base}/articulos`, { params });
  }

  articulo(id: string): Observable<ArticuloInventarioDetalle> {
    return this.http.get<ArticuloInventarioDetalle>(`${this.base}/articulos/${id}`);
  }

  crearArticulo(input: CrearArticuloInput): Observable<ArticuloInventarioDetalle> {
    return this.http.post<ArticuloInventarioDetalle>(`${this.base}/articulos`, input);
  }

  actualizarArticulo(id: string, input: ActualizarArticuloInput): Observable<ArticuloInventarioDetalle> {
    return this.http.put<ArticuloInventarioDetalle>(`${this.base}/articulos/${id}`, input);
  }

  // --- kardex ---
  kardex(articuloId: string, opciones: { bodegaId?: string; limite?: number } = {}): Observable<MovimientoKardex[]> {
    let params = new HttpParams();
    if (opciones.bodegaId) params = params.set('bodegaId', opciones.bodegaId);
    if (opciones.limite) params = params.set('limite', opciones.limite);
    return this.http.get<MovimientoKardex[]>(`${this.base}/articulos/${articuloId}/movimientos`, { params });
  }

  /** El servidor calcula el saldo y rechaza una salida que deje el stock de la bodega en negativo (409). */
  registrarMovimiento(input: RegistrarMovimientoInput): Observable<MovimientoKardex> {
    return this.http.post<MovimientoKardex>(`${this.base}/movimientos`, input);
  }

  // --- partes de una herramienta ---
  partes(articuloId: string): Observable<ParteArticulo[]> {
    return this.http.get<ParteArticulo[]>(`${this.base}/articulos/${articuloId}/partes`);
  }

  crearParte(articuloId: string, input: ParteArticuloInput): Observable<ParteArticulo> {
    return this.http.post<ParteArticulo>(`${this.base}/articulos/${articuloId}/partes`, input);
  }

  actualizarParte(parteId: string, input: ParteArticuloInput): Observable<ParteArticulo> {
    return this.http.put<ParteArticulo>(`${this.base}/partes/${parteId}`, input);
  }

  eliminarParte(parteId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/partes/${parteId}`);
  }

  // --- catálogos ---
  categorias(): Observable<CategoriaInventario[]> {
    return this.http.get<CategoriaInventario[]>(`${this.base}/categorias`);
  }

  unidades(): Observable<UnidadStockInventario[]> {
    return this.http.get<UnidadStockInventario[]>(`${this.base}/unidades`);
  }

  /** `manual: true` trae solo los motivos que Bodega puede registrar a mano. */
  motivos(filtro: { manual?: boolean } = {}): Observable<MotivoMovimiento[]> {
    let params = new HttpParams();
    if (filtro.manual !== undefined) params = params.set('manual', String(filtro.manual));
    return this.http.get<MotivoMovimiento[]>(`${this.base}/motivos`, { params });
  }

  bodegas(): Observable<BodegaInventario[]> {
    return this.http.get<BodegaInventario[]>(`${this.base}/bodegas`);
  }
}
