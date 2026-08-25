import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateIpercMatrixInput, IpercMatrix } from '../models/iperc.model';

@Injectable({ providedIn: 'root' })
export class IpercService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/qhse/iperc';

  list(): Observable<IpercMatrix[]> {
    return this.http.get<IpercMatrix[]>(this.baseUrl);
  }

  create(input: CreateIpercMatrixInput): Observable<IpercMatrix> {
    return this.http.post<IpercMatrix>(this.baseUrl, input);
  }

  get(id: number): Observable<IpercMatrix> {
    return this.http.get<IpercMatrix>(`${this.baseUrl}/${id}`);
  }

  update(id: number, changes: Partial<IpercMatrix>): Observable<IpercMatrix> {
    return this.http.patch<IpercMatrix>(`${this.baseUrl}/${id}`, changes);
  }

  approve(id: number, approvedByName: string): Observable<IpercMatrix> {
    return this.http.patch<IpercMatrix>(`${this.baseUrl}/${id}/approve`, { approvedByName });
  }
}
