import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  EncuestaDetalle,
  EncuestaPublica,
  EncuestaResumen,
  EscalaEncuesta,
  FiltroInvitaciones,
  InvitacionDetalle,
  InvitacionesPagina,
  ModuloEncuesta,
  PreguntaEntrada,
  ResponderEntrada,
  VersionDetalle,
} from '../models/encuestas.model';

/** Encuestas de la plataforma: administración (Superadmin) y formulario público del cliente. */
@Injectable({ providedIn: 'root' })
export class EncuestasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/encuestas`;

  // ── Administración ──

  modulos(): Observable<ModuloEncuesta[]> {
    return this.http.get<ModuloEncuesta[]>(`${this.base}/modulos`);
  }

  escalas(): Observable<EscalaEncuesta[]> {
    return this.http.get<EscalaEncuesta[]>(`${this.base}/escalas`);
  }

  listar(modulo?: string): Observable<EncuestaResumen[]> {
    const params = modulo ? new HttpParams().set('modulo', modulo) : new HttpParams();
    return this.http.get<EncuestaResumen[]>(this.base, { params });
  }

  obtener(id: string): Observable<EncuestaDetalle> {
    return this.http.get<EncuestaDetalle>(`${this.base}/${id}`);
  }

  crear(cuerpo: { codigo: string; nombre: string; moduloCodigo: string }): Observable<unknown> {
    return this.http.post(this.base, cuerpo);
  }

  actualizar(id: string, cuerpo: { nombre?: string; activa?: boolean }): Observable<unknown> {
    return this.http.patch(`${this.base}/${id}`, cuerpo);
  }

  /** Abre un borrador a partir de la versión vigente (una versión publicada no se edita). */
  crearBorrador(id: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/${id}/borrador`, {});
  }

  version(versionId: string): Observable<VersionDetalle> {
    return this.http.get<VersionDetalle>(`${this.base}/versiones/${versionId}`);
  }

  editarBorrador(
    versionId: string,
    cuerpo: { titulo?: string; introduccion?: string | null },
  ): Observable<VersionDetalle> {
    return this.http.patch<VersionDetalle>(`${this.base}/versiones/${versionId}`, cuerpo);
  }

  reemplazarPreguntas(versionId: string, preguntas: PreguntaEntrada[]): Observable<VersionDetalle> {
    return this.http.put<VersionDetalle>(`${this.base}/versiones/${versionId}/preguntas`, {
      preguntas,
    });
  }

  publicar(versionId: string): Observable<unknown> {
    return this.http.post(`${this.base}/versiones/${versionId}/publicar`, {});
  }

  // ── Lo enviado y lo respondido ──

  invitaciones(filtro: FiltroInvitaciones = {}): Observable<InvitacionesPagina> {
    let params = new HttpParams();
    if (filtro.encuestaId) params = params.set('encuestaId', filtro.encuestaId);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.limite) params = params.set('limite', filtro.limite);
    if (filtro.desplazamiento) params = params.set('desplazamiento', filtro.desplazamiento);
    return this.http.get<InvitacionesPagina>(`${this.base}/invitaciones`, { params });
  }

  invitacion(id: string): Observable<InvitacionDetalle> {
    return this.http.get<InvitacionDetalle>(`${this.base}/invitaciones/${id}`);
  }

  /** Reenvía una encuesta sin responder, con un enlace nuevo. */
  reenviar(
    id: string,
  ): Observable<{ id: string; venceAt: string; correoDestino: string; enviada: boolean }> {
    return this.http.post<{ id: string; venceAt: string; correoDestino: string; enviada: boolean }>(
      `${this.base}/invitaciones/${id}/reenviar`,
      {},
    );
  }

  // ── Formulario público (sin sesión: el token del enlace es lo que autoriza) ──

  publica(token: string): Observable<EncuestaPublica> {
    return this.http.get<EncuestaPublica>(`${this.base}/publico/${encodeURIComponent(token)}`);
  }

  responder(token: string, cuerpo: ResponderEntrada): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.post<{ ok: boolean; mensaje: string }>(
      `${this.base}/publico/${encodeURIComponent(token)}`,
      cuerpo,
    );
  }
}
