import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CreateUnitReportInput, UnitReport } from '../models/unit-report.model';
import { reporteAUnitReport } from '../models/mantenimiento-plataforma.mapper';
import { MantenimientoPlataformaService } from './mantenimiento-plataforma.service';
import { environment } from '@env';

/**
 * Reportes de unidad que recibe Mantenimiento (MAN-001-A). Se leen, descartan y clasifican en el backend nuevo: el reporte llega
 * solo, por evento, cuando Pumping firma la llegada con novedades (el contenido vive en el reporte de Pumping, no se copia).
 */
@Injectable({ providedIn: 'root' })
export class UnitReportsService {
  private readonly api = inject(MantenimientoPlataformaService);
  private readonly http = inject(HttpClient);

  list(): Observable<UnitReport[]> {
    return this.api.reportes().pipe(map(rs => rs.map(reporteAUnitReport)));
  }

  get(id: string): Observable<UnitReport> {
    return this.api.reporte(id).pipe(map(reporteAUnitReport));
  }

  /** MAN-001-A, rama "No requiere mantenimiento": descarta el reporte sin generar orden, con motivo obligatorio. */
  dismiss(id: string, reason: string): Observable<void> {
    return this.api.descartar(id, reason).pipe(map(() => undefined));
  }

  /**
   * TRANSICIÓN: el Reporte de Unidad de FCR y Vehículos todavía lo crea la demo; en el backend nuevo lo recibe Mantenimiento por
   * evento (hoy solo el de Pumping). Se retira cuando esos módulos migren.
   * @deprecated no existe en el backend nuevo.
   */
  create(input: CreateUnitReportInput): Observable<UnitReport> {
    return this.http.post<UnitReport>(`${environment.apiUrl}/unit-reports`, input);
  }

  /**
   * @deprecated no existe en el backend nuevo: las novedades se leen del reporte de su origen y no se reclasifican aquí.
   */
  update(id: string, input: CreateUnitReportInput): Observable<UnitReport> {
    return this.http.put<UnitReport>(`${environment.apiUrl}/unit-reports/${id}`, input);
  }
}
