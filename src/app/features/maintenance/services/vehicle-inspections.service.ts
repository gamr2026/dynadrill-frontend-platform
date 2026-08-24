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
}
