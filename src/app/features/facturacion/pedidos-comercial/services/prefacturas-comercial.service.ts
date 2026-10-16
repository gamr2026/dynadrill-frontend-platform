import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { DevueltoA, MedioEnvio, Prefactura, RegistrarFirmaRequest } from '../models/prefactura-comercial';

/** Prefacturas del contenedor `comercial`. La autoridad de estados y permisos es el backend. */
@Injectable({ providedIn: 'root' })
export class PrefacturasComercialService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/comercial`;

  /** Versiones del pedido, la más reciente primero. */
  delPedido(pedidoId: string): Observable<Prefactura[]> {
    return this.http.get<Prefactura[]>(`${this.base}/pedidos/${pedidoId}/prefacturas`);
  }

  detalle(id: string): Observable<Prefactura> {
    return this.http.get<Prefactura>(`${this.base}/prefacturas/${id}`);
  }

  /** 422 `DOCUMENTACION_INCOMPLETA` si faltan documentos; 409 si ya hay una vigente. */
  generar(pedidoId: string): Observable<Prefactura> {
    return this.http.post<Prefactura>(`${this.base}/pedidos/${pedidoId}/prefacturas`, {});
  }

  recalcular(id: string): Observable<Prefactura> {
    return this.http.post<Prefactura>(`${this.base}/prefacturas/${id}/recalcular`, {});
  }

  /** Número que AS2 asignó a la prefactura (PRC-, sin prefijo). */
  registrarTicket(id: string, numero: number): Observable<Prefactura> {
    return this.http.post<Prefactura>(`${this.base}/prefacturas/${id}/ticket`, { numero });
  }

  enviar(id: string, medio: MedioEnvio): Observable<Prefactura> {
    return this.http.post<Prefactura>(`${this.base}/prefacturas/${id}/enviar`, { medio });
  }

  /** El archivo firmado se sube antes a `/api/archivos` con `modulo = prefactura_documento`. */
  registrarFirma(id: string, firma: RegistrarFirmaRequest): Observable<Prefactura> {
    return this.http.post<Prefactura>(`${this.base}/prefacturas/${id}/firmas`, firma);
  }

  /** Vuelve a leer la firma (la lectura automática es solo una ayuda); devuelve la prefactura. */
  verificarFirma(id: string, firmaId: string): Observable<Prefactura> {
    return this.http.post<Prefactura>(`${this.base}/prefacturas/${id}/firmas/${firmaId}/verificar`, {});
  }

  darPorFirmada(id: string, razonRetraso?: string): Observable<Prefactura> {
    const cuerpo: { razonRetraso?: string } = {};
    if (razonRetraso?.trim()) cuerpo.razonRetraso = razonRetraso.trim();
    return this.http.post<Prefactura>(`${this.base}/prefacturas/${id}/firmar`, cuerpo);
  }

  rechazar(id: string, motivo: string, devueltoA: DevueltoA): Observable<Prefactura> {
    return this.http.post<Prefactura>(`${this.base}/prefacturas/${id}/rechazar`, { motivo: motivo.trim(), devueltoA });
  }
}
