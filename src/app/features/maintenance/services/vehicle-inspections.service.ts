import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ConductorPermisos, CreateVehicleInspectionInput, VehicleInspection } from '../models/vehicle-inspection.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class VehicleInspectionsService {
  private readonly http = inject(HttpClient);

  list(): Observable<VehicleInspection[]> {
    return this.http.get<VehicleInspection[]>(`${environment.apiUrl}/vehicle-inspections`);
  }

  /** Simulación de la base de RRHH/QHSE — documentos del conductor ya cargados, no autodiligenciados en el formulario. */
  listConductoresPermisos(): Observable<ConductorPermisos[]> {
    return this.http.get<ConductorPermisos[]>(`${environment.apiUrl}/conductores-permisos`);
  }

  create(input: CreateVehicleInspectionInput): Observable<VehicleInspection> {
    return this.http.post<VehicleInspection>(`${environment.apiUrl}/vehicle-inspections`, input);
  }

  update(id: number, input: CreateVehicleInspectionInput): Observable<VehicleInspection> {
    return this.http.put<VehicleInspection>(`${environment.apiUrl}/vehicle-inspections/${id}`, input);
  }

  /** Firma del Supervisor (Plan 2026, 5.3). */
  approve(id: number, supervisorName: string): Observable<VehicleInspection> {
    return this.http.patch<VehicleInspection>(`${environment.apiUrl}/vehicle-inspections/${id}/approve`, { supervisorName });
  }
}
