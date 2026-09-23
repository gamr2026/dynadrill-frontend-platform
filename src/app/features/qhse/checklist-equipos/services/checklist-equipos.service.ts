import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { ChecklistEquipo } from '../models/checklist-equipo.model';

@Injectable({ providedIn: 'root' })
export class ChecklistEquiposService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/checklist-equipos`;

  listar(filtro: { estado?: string; pumpingTicketId?: number } = {}): Observable<ChecklistEquipo[]> {
    const params: Record<string, string> = {};
    if (filtro.estado) params['estado'] = filtro.estado;
    if (filtro.pumpingTicketId) params['pumpingTicketId'] = String(filtro.pumpingTicketId);
    return this.http.get<ChecklistEquipo[]>(this.baseUrl, { params });
  }

  abrir(pumpingTicketId: number): Observable<ChecklistEquipo[]> {
    return this.http.post<ChecklistEquipo[]>(`${this.baseUrl}/abrir`, { pumpingTicketId });
  }

  aprobar(id: number): Observable<ChecklistEquipo> {
    return this.http.patch<ChecklistEquipo>(`${this.baseUrl}/${id}/aprobar`, {});
  }

  rechazar(id: number, motivo: string): Observable<ChecklistEquipo> {
    return this.http.patch<ChecklistEquipo>(`${this.baseUrl}/${id}/rechazar`, { motivo });
  }

  descargar(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/documento`, { responseType: 'blob' });
  }
}
