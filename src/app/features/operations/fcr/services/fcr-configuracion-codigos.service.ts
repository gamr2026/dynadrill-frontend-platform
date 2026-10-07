import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type { ClaseOperativa, CodigoClienteFcr, GuardarConfiguracionCodigoInput, KitItem } from '../models/fcr-configuracion-codigos';

/** Respuesta del `PUT`: la fila guardada (sin los datos de la Lista de Precios). */
export interface ConfiguracionCodigoGuardada {
  id: number;
  clienteId: number;
  codigo: string;
  clase: ClaseOperativa;
  kit: KitItem[];
}

/** Configuración por cliente y código de la precarga de herramientas FCR (backend `FcrConfiguracionCodigosController`). */
@Injectable({ providedIn: 'root' })
export class FcrConfiguracionCodigosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operations/fcr/configuracion-codigos`;

  /** Códigos de las listas activas del cliente (sin precios) con su configuración, más las huérfanas. */
  codigosDeCliente(clienteId: number): Observable<CodigoClienteFcr[]> {
    return this.http.get<CodigoClienteFcr[]>(this.base, { params: new HttpParams().set('clienteId', clienteId) });
  }

  guardar(input: GuardarConfiguracionCodigoInput): Observable<ConfiguracionCodigoGuardada> {
    return this.http.put<ConfiguracionCodigoGuardada>(this.base, input);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
