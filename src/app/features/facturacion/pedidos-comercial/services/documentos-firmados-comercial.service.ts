import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  CargarDocumentoFirmadoRequest,
  DocumentoFirmado,
} from '../models/documentos-firmados';

/** Versión firmada del monitoreo y la mezcla química del ticket, que carga Facturación. */
@Injectable({ providedIn: 'root' })
export class DocumentosFirmadosComercialService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/comercial/pedidos`;

  delPedido(pedidoId: string): Observable<DocumentoFirmado[]> {
    return this.http.get<DocumentoFirmado[]>(`${this.base}/${pedidoId}/documentos-firmados`);
  }

  /** El archivo se sube antes a `/api/archivos` con `modulo = documento_respaldo_firmado`. Devuelve la lista vigente. */
  cargar(pedidoId: string, cuerpo: CargarDocumentoFirmadoRequest): Observable<DocumentoFirmado[]> {
    return this.http.post<DocumentoFirmado[]>(
      `${this.base}/${pedidoId}/documentos-firmados`,
      cuerpo,
    );
  }
}
