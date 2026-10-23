import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { FirmasDeDocumento, VerificacionFirma } from '../models/firmas.model';

/**
 * Evidencia de firma (`/api/firmas`). Solo lectura y verificación: la firma la registra cada módulo al publicar el evento
 * `<contenedor>.<documento>.firmado`, no se firma desde aquí.
 */
@Injectable({ providedIn: 'root' })
export class FirmasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/firmas`;

  /** Las firmas de un documento con su historia. Requiere `firmas.evidencia.ver`. */
  deDocumento(documentoTipo: string, documentoId: string): Observable<FirmasDeDocumento> {
    return this.http.get<FirmasDeDocumento>(this.base, {
      params: new HttpParams().set('documentoTipo', documentoTipo).set('documentoId', documentoId),
    });
  }

  /** Lee el archivo de una firma manuscrita y guarda el resultado como un intento más. Requiere `firmas.evidencia.verificar`. */
  verificar(firmaId: string): Observable<VerificacionFirma> {
    return this.http.post<VerificacionFirma>(`${this.base}/${firmaId}/verificar`, {});
  }
}
