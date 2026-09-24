import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DocumentoLegal, LegalTipo } from '../models/documento-legal.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class DocumentoLegalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/legal`;

  listar(): Observable<DocumentoLegal[]> {
    return this.http.get<DocumentoLegal[]>(this.baseUrl);
  }

  subir(tipo: LegalTipo, archivo: File, revision?: string, fechaAprobacion?: string): Observable<DocumentoLegal> {
    const form = new FormData();
    form.append('file', archivo);
    if (revision) form.append('revision', revision);
    if (fechaAprobacion) form.append('fechaAprobacion', fechaAprobacion);
    return this.http.post<DocumentoLegal>(`${this.baseUrl}/${tipo}`, form);
  }

  descargar(tipo: LegalTipo): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${tipo}/archivo`, { responseType: 'blob' });
  }
}
