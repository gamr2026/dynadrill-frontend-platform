import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { FilaReporteria } from '../models/reporteria';

/** Base de la reportería de Facturación del contenedor `comercial` (permiso `comercial.prefacturas.ver`). */
@Injectable({ providedIn: 'root' })
export class ReporteriaComercialService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/comercial/reporteria`;

  pedidos(): Observable<FilaReporteria[]> {
    return this.http.get<FilaReporteria[]>(`${this.base}/pedidos`);
  }
}
