import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from '@env';
import type {
  AvanceDocumental,
  CorregirDiaEntrada,
  DocumentoOperativo,
  TipoDocumentoOperativo,
} from '../models/documentos-operativos';
import type {
  ActualizarPedidoRequest,
  CatalogoServicios,
  CatalogoTipoOt,
  CrearPedidoRequest,
  EstadoCatalogo,
  FilaPlantilla,
  FiltrosPedidos,
  PedidoDetalle,
  PedidosPagina,
  PedidoCreadoDesdeAs2,
  ResultadoImportarLineas,
  ResultadoValidarPlantilla,
  VinculoAs2,
} from '../models/pedido-comercial.model';

/** Arma los parámetros de consulta omitiendo los vacíos (`null`, `undefined`, cadenas en blanco, listas vacías). */
export function construirParametros(
  valores: Record<string, string | number | boolean | readonly string[] | null | undefined>,
): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor === null || valor === undefined) continue;
    if (Array.isArray(valor)) {
      if (valor.length) params = params.set(clave, valor.join(','));
      continue;
    }
    const texto = String(valor).trim();
    if (texto) params = params.set(clave, texto);
  }
  return params;
}

/**
 * Pedidos del contenedor `comercial` (backend nuevo, por el gateway). La autoridad de los pasos de estado, los permisos
 * y las validaciones es el backend: este servicio solo transporta.
 */
@Injectable({ providedIn: 'root' })
export class PedidosComercialService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/comercial/pedidos`;

  listar(filtros: FiltrosPedidos = {}): Observable<PedidosPagina> {
    const params = construirParametros({
      estado: filtros.estado,
      estados: filtros.estados,
      linea: filtros.linea,
      origen: filtros.origen,
      clienteId: filtros.clienteId,
      q: filtros.q,
      sinAnalista: filtros.sinAnalista ? 'true' : null,
      as2Sync: filtros.as2Sync,
      page: filtros.page,
      limit: filtros.limit,
    });
    return this.http.get<PedidosPagina>(this.base, { params });
  }

  /** Catálogo de estados (nombre, macro-estado y responsable) para etiquetas y filtros. */
  estados(): Observable<EstadoCatalogo[]> {
    return this.http.get<EstadoCatalogo[]>(`${this.base}/estados`);
  }

  /** Líneas, tipos y subtipos de servicio (catálogo en base de datos; un subtipo pertenece a un tipo). */
  catalogoServicios(): Observable<CatalogoServicios> {
    return this.http.get<CatalogoServicios>(`${this.base}/catalogo-servicios`);
  }

  /** Tipos de OT (catálogo en base de datos). */
  tiposOt(): Observable<CatalogoTipoOt[]> {
    return this.http.get<CatalogoTipoOt[]>(`${this.base}/tipos-ot`);
  }

  /** Qué pedidos de AS2 ya existen en el portal (máximo 100 ids por consulta). */
  vinculosAs2(ids: readonly number[]): Observable<VinculoAs2[]> {
    if (ids.length === 0) return of([]);
    return this.http.get<VinculoAs2[]>(`${this.base}/vinculos-as2`, {
      params: { ids: ids.slice(0, 100).join(',') },
    });
  }

  /** Valida las filas del Excel contra la lista de precios del cliente; no guarda nada. */
  validarPlantilla(
    clienteId: string,
    filas: readonly FilaPlantilla[],
  ): Observable<ResultadoValidarPlantilla> {
    return this.http.post<ResultadoValidarPlantilla>(`${this.base}/validar-plantilla`, {
      clienteId,
      filas,
    });
  }

  /** Toma un pedido de AS2 y lo deja "por completar" (borrador) en el portal. */
  desdeAs2(as2IdPedidoCliente: number): Observable<PedidoCreadoDesdeAs2> {
    return this.http.post<PedidoCreadoDesdeAs2>(`${this.base}/desde-as2`, { as2IdPedidoCliente });
  }

  detalle(id: string): Observable<PedidoDetalle> {
    return this.http.get<PedidoDetalle>(`${this.base}/${id}`);
  }

  crear(cuerpo: CrearPedidoRequest): Observable<PedidoDetalle> {
    return this.http.post<PedidoDetalle>(this.base, cuerpo);
  }

  editar(id: string, cuerpo: ActualizarPedidoRequest): Observable<PedidoDetalle> {
    return this.http.put<PedidoDetalle>(`${this.base}/${id}`, cuerpo);
  }

  /** Valida que esté completo, le da su código (el número de AS2, `PEC-…`) y abre el pedido. */
  abrir(id: string): Observable<PedidoDetalle> {
    return this.http.post<PedidoDetalle>(`${this.base}/${id}/abrir`, {});
  }

  anular(id: string, motivo: string): Observable<PedidoDetalle> {
    return this.http.post<PedidoDetalle>(`${this.base}/${id}/anular`, { motivo });
  }

  /** Facturación devuelve el pedido a Ventas para corrección. */
  rechazar(id: string, motivo: string): Observable<PedidoDetalle> {
    return this.http.post<PedidoDetalle>(`${this.base}/${id}/rechazar`, { motivo });
  }

  /** Paso entre estados; `forzar` solo lo acepta el backend para quien tenga `comercial.pedidos.forzar_estado`. */
  transicionar(
    id: string,
    estado: string,
    motivo?: string,
    forzar = false,
  ): Observable<PedidoDetalle> {
    const cuerpo: { estado: string; motivo?: string; forzar?: boolean } = { estado };
    if (motivo?.trim()) cuerpo.motivo = motivo.trim();
    if (forzar) cuerpo.forzar = true;
    return this.http.post<PedidoDetalle>(`${this.base}/${id}/transiciones`, cuerpo);
  }

  asignarAnalista(id: string, analistaId: string): Observable<PedidoDetalle> {
    return this.http.post<PedidoDetalle>(`${this.base}/${id}/asignar-analista`, { analistaId });
  }

  vincularAs2(id: string, as2IdPedidoCliente: number): Observable<PedidoDetalle> {
    return this.http.post<PedidoDetalle>(`${this.base}/${id}/vincular-as2`, { as2IdPedidoCliente });
  }

  /** Documentos operativos que envió Operaciones (solo lectura); `tipo` filtra. */
  documentosOperativos(
    id: string,
    tipo?: TipoDocumentoOperativo,
  ): Observable<DocumentoOperativo[]> {
    return this.http.get<DocumentoOperativo[]>(`${this.base}/${id}/documentos-operativos`, {
      params: construirParametros({ tipo }),
    });
  }

  avanceDocumental(id: string): Observable<AvanceDocumental> {
    return this.http.get<AvanceDocumental>(`${this.base}/${id}/documentos-operativos/avance`);
  }

  /** Facturación corrige las actividades de un día del Reporte Job (hasta que el pedido sale para firmas). */
  corregirDiaOperativo(
    id: string,
    cuerpo: CorregirDiaEntrada,
  ): Observable<{ documentoId: string | null; avance: AvanceDocumental }> {
    return this.http.put<{ documentoId: string | null; avance: AvanceDocumental }>(
      `${this.base}/${id}/documentos-operativos/dia`,
      cuerpo,
    );
  }

  /** Solo con `comercial.documentos_operativos.eliminar` y mientras el pedido siga en etapa de documentos. */
  eliminarDocumentoOperativo(id: string, documentoId: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}/documentos-operativos/${documentoId}`);
  }

  /** Adjunta un archivo ya subido (lo debe haber subido la misma persona). Devuelve el detalle completo. */
  adjuntarDocumento(id: string, archivoId: string): Observable<PedidoDetalle> {
    return this.http.post<PedidoDetalle>(`${this.base}/${id}/documentos`, { archivoId });
  }

  /** Quita el adjunto (y da de baja el archivo). `documentoId` es el id del adjunto. */
  quitarDocumento(id: string, documentoId: string): Observable<PedidoDetalle> {
    return this.http.delete<PedidoDetalle>(`${this.base}/${id}/documentos/${documentoId}`);
  }

  importarLineasAs2(id: string): Observable<ResultadoImportarLineas> {
    return this.http.post<ResultadoImportarLineas>(`${this.base}/${id}/importar-lineas-as2`, {});
  }
}
