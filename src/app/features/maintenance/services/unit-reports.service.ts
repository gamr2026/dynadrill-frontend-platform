import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUnitReportInput, UnitReport } from '../models/unit-report.model';

@Injectable({ providedIn: 'root' })
export class UnitReportsService {
  private readonly http = inject(HttpClient);

  list(): Observable<UnitReport[]> {
    return this.http.get<UnitReport[]>('/api/unit-reports');
  }

  get(id: number): Observable<UnitReport> {
    return this.http.get<UnitReport>(`/api/unit-reports/${id}`);
  }

  create(input: CreateUnitReportInput): Observable<UnitReport> {
    return this.http.post<UnitReport>('/api/unit-reports', input);
  }

  /** MAN-001-A, rama "No requiere mantenimiento": descarta el reporte sin generar orden, con motivo obligatorio. */
  dismiss(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`/api/unit-reports/${id}/dismiss`, { reason });
  }
}
