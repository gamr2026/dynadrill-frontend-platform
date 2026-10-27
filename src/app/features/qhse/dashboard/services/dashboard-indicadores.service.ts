import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { DashboardKpiValues } from '../models/dashboard-kpi.model';

export type EstadoEpiTablero = 'solicitado' | 'aprobado' | 'despachado' | 'rechazado';
export type FasePtwTablero = 'gabinete' | 'formalizacion' | 'aprobacion';

/** Lo que el servidor calcula para el Dashboard Integrado (HSE-MASTER-001): los indicadores, el estado de EPI y PTW y lo que pone el semáforo en rojo. */
export interface IndicadoresTablero {
  generadoAt: string;
  valores: DashboardKpiValues;
  incumplimientoLegal: string[];
  epi: {
    total: number;
    porEstado: Array<{ estado: EstadoEpiTablero; cantidad: number }>;
    pendientes: Array<{ id: string; codigo: string; trabajador: string; cargo: string | null }>;
  };
  ptw: {
    abiertos: number;
    porFase: Array<{ fase: FasePtwTablero; cantidad: number }>;
    estancados: Array<{
      id: string;
      codigo: string;
      pedido: string;
      diaOperacion: string;
      fase: FasePtwTablero;
      diasSinActividad: number;
    }>;
  };
}

/** `GET /api/v2/qhse/dashboard/indicadores`: todo se calcula en el servidor sobre las tablas de QHSE. */
@Injectable({ providedIn: 'root' })
export class DashboardIndicadoresService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v2/qhse/dashboard/indicadores`;

  obtener(): Observable<IndicadoresTablero> {
    return this.http.get<IndicadoresTablero>(this.baseUrl);
  }
}
