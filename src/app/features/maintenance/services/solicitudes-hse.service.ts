import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * HSE-SEGUIMIENTO-001 → Mantenimiento (HSE-004). Inspección QHSE de un
 * vehículo-grúa que salió rechazada: es una solicitud de reparación que el
 * Jefe de Mantenimiento tiene que atender.
 */
export interface SolicitudReparacionHse {
  id: number;
  code: string;
  tipo: string;
  equipoCodigo: string;
  inspectorNombre: string;
  fecha: string;
  criterios: { label: string; checked: boolean }[];
  resultado: string;
  mantenimientoResuelto?: boolean;
}

export function criteriosFallidos(s: Pick<SolicitudReparacionHse, 'criterios'>): string[] {
  return s.criterios.filter(c => !c.checked).map(c => c.label);
}

@Injectable({ providedIn: 'root' })
export class SolicitudesHseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/solicitudes-reparacion-hse';

  list(): Observable<SolicitudReparacionHse[]> {
    return this.http.get<SolicitudReparacionHse[]>(this.baseUrl);
  }

  atender(id: number, atendidoPor: string, ordenId?: number): Observable<SolicitudReparacionHse> {
    return this.http.patch<SolicitudReparacionHse>(`${this.baseUrl}/${id}/atender`, { atendidoPor, ordenId });
  }
}
