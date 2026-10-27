import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';

/** Tarjeta de QHSE del tablero general (`GET /api/v2/qhse/dashboard/resumen`). */
export interface ResumenQhseTablero {
  incidentesAbiertos: number;
  inspeccionesPendientes: number;
  ipercSinAprobar: number;
}

/** Tarjeta de Inventario del tablero general (`GET /api/operaciones/inventario/articulos/resumen`). */
export interface ResumenInventarioTablero {
  activos: number;
  agotados: number;
  enRegla: number;
}

/** Resúmenes que cada módulo calcula en su servidor para el tablero general; el resto sale de las listas que ya usan sus pantallas. */
@Injectable({ providedIn: 'root' })
export class TableroGeneralService {
  private readonly http = inject(HttpClient);

  qhse(): Observable<ResumenQhseTablero> {
    return this.http.get<ResumenQhseTablero>(`${environment.apiUrl}/v2/qhse/dashboard/resumen`);
  }

  inventario(): Observable<ResumenInventarioTablero> {
    return this.http.get<ResumenInventarioTablero>(
      `${environment.apiUrl}/operaciones/inventario/articulos/resumen`,
    );
  }
}
