import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { Bloque, Campo, ClienteCatalogo, PersonaContacto, Pozo, Taladro, TipoPersonaContacto } from '../models/catalogos.model';
import { environment } from '@env';

/** Catálogos de ubicación operativa (Campo / Bloque / Taladro / Pozo). */
@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalogos`;

  bloques(): Observable<Bloque[]> {
    return this.http.get<Bloque[]>(`${this.base}/bloques`);
  }

  campos(): Observable<Campo[]> {
    return this.http.get<Campo[]>(`${this.base}/campos`);
  }

  taladros(): Observable<Taladro[]> {
    return this.http.get<Taladro[]>(`${this.base}/taladros`);
  }

  /** El pozo viene con su campo y su bloque anidados. Filtro opcional para las cascadas. */
  pozos(filtro?: { campoId?: number; bloqueId?: number }): Observable<Pozo[]> {
    let params = new HttpParams();
    if (filtro?.campoId) params = params.set('campoId', filtro.campoId);
    if (filtro?.bloqueId) params = params.set('bloqueId', filtro.bloqueId);
    return this.http.get<Pozo[]>(`${this.base}/pozos`, { params });
  }

  // ── Personas de contacto de un Pedido (FACT-001) — representante_campo (= Company Man),
  // representante_quito, analista_facturacion, agente_comercial. Escritura solo Ventas. ──

  personas(tipo?: TipoPersonaContacto): Observable<PersonaContacto[]> {
    let params = new HttpParams();
    if (tipo) params = params.set('tipo', tipo);
    return this.http.get<PersonaContacto[]>(`${this.base}/personas`, { params });
  }

  crearPersona(input: { tipo: TipoPersonaContacto; nombre: string }): Observable<PersonaContacto> {
    return this.http.post<PersonaContacto>(`${this.base}/personas`, input);
  }

  actualizarPersona(id: number, input: Partial<{ nombre: string; activo: boolean }>): Observable<PersonaContacto> {
    return this.http.put<PersonaContacto>(`${this.base}/personas/${id}`, input);
  }

  eliminarPersona(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/personas/${id}`);
  }

  // ── Clientes — reemplaza el array CLIENTES hardcodeado del frontend. Escritura solo Ventas. ──

  clientes(): Observable<ClienteCatalogo[]> {
    return this.http.get<ClienteCatalogo[]>(`${this.base}/clientes`);
  }

  crearCliente(input: Omit<ClienteCatalogo, 'id' | 'activo'>): Observable<ClienteCatalogo> {
    return this.http.post<ClienteCatalogo>(`${this.base}/clientes`, input);
  }

  actualizarCliente(id: number, input: Partial<Omit<ClienteCatalogo, 'id'>>): Observable<ClienteCatalogo> {
    return this.http.put<ClienteCatalogo>(`${this.base}/clientes/${id}`, input);
  }

  eliminarCliente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/clientes/${id}`);
  }
}
