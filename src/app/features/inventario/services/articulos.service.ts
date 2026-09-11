import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Articulo, CreateArticuloInput } from '../models/articulo.model';
import { environment } from '@env';

/** Mismo shape que acepta `GET /api/articulos` en el backend (`ArticulosController.findAll`). */
export interface ArticulosFiltro {
  categoria?: string;
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ArticulosService {
  private readonly http = inject(HttpClient);

  list(filtro?: ArticulosFiltro): Observable<Articulo[]> {
    let params = new HttpParams();
    if (filtro?.categoria) params = params.set('categoria', filtro.categoria);
    if (filtro?.activo !== undefined) params = params.set('activo', String(filtro.activo));
    return this.http.get<Articulo[]>(`${environment.apiUrl}/articulos`, { params });
  }

  get(id: number): Observable<Articulo> {
    return this.http.get<Articulo>(`${environment.apiUrl}/articulos/${id}`);
  }

  create(input: CreateArticuloInput): Observable<Articulo> {
    return this.http.post<Articulo>(`${environment.apiUrl}/articulos`, input);
  }

  update(id: number, input: CreateArticuloInput): Observable<Articulo> {
    return this.http.put<Articulo>(`${environment.apiUrl}/articulos/${id}`, input);
  }
}
