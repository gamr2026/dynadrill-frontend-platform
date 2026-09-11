import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  FcrToolInspection,
  FcrToolInspectionFirmaRol,
  FcrToolInspectionHeaderInput,
  FcrToolInspectionParteInput,
} from '../models/fcr-tool-inspeccion.model';
import { environment } from '@env';

/** Servicio HTTP puro para el checklist de inspección por herramienta — mismo patrón que `FcrService`. */
@Injectable({ providedIn: 'root' })
export class FcrToolInspeccionesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/operations/fcr/tickets`;

  listByTicket(ticketId: number): Observable<FcrToolInspection[]> {
    return this.http.get<FcrToolInspection[]>(`${this.baseUrl}/${ticketId}/tool-inspections`);
  }

  /** Idempotente: si ya existe un checklist para esa herramienta, el backend devuelve el existente sin reiniciarlo. */
  iniciar(ticketId: number, toolId: number, articuloId: number): Observable<FcrToolInspection> {
    return this.http.post<FcrToolInspection>(`${this.baseUrl}/${ticketId}/tool-inspections`, { toolId, articuloId });
  }

  guardarHeader(ticketId: number, inspectionId: number, header: FcrToolInspectionHeaderInput): Observable<FcrToolInspection> {
    return this.http.patch<FcrToolInspection>(`${this.baseUrl}/${ticketId}/tool-inspections/${inspectionId}/header`, header);
  }

  guardarParte(ticketId: number, inspectionId: number, parteId: number, cambios: FcrToolInspectionParteInput): Observable<FcrToolInspection> {
    return this.http.patch<FcrToolInspection>(
      `${this.baseUrl}/${ticketId}/tool-inspections/${inspectionId}/partes/${parteId}`,
      cambios,
    );
  }

  /** El nombre de quien firma ya NO se manda — lo resuelve el backend del usuario autenticado. */
  firmar(ticketId: number, inspectionId: number, rol: FcrToolInspectionFirmaRol, fecha: string): Observable<FcrToolInspection> {
    return this.http.patch<FcrToolInspection>(`${this.baseUrl}/${ticketId}/tool-inspections/${inspectionId}/firmas/${rol}`, {
      fecha,
    });
  }

  enviar(ticketId: number, inspectionId: number): Observable<FcrToolInspection> {
    return this.http.patch<FcrToolInspection>(`${this.baseUrl}/${ticketId}/tool-inspections/${inspectionId}/enviar`, {});
  }
}
