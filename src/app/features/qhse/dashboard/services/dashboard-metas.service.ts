import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardMetas } from '../models/dashboard-kpi.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class DashboardMetasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/dashboard-metas`;

  get(): Observable<DashboardMetas> {
    return this.http.get<DashboardMetas>(this.baseUrl);
  }

  update(changes: DashboardMetas): Observable<DashboardMetas> {
    return this.http.patch<DashboardMetas>(this.baseUrl, changes);
  }
}
