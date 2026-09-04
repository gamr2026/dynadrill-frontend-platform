import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import type {
  OperativoActivityLogEntry,
  OperativoDocHeader,
  OperativoToolRef,
  OperativoToolUsageEntry,
} from '../models/operativo-docs.model';

/**
 * Puente FCR / Pumping → Facturación. Cuando el operador firma un Reporte
 * Job o un Reporte de Herramientas, el módulo operativo "empuja" el
 * documento a Facturación, que lo recibe vinculado al Pedido por su código.
 *
 * Falla en silencio (log): un problema de sincronización con Facturación no
 * debe bloquear el flujo operativo.
 */
@Injectable({ providedIn: 'root' })
export class OperativoDocsBridgeService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/api/facturacion/documentos-operativos';

  pushReporteJob(payload: {
    pedidoCode: string;
    origen: 'fcr' | 'pumping';
    ticketOperativoId: number;
    fecha: string;
    firmadoPor: string;
    header: OperativoDocHeader;
    actividades: OperativoActivityLogEntry[];
  }): void {
    this.enviar({ ...payload, tipo: 'reporte_job', firmadoAt: new Date().toISOString() });
  }

  pushReporteHerramientas(payload: {
    pedidoCode: string;
    origen: 'fcr' | 'pumping';
    ticketOperativoId: number;
    firmadoPor: string;
    header: OperativoDocHeader;
    herramientas: OperativoToolRef[];
    usoHerramientas: OperativoToolUsageEntry[];
  }): void {
    this.enviar({ ...payload, tipo: 'reporte_herramientas', firmadoAt: new Date().toISOString() });
  }

  private enviar(body: Record<string, unknown>): void {
    this.http
      .post(this.endpoint, body)
      .pipe(catchError(err => (console.warn('[OperativoDocsBridge] no se pudo notificar a Facturación', err), of(null))))
      .subscribe();
  }
}
