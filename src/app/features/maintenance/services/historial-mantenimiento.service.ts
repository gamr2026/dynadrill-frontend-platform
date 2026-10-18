import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RegistroMantenimiento } from '../models/historial-mantenimiento.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class HistorialMantenimientoService {
  private readonly http = inject(HttpClient);

  list(unidadId?: number): Observable<RegistroMantenimiento[]> {
    const params = unidadId !== undefined ? new HttpParams().set('unidadId', unidadId) : undefined;
    return this.http.get<RegistroMantenimiento[]>(`${environment.apiUrl}/historial-mantenimiento`, {
      params,
    });
  }
}
