import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  LIMITE_PAGINA,
  paramsDeBusqueda,
  type CatalogosAuditoria,
  type FiltrosAuditoria,
  type PaginaEventos,
} from '../models/auditoria.model';

/** Consulta del registro de auditoría (`/api/auditoria`). Solo lectura; requiere `auditoria.eventos.ver`. */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auditoria`;

  /** Lo que se puede elegir al filtrar. */
  catalogos(): Observable<CatalogosAuditoria> {
    return this.http.get<CatalogosAuditoria>(`${this.base}/catalogos`);
  }

  buscar(
    filtros: FiltrosAuditoria,
    pagina: number,
    limite = LIMITE_PAGINA,
  ): Observable<PaginaEventos> {
    return this.http.get<PaginaEventos>(`${this.base}/eventos`, {
      params: new HttpParams({ fromObject: paramsDeBusqueda(filtros, pagina, limite) }),
    });
  }

  /** Qué pasó con una entidad, en orden cronológico. */
  lineaDeTiempo(
    sujetoTipo: string,
    sujetoId: string,
    pagina = 1,
    limite = 50,
  ): Observable<PaginaEventos> {
    return this.http.get<PaginaEventos>(`${this.base}/linea-de-tiempo`, {
      params: new HttpParams()
        .set('sujetoTipo', sujetoTipo)
        .set('sujetoId', sujetoId)
        .set('pagina', pagina)
        .set('limite', limite),
    });
  }
}
