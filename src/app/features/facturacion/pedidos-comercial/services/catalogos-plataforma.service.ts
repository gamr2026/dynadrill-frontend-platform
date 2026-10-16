import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  BloquePlataforma,
  BodegaPlataforma,
  CampoPlataforma,
  ChoferPlataforma,
  ClientePlataforma,
  CondicionPagoPlataforma,
  PersonaPlataforma,
  PozoPlataforma,
  TaladroPlataforma,
  TipoIdentificacionTransporte,
  TipoVehiculoPlataforma,
  TipoPersonaPlataforma,
  TransportistaPlataforma,
  VehiculoPlataforma,
} from '../models/catalogos-plataforma.model';

/**
 * Catálogos del backend nuevo (el gateway enruta `/api/v2/catalogos/*` a plataforma). El `CatalogosService` compartido
 * sigue apuntando a `/api/catalogos` (demo, ids numéricos) para las pantallas que aún no migran.
 */
@Injectable({ providedIn: 'root' })
export class CatalogosPlataformaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/v2/catalogos`;

  bodegas(): Observable<BodegaPlataforma[]> {
    return this.http.get<BodegaPlataforma[]>(`${this.base}/bodegas`);
  }

  condicionesPago(): Observable<CondicionPagoPlataforma[]> {
    return this.http.get<CondicionPagoPlataforma[]>(`${this.base}/condiciones-pago`);
  }

  clientes(): Observable<ClientePlataforma[]> {
    return this.http.get<ClientePlataforma[]>(`${this.base}/clientes`);
  }

  personas(tipo?: TipoPersonaPlataforma): Observable<PersonaPlataforma[]> {
    let params = new HttpParams();
    if (tipo) params = params.set('tipo', tipo);
    return this.http.get<PersonaPlataforma[]>(`${this.base}/personas`, { params });
  }

  campos(): Observable<CampoPlataforma[]> {
    return this.http.get<CampoPlataforma[]>(`${this.base}/campos`);
  }

  bloques(): Observable<BloquePlataforma[]> {
    return this.http.get<BloquePlataforma[]>(`${this.base}/bloques`);
  }

  taladros(): Observable<TaladroPlataforma[]> {
    return this.http.get<TaladroPlataforma[]>(`${this.base}/taladros`);
  }

  /** El pozo trae su campo y su bloque anidados. */
  pozos(filtro?: { campoId?: string; bloqueId?: string }): Observable<PozoPlataforma[]> {
    let params = new HttpParams();
    if (filtro?.campoId) params = params.set('campoId', filtro.campoId);
    if (filtro?.bloqueId) params = params.set('bloqueId', filtro.bloqueId);
    return this.http.get<PozoPlataforma[]>(`${this.base}/pozos`, { params });
  }

  // ---- transporte (guía de remisión) --------------------------------------------------------------------------

  transportistas(): Observable<TransportistaPlataforma[]> {
    return this.http.get<TransportistaPlataforma[]>(`${this.base}/transportistas`);
  }

  crearTransportista(d: { nombreFiscal: string; tipoIdentificacion: TipoIdentificacionTransporte; identificacion: string }): Observable<TransportistaPlataforma> {
    return this.http.post<TransportistaPlataforma>(`${this.base}/transportistas`, d);
  }

  vehiculos(transportistaId?: string): Observable<VehiculoPlataforma[]> {
    let params = new HttpParams();
    if (transportistaId) params = params.set('transportistaId', transportistaId);
    return this.http.get<VehiculoPlataforma[]>(`${this.base}/vehiculos`, { params });
  }

  tiposVehiculo(): Observable<TipoVehiculoPlataforma[]> {
    return this.http.get<TipoVehiculoPlataforma[]>(`${this.base}/tipos-vehiculo`);
  }

  crearTipoVehiculo(nombre: string): Observable<TipoVehiculoPlataforma> {
    return this.http.post<TipoVehiculoPlataforma>(`${this.base}/tipos-vehiculo`, { nombre });
  }

  crearVehiculo(d: { placa: string; transportistaId: string; tipoVehiculoId?: string; marca?: string; modelo?: string; anio?: number }): Observable<VehiculoPlataforma> {
    return this.http.post<VehiculoPlataforma>(`${this.base}/vehiculos`, d);
  }

  choferes(transportistaId?: string): Observable<ChoferPlataforma[]> {
    let params = new HttpParams();
    if (transportistaId) params = params.set('transportistaId', transportistaId);
    return this.http.get<ChoferPlataforma[]>(`${this.base}/choferes`, { params });
  }

  crearChofer(d: { transportistaId: string; licencia: string; nombre: string }): Observable<ChoferPlataforma> {
    return this.http.post<ChoferPlataforma>(`${this.base}/choferes`, d);
  }
}
