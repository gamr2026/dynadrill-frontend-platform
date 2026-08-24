import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateVehicleInspectionInput, VehicleInspection } from '../models/vehicle-inspection.model';

@Injectable({ providedIn: 'root' })
export class VehicleInspectionsService {
  private readonly http = inject(HttpClient);

  list(): Observable<VehicleInspection[]> {
    return this.http.get<VehicleInspection[]>('/api/vehicle-inspections');
  }

  create(input: CreateVehicleInspectionInput): Observable<VehicleInspection> {
    return this.http.post<VehicleInspection>('/api/vehicle-inspections', input);
  }

  update(id: number, input: CreateVehicleInspectionInput): Observable<VehicleInspection> {
    return this.http.put<VehicleInspection>(`/api/vehicle-inspections/${id}`, input);
  }

  /** Firma del Supervisor (Plan 2026, 5.3). */
  approve(id: number, supervisorName: string): Observable<VehicleInspection> {
    return this.http.patch<VehicleInspection>(`/api/vehicle-inspections/${id}/approve`, { supervisorName });
  }
}
