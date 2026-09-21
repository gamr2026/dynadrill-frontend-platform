import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateStopCardInput, StopCard } from '../models/stop-card.model';
import { environment } from '@env';

@Injectable({ providedIn: 'root' })
export class StopCardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/qhse/stop`;

  list(): Observable<StopCard[]> {
    return this.http.get<StopCard[]>(this.baseUrl);
  }

  create(input: CreateStopCardInput): Observable<StopCard> {
    return this.http.post<StopCard>(this.baseUrl, input);
  }
}
