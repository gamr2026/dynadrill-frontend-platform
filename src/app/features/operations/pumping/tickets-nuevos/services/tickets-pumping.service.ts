import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  ItemsParaCambio,
  ProponerCambioEntrada,
  SolicitudCambioItems,
} from '../models/cambio-items';
import type {
  AsignacionEntrada,
  PersonaOcupadaTicket,
  ConfirmacionIngreso,
  DocumentoDelTicket,
  FiltroTickets,
  QuimicoEntrada,
  EstadoDiaHerramienta,
  ReporteDiario,
  ReporteHerramientasPumping,
  ReporteDiarioDia,
  ReporteDiarioEntrada,
  QuimicosTicket,
  RequisitoTicket,
  GasIngreso,
  AceptacionOperador,
  IngresoLocacion,
  LlegadaEntrada,
  ReporteUnidad,
  SalidaEntrada,
  TerminosVigentes,
  TicketPumping,
  TicketPumpingResumen,
  UnidadReporte,
} from '../models/ticket-pumping';

/** Tickets de Pumping del contenedor `operaciones`. La autoridad de pasos y permisos es el backend. */
@Injectable({ providedIn: 'root' })
export class TicketsPumpingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/pumping`;

  listar(filtro: FiltroTickets = {}): Observable<TicketPumpingResumen[]> {
    let params = new HttpParams();
    if (filtro.paso) params = params.set('paso', filtro.paso);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    if (filtro.mios) params = params.set('mios', 'true');
    return this.http.get<TicketPumpingResumen[]>(`${this.base}/tickets`, { params });
  }

  detalle(id: string): Observable<TicketPumping> {
    return this.http.get<TicketPumping>(`${this.base}/tickets/${id}`);
  }

  /** Quién ya está en otro ticket sin cerrar con fechas que se cruzan (para la pantalla de asignación). */
  personalOcupado(id: string): Observable<PersonaOcupadaTicket[]> {
    return this.http.get<PersonaOcupadaTicket[]>(`${this.base}/tickets/${id}/personal-ocupado`);
  }

  asignar(id: string, cuerpo: AsignacionEntrada): Observable<TicketPumping> {
    return this.http.post<TicketPumping>(`${this.base}/tickets/${id}/asignar`, cuerpo);
  }

  avanzar(id: string, hacia: string, motivo?: string): Observable<TicketPumping> {
    return this.http.post<TicketPumping>(
      `${this.base}/tickets/${id}/avanzar`,
      motivo?.trim() ? { hacia, motivo: motivo.trim() } : { hacia },
    );
  }

  // ── Cambio de ítems del pedido (propone el Operador, aprueba el Supervisor, aplica Comercial) ──

  /** Los ítems que el pedido tiene hoy en Comercial y, con `q` (2 letras o más), los elegibles de la lista del cliente (sin precios). */
  itemsParaCambio(pedidoId: string, q = ''): Observable<ItemsParaCambio> {
    return this.http.get<ItemsParaCambio>(
      `${environment.apiUrl}/comercial/pedidos/${pedidoId}/items-para-cambio`,
      { params: new HttpParams().set('q', q) },
    );
  }

  cambiosItems(id: string): Observable<SolicitudCambioItems[]> {
    return this.http.get<SolicitudCambioItems[]>(`${this.base}/tickets/${id}/cambios-items`);
  }

  proponerCambioItems(id: string, cuerpo: ProponerCambioEntrada): Observable<SolicitudCambioItems> {
    return this.http.post<SolicitudCambioItems>(`${this.base}/tickets/${id}/cambios-items`, cuerpo);
  }

  /** Bandeja de Aprobaciones: las pendientes de los tickets que supervisa quien consulta. */
  cambiosItemsPendientes(): Observable<SolicitudCambioItems[]> {
    return this.http.get<SolicitudCambioItems[]>(`${this.base}/cambios-items/pendientes`);
  }

  aprobarCambioItems(solicitudId: string): Observable<SolicitudCambioItems> {
    return this.http.post<SolicitudCambioItems>(
      `${this.base}/cambios-items/${solicitudId}/aprobar`,
      {},
    );
  }

  rechazarCambioItems(solicitudId: string, motivo?: string): Observable<SolicitudCambioItems> {
    return this.http.post<SolicitudCambioItems>(
      `${this.base}/cambios-items/${solicitudId}/rechazar`,
      motivo?.trim() ? { motivo: motivo.trim() } : {},
    );
  }

  // ── Documentos del ticket (monitoreo por día) ──

  documentos(id: string): Observable<DocumentoDelTicket[]> {
    return this.http.get<DocumentoDelTicket[]>(`${this.base}/tickets/${id}/documentos`);
  }

  /** El Operador del equipo adjunta el monitoreo de un día (el archivo se sube antes a `archivos`). */
  adjuntarMonitoreo(
    id: string,
    fecha: string,
    archivoId: string,
  ): Observable<DocumentoDelTicket[]> {
    return this.http.post<DocumentoDelTicket[]>(`${this.base}/tickets/${id}/documentos/monitoreo`, {
      fecha,
      archivoId,
    });
  }

  // ── Reporte Diario de Actividades (Reporte Job) ──

  reportesDiarios(id: string): Observable<ReporteDiarioDia[]> {
    return this.http.get<ReporteDiarioDia[]>(`${this.base}/tickets/${id}/reportes-diarios`);
  }

  reporteDiario(id: string, fecha: string): Observable<ReporteDiario> {
    return this.http.get<ReporteDiario>(`${this.base}/tickets/${id}/reportes-diarios/${fecha}`);
  }

  /** Guarda el día como borrador: reemplaza sus actividades y tablas (si estaba completado, lo reabre). */
  guardarReporteDiario(
    id: string,
    fecha: string,
    cuerpo: ReporteDiarioEntrada,
  ): Observable<ReporteDiario> {
    return this.http.put<ReporteDiario>(
      `${this.base}/tickets/${id}/reportes-diarios/${fecha}`,
      cuerpo,
    );
  }

  /** Completa el día y lo envía a Facturación como Reporte Job. */
  completarReporteDiario(id: string, fecha: string): Observable<ReporteDiario> {
    return this.http.post<ReporteDiario>(
      `${this.base}/tickets/${id}/reportes-diarios/${fecha}/completar`,
      {},
    );
  }

  // ── Reporte de Herramientas (las líneas cotizadas del pedido, repartidas por día) ──

  reporteHerramientas(id: string): Observable<ReporteHerramientasPumping> {
    return this.http.get<ReporteHerramientasPumping>(`${this.base}/tickets/${id}/reporte-herramientas`);
  }

  /** Pone la celda de un día de una línea; con `estado = null` la quita. En las líneas que no son por día hay que indicar la cantidad. */
  marcarDiaHerramienta(
    id: string,
    lineaId: string,
    fecha: string,
    estado: EstadoDiaHerramienta | null,
    cantidad?: number,
  ): Observable<ReporteHerramientasPumping> {
    const url = `${this.base}/tickets/${id}/reporte-herramientas/lineas/${lineaId}/dias/${fecha}`;
    return estado === null
      ? this.http.delete<ReporteHerramientasPumping>(url)
      : this.http.put<ReporteHerramientasPumping>(url, { estado, ...(cantidad ? { cantidad } : {}) });
  }

  /** «El reporte está completo»: se envía a Facturación como documento operativo. */
  completarReporteHerramientas(id: string): Observable<ReporteHerramientasPumping> {
    return this.http.post<ReporteHerramientasPumping>(
      `${this.base}/tickets/${id}/reporte-herramientas/completar`,
      {},
    );
  }

  // ── Químicos del ticket (el movimiento vive en Inventario; Pumping solo lo pide) ──

  quimicos(id: string): Observable<QuimicosTicket> {
    return this.http.get<QuimicosTicket>(`${this.base}/tickets/${id}/quimicos`);
  }

  /** El Operador registra lo usado de un químico (solo en la Ejecución operativa). */
  consumirQuimico(id: string, articuloId: string, cantidad: number): Observable<QuimicosTicket> {
    return this.http.post<QuimicosTicket>(`${this.base}/tickets/${id}/quimicos/consumo`, {
      articuloId,
      cantidad,
    });
  }

  /** El Supervisor devuelve a bodega lo que sobró (solo en el Control de retorno). */
  devolverQuimicos(id: string, lineas: QuimicoEntrada[]): Observable<QuimicosTicket> {
    return this.http.post<QuimicosTicket>(`${this.base}/tickets/${id}/quimicos/devolucion`, {
      lineas,
    });
  }

  /** El Supervisor asignado confirma que el Company Man aprobó el inicio (requisito para salir de la Ejecución operativa). */
  formalizarEjecucion(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/tickets/${id}/ejecucion/formalizar`, {});
  }

  /** El Supervisor del equipo aprueba la inspección de una unidad al revisar los reportes de salida. Devuelve los requisitos del ticket. */
  aprobarInspeccion(id: string, unidadId: string): Observable<RequisitoTicket[]> {
    return this.http.post<RequisitoTicket[]>(
      `${this.base}/tickets/${id}/revision-salida/inspecciones/${unidadId}/aprobar`,
      {},
    );
  }

  // ── Traslado de salida ──

  terminosVigentes(): Observable<TerminosVigentes> {
    return this.http.get<TerminosVigentes>(`${this.base}/terminos/vigente`);
  }

  terminos(id: string): Observable<AceptacionOperador[]> {
    return this.http.get<AceptacionOperador[]>(`${this.base}/tickets/${id}/terminos`);
  }

  aceptarTerminos(id: string): Observable<{ versionCodigo: string; aceptadoAt: string }> {
    return this.http.post<{ versionCodigo: string; aceptadoAt: string }>(
      `${this.base}/tickets/${id}/terminos/aceptar`,
      {},
    );
  }

  ingreso(id: string): Observable<IngresoLocacion> {
    return this.http.get<IngresoLocacion>(`${this.base}/tickets/${id}/ingreso`);
  }

  actualizarIngreso(
    id: string,
    cambios: Partial<Record<ConfirmacionIngreso, boolean>> & {
      nuevaLectura?: { gas: GasIngreso; lectura: number };
    },
  ): Observable<IngresoLocacion> {
    return this.http.patch<IngresoLocacion>(`${this.base}/tickets/${id}/ingreso`, cambios);
  }

  alternarLoto(id: string, itemId: string): Observable<IngresoLocacion> {
    return this.http.patch<IngresoLocacion>(
      `${this.base}/tickets/${id}/ingreso/loto/${itemId}`,
      {},
    );
  }

  unidadesReporte(id: string): Observable<UnidadReporte[]> {
    return this.http.get<UnidadReporte[]>(`${this.base}/tickets/${id}/reportes-unidad`);
  }

  reporteUnidad(id: string, unidadId: string): Observable<ReporteUnidad> {
    return this.http.get<ReporteUnidad>(`${this.base}/tickets/${id}/reportes-unidad/${unidadId}`);
  }

  guardarSalida(id: string, unidadId: string, cuerpo: SalidaEntrada): Observable<ReporteUnidad> {
    return this.http.put<ReporteUnidad>(
      `${this.base}/tickets/${id}/reportes-unidad/${unidadId}/salida`,
      cuerpo,
    );
  }

  /** El operador de la unidad firma su reporte de llegada (solo en el Traslado de llegada). */
  guardarLlegada(id: string, unidadId: string, cuerpo: LlegadaEntrada): Observable<ReporteUnidad> {
    return this.http.put<ReporteUnidad>(
      `${this.base}/tickets/${id}/reportes-unidad/${unidadId}/llegada`,
      cuerpo,
    );
  }

  /** PUENTE TEMPORAL: confirma a mano un requisito de un módulo que aún no existe (QHSE, Mantenimiento). */
  cumplirRequisitoManual(requisitoId: string, motivo: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/requisitos/${requisitoId}/cumplir-manual`,
      { motivo },
    );
  }
}
