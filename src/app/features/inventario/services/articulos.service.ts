import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Articulo, CreateArticuloInput } from '../models/articulo.model';

@Injectable({ providedIn: 'root' })
export class ArticulosService {
  private readonly http = inject(HttpClient);

  list(): Observable<Articulo[]> {
    return this.http.get<Articulo[]>('/api/articulos');
  }

  get(id: number): Observable<Articulo> {
    return this.http.get<Articulo>(`/api/articulos/${id}`);
  }

  create(input: CreateArticuloInput): Observable<Articulo> {
    return this.http.post<Articulo>('/api/articulos', input);
  }

  update(id: number, input: CreateArticuloInput): Observable<Articulo> {
    return this.http.put<Articulo>(`/api/articulos/${id}`, input);
  }
}
