import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '@env';
import { ArchivosService } from '../../../facturacion/pedidos-comercial/services/archivos.service';
import {
  MODULO_ARCHIVO_DESECHO,
  type CatalogosDesecho,
  type DesechoDetalle,
  type DesechoResumen,
  type EstadoDesecho,
  type FiltroVencimiento,
  type GenerarManifiesto,
  type GuiaDesecho,
  type RegistrarDesecho,
  type RolFirma,
  type TableroDesechos,
  type TipoDocumentoDesecho,
} from '../models/desecho';

/** Desechos del contenedor `qhse`. La autoridad de las reglas y de los permisos es el backend (y la base de datos). */
@Injectable({ providedIn: 'root' })
export class DesechoService {
  private readonly http = inject(HttpClient);
  private readonly archivos = inject(ArchivosService);
  private readonly base = `${environment.apiUrl}/v2/qhse/desechos`;

  /** Características CRETIB, contenedores por color y pozos para el formulario de registro (lo usa cualquier trabajador). */
  catalogos(): Observable<CatalogosDesecho> {
    return this.http.get<CatalogosDesecho>(`${this.base}/catalogos`);
  }

  /** Registra el desecho (cualquier trabajador). Devuelve solo lo mínimo: quien reporta puede no tener permiso de ver. */
  registrar(
    cuerpo: RegistrarDesecho,
  ): Observable<{ id: string; codigo: string; estado: EstadoDesecho }> {
    return this.http.post<{ id: string; codigo: string; estado: EstadoDesecho }>(this.base, cuerpo);
  }

  listar(
    filtro: { estado?: EstadoDesecho; vencimiento?: FiltroVencimiento; q?: string } = {},
  ): Observable<DesechoResumen[]> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.vencimiento) params = params.set('vencimiento', filtro.vencimiento);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    return this.http.get<DesechoResumen[]>(this.base, { params });
  }

  /** Tablero: por estado, por vencer, vencidos y galones sin disponer. */
  tablero(): Observable<TableroDesechos> {
    return this.http.get<TableroDesechos>(`${this.base}/resumen`);
  }

  detalle(id: string): Observable<DesechoDetalle> {
    return this.http.get<DesechoDetalle>(`${this.base}/${id}`);
  }

  /** Genera el manifiesto único (pasa el desecho a «con manifiesto»); el transporte, las horas y el cliente van en este paso. */
  generarManifiesto(id: string, cuerpo: GenerarManifiesto): Observable<DesechoDetalle> {
    return this.http.post<DesechoDetalle>(`${this.base}/${id}/manifiesto`, cuerpo);
  }

  /** Completa el transporte y las horas de la guía mientras falten firmas. */
  actualizarGuia(id: string, cuerpo: GuiaDesecho): Observable<DesechoDetalle> {
    return this.http.patch<DesechoDetalle>(`${this.base}/${id}/manifiesto`, cuerpo);
  }

  /** «Despachado por» firma con la cuenta; «transportado por» y «recibido por» llevan el nombre y la cédula de quien firma en papel. */
  firmar(
    id: string,
    rol: RolFirma,
    firmante?: { firmanteNombre: string; firmanteCedula: string },
  ): Observable<DesechoDetalle> {
    return this.http.post<DesechoDetalle>(`${this.base}/${id}/manifiesto/firmas`, {
      rol,
      ...(firmante ?? {}),
    });
  }

  /** Sube el manifiesto firmado al servicio de archivos y lo enlaza al desecho, en dos pasos. Se lee la firma con el OCR de plataforma. */
  cargarManifiestoFirmado(
    id: string,
    archivo: File,
    referencia?: string,
  ): Observable<DesechoDetalle> {
    return this.archivos.subir(archivo, MODULO_ARCHIVO_DESECHO).pipe(
      switchMap((a) =>
        this.http.post<DesechoDetalle>(`${this.base}/${id}/manifiesto/documento`, {
          archivoId: a.id,
          ...(referencia?.trim() ? { referencia: referencia.trim() } : {}),
        }),
      ),
    );
  }

  /** Sube el certificado de disposición final y cierra el ciclo (el desecho pasa a «dispuesto»). */
  registrarCertificado(
    id: string,
    archivo: File,
    emitidoEl: string,
    referencia?: string,
  ): Observable<DesechoDetalle> {
    return this.archivos.subir(archivo, MODULO_ARCHIVO_DESECHO).pipe(
      switchMap((a) =>
        this.http.post<DesechoDetalle>(`${this.base}/${id}/certificado`, {
          archivoId: a.id,
          emitidoEl,
          ...(referencia?.trim() ? { referencia: referencia.trim() } : {}),
        }),
      ),
    );
  }

  /** Vuelve a leer la firma de un documento ya cargado (solo un indicador; no certifica nada). */
  verificar(id: string, tipo: TipoDocumentoDesecho): Observable<DesechoDetalle> {
    return this.http.post<DesechoDetalle>(`${this.base}/${id}/documentos/verificar`, { tipo });
  }

  /** El contenido del archivo exige el token: se baja como blob. */
  abrir(archivoId: string): Observable<Blob> {
    return this.archivos.contenido(archivoId);
  }
}
