import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Unidad } from '../models/unidad.model';

@Injectable({ providedIn: 'root' })
export class UnidadesService {
  private readonly http = inject(HttpClient);

  list(): Observable<Unidad[]> {
    return this.http.get<Unidad[]>('/api/unidades');
  }
}
