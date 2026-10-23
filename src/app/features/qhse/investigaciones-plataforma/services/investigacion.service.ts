import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  AbrirInvestigacion,
  BandejaInvestigaciones,
  CategoriaIshikawa,
  Conclusion,
  EstadoInvestigacion,
  InvestigacionDetalle,
  NivelControl,
  ResultadoIncidente,
  TipoAccion,
  TipoCausa,
} from '../models/investigacion';

type Detalle = Observable<InvestigacionDetalle>;

/**
 * Investigación de incidentes del contenedor `qhse`. Cada `PUT` de sección reemplaza la sección completa y devuelve la investigación actualizada.
 * La autoridad de las reglas (estados, cierre, congelado, plazos) es el backend y la base de datos.
 */
@Injectable({ providedIn: 'root' })
export class InvestigacionPlataformaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v2/qhse/investigaciones`;

  resultados(): Observable<ResultadoIncidente[]> {
    return this.http.get<ResultadoIncidente[]>(`${this.base}/resultados`);
  }

  categoriasIshikawa(): Observable<CategoriaIshikawa[]> {
    return this.http.get<CategoriaIshikawa[]>(`${this.base}/categorias-ishikawa`);
  }

  listar(
    filtro: { estado?: EstadoInvestigacion; resultado?: string; q?: string } = {},
  ): Observable<BandejaInvestigaciones> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.resultado) params = params.set('resultado', filtro.resultado);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<BandejaInvestigaciones>(this.base, { params });
  }

  detalle(id: string): Detalle {
    return this.http.get<InvestigacionDetalle>(`${this.base}/${id}`);
  }

  abrir(cuerpo: AbrirInvestigacion): Detalle {
    return this.http.post<InvestigacionDetalle>(this.base, cuerpo);
  }

  /** Nombra al líder y registra el momento en que se aseguró la escena: pasa a «en investigación». */
  iniciar(id: string, liderId: string, escenaAseguradaAt?: string): Detalle {
    return this.http.post<InvestigacionDetalle>(`${this.base}/${id}/iniciar`, {
      liderId,
      ...(escenaAseguradaAt ? { escenaAseguradaAt } : {}),
    });
  }

  // ---- secciones del formato (cada una reemplaza la sección completa) ----

  guardarTrabajador(id: string, cuerpo: Record<string, unknown>): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/trabajador`, cuerpo);
  }

  guardarIncidente(id: string, cuerpo: Record<string, unknown>): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/incidente`, cuerpo);
  }

  guardarEquipo(
    id: string,
    miembros: Array<{ usuarioId?: string; nombreExterno?: string }>,
  ): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/equipo`, { miembros });
  }

  guardarTestigos(
    id: string,
    testigos: Array<{ nombresApellidos: string; cedula?: string; version: string }>,
  ): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/testigos`, { testigos });
  }

  guardarEntorno(
    id: string,
    factores: Array<{
      tipo: string;
      fuente: string;
      existeControl: boolean;
      contribuyoAlSuceso: boolean;
    }>,
  ): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/entorno`, { factores });
  }

  guardarEvidencias(
    id: string,
    cuerpo: { evidenciasRecopiladas?: string; testimoniosResumen?: string },
  ): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/evidencias`, cuerpo);
  }

  guardarPorques(id: string, porques: Array<{ pregunta: string; respuesta: string }>): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/porques`, { porques });
  }

  guardarIshikawa(
    id: string,
    causas: Array<{ categoriaId: string; descripcion: string }>,
  ): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/ishikawa`, { causas });
  }

  guardarCausas(id: string, causas: Array<{ tipo: TipoCausa; descripcion: string }>): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/causas`, { causas });
  }

  guardarConclusion(
    id: string,
    cuerpo: { conclusion?: Conclusion; leccionesAprendidas?: string; ipercActividadId?: string },
  ): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/conclusion`, cuerpo);
  }

  guardarNotificacionLegal(
    id: string,
    cuerpo: {
      requerida: boolean;
      ministerioTrabajoNotificadoAt?: string;
      iessNotificadoAt?: string;
    },
  ): Detalle {
    return this.http.put<InvestigacionDetalle>(`${this.base}/${id}/notificacion-legal`, cuerpo);
  }

  // ---- acciones correctivas y preventivas ----

  registrarAccion(
    id: string,
    cuerpo: {
      descripcion: string;
      tipo: TipoAccion;
      responsableId: string;
      plazo: string;
      controles: NivelControl[];
    },
  ): Detalle {
    return this.http.post<InvestigacionDetalle>(`${this.base}/${id}/acciones`, cuerpo);
  }

  implementarAccion(id: string, accionId: string): Detalle {
    return this.http.post<InvestigacionDetalle>(
      `${this.base}/${id}/acciones/${accionId}/implementar`,
      {},
    );
  }

  verificarAccion(id: string, accionId: string, fueEficaz: boolean, observacion?: string): Detalle {
    return this.http.post<InvestigacionDetalle>(
      `${this.base}/${id}/acciones/${accionId}/verificar`,
      {
        fueEficaz,
        ...(observacion ? { observacion } : {}),
      },
    );
  }

  cancelarAccion(id: string, accionId: string, motivo: string): Detalle {
    return this.http.post<InvestigacionDetalle>(
      `${this.base}/${id}/acciones/${accionId}/cancelar`,
      {
        motivo,
      },
    );
  }

  // ---- revisión y cierre ----

  enviarARevision(id: string): Detalle {
    return this.http.post<InvestigacionDetalle>(`${this.base}/${id}/enviar-revision`, {});
  }

  /** El Gerente HSE devuelve el informe al equipo con su observación. */
  devolver(id: string, observacion: string): Detalle {
    return this.http.post<InvestigacionDetalle>(`${this.base}/${id}/devolver`, { observacion });
  }

  /** El Gerente HSE aprueba el informe y cierra la investigación. */
  cerrar(id: string): Detalle {
    return this.http.post<InvestigacionDetalle>(`${this.base}/${id}/cerrar`, {});
  }
}
