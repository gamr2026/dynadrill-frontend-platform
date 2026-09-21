import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateUnitReportInput, UnitReport } from '../models/unit-report.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class UnitReportsService {
  private readonly http = inject(HttpClient);

  list(): Observable<UnitReport[]> {
    return this.http.get<UnitReport[]>(`${environment.apiUrl}/unit-reports`);
  }

  get(id: number): Observable<UnitReport> {
    return this.http.get<UnitReport>(`${environment.apiUrl}/unit-reports/${id}`);
  }

  create(input: CreateUnitReportInput): Observable<UnitReport> {
    return this.http.post<UnitReport>(`${environment.apiUrl}/unit-reports`, input);
  }

  update(id: number, input: CreateUnitReportInput): Observable<UnitReport> {
    return this.http.put<UnitReport>(`${environment.apiUrl}/unit-reports/${id}`, input);
  }

  /** MAN-001-A, rama "No requiere mantenimiento": descarta el reporte sin generar orden, con motivo obligatorio. */
  dismiss(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/unit-reports/${id}/dismiss`, { reason });
  }
}
