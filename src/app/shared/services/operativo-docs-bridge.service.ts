import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '@env';
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
/** Quién envía el documento puede enterarse del resultado (ej. 409: Facturación ya corrigió ese día). */
export interface ResultadoEnvio {
  alEnviar?: () => void;
  alFallar?: (mensaje: string) => void;
}

@Injectable({ providedIn: 'root' })
export class OperativoDocsBridgeService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/facturacion/documentos-operativos`;

  pushReporteJob(payload: {
    pedidoCode: string;
    origen: 'fcr' | 'pumping';
    ticketOperativoId: number;
    fecha: string;
    firmadoPor: string;
    header: OperativoDocHeader;
    actividades: OperativoActivityLogEntry[];
  }, resultado?: ResultadoEnvio): void {
    this.enviar({ ...payload, tipo: 'reporte_job', firmadoAt: new Date().toISOString() }, resultado);
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

  private enviar(body: Record<string, unknown>, resultado?: ResultadoEnvio): void {
    this.http.post(this.endpoint, body).subscribe({
      next: () => resultado?.alEnviar?.(),
      error: (err: { error?: { message?: string } }) => {
        console.warn('[OperativoDocsBridge] no se pudo notificar a Facturación', err);
        resultado?.alFallar?.(err?.error?.message ?? 'No se pudo notificar a Facturación.');
      },
    });
  }
}
