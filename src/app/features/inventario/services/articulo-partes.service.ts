import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ArticuloParte, CreateArticuloParteInput } from '../models/articulo-parte.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class ArticuloPartesService {
  private readonly http = inject(HttpClient);

  list(articuloId: number): Observable<ArticuloParte[]> {
    return this.http.get<ArticuloParte[]>(`${environment.apiUrl}/articulos/${articuloId}/partes`);
  }

  create(articuloId: number, input: CreateArticuloParteInput): Observable<ArticuloParte> {
    return this.http.post<ArticuloParte>(`${environment.apiUrl}/articulos/${articuloId}/partes`, input);
  }

  update(articuloId: number, id: number, input: CreateArticuloParteInput): Observable<ArticuloParte> {
    return this.http.put<ArticuloParte>(`${environment.apiUrl}/articulos/${articuloId}/partes/${id}`, input);
  }

  delete(articuloId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/articulos/${articuloId}/partes/${id}`);
  }
}
