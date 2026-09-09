import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CreateIpercMatrixInput, IpercMatrix, IpercStatus } from '../models/iperc.model';

/**
 * El backend guarda el estado de la matriz en la columna `estado` (igual que
 * el resto de entidades QHSE); el modelo del front y todas las pantallas
 * usan `status`. Este servicio traduce en ambos sentidos para no tocar
 * componentes ni el resto del módulo.
 */
type RawIperc = Omit<IpercMatrix, 'status'> & { estado: IpercStatus; status?: IpercStatus };

function fromApi(raw: RawIperc): IpercMatrix {
  const { estado, ...rest } = raw;
  return { ...(rest as Omit<IpercMatrix, 'status'>), status: estado ?? raw.status } as IpercMatrix;
}

function toApi(changes: Partial<IpercMatrix>): Record<string, unknown> {
  if (!('status' in changes)) return changes as Record<string, unknown>;
  const { status, ...rest } = changes;
  return { ...rest, estado: status };
}

@Injectable({ providedIn: 'root' })
export class IpercService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/qhse/iperc';

  list(): Observable<IpercMatrix[]> {
    return this.http.get<RawIperc[]>(this.baseUrl).pipe(map(rows => rows.map(fromApi)));
  }

  create(input: CreateIpercMatrixInput): Observable<IpercMatrix> {
    return this.http.post<RawIperc>(this.baseUrl, input).pipe(map(fromApi));
  }

  get(id: number): Observable<IpercMatrix> {
    return this.http.get<RawIperc>(`${this.baseUrl}/${id}`).pipe(map(fromApi));
  }

  update(id: number, changes: Partial<IpercMatrix>): Observable<IpercMatrix> {
    return this.http.patch<RawIperc>(`${this.baseUrl}/${id}`, toApi(changes)).pipe(map(fromApi));
  }

  approve(id: number, approvedByName: string): Observable<IpercMatrix> {
    return this.http.patch<RawIperc>(`${this.baseUrl}/${id}/approve`, { approvedByName }).pipe(map(fromApi));
  }
}
