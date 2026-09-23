import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { PedidoConEstadoDocumental } from '../models/qhse-documentos.model';

export interface DocumentoQhse {
  id: number;
  pedidoId: number;
  tipo: string;
  referencia: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}

/** Lado QHSE de los documentos reales del pedido — ver `QhseDocumentosController` del backend. */
@Injectable({ providedIn: 'root' })
export class QhseDocumentosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/pedidos`;

  listarPedidos(desde?: string): Observable<PedidoConEstadoDocumental[]> {
    const params = desde ? { desde } : undefined;
    return this.http.get<PedidoConEstadoDocumental[]>(`${this.baseUrl}/documentos`, { params });
  }

  listar(pedidoId: number): Observable<DocumentoQhse[]> {
    return this.http.get<DocumentoQhse[]>(`${this.baseUrl}/${pedidoId}/documentos`);
  }

  subir(pedidoId: number, tipo: string, referencia: string, archivo: File): Observable<DocumentoQhse> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post<DocumentoQhse>(`${this.baseUrl}/${pedidoId}/documentos/${tipo}/${encodeURIComponent(referencia)}`, form);
  }

  descargar(pedidoId: number, tipo: string, referencia: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${pedidoId}/documentos/${tipo}/${encodeURIComponent(referencia)}`, {
      responseType: 'blob',
    });
  }
}
