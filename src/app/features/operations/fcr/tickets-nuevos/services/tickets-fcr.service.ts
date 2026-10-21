import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import type {
  ItemsParaCambio,
  ProponerCambioEntrada,
  SolicitudCambioItems,
} from '../../../pumping/tickets-nuevos/models/cambio-items';
import type {
  ActaReunion,
  AgregarItemReporteEntrada,
  ActividadBitacora,
  BitacoraTicket,
  CampoDocumento,
  CatalogosFcr,
  CausaFaltante,
  DiaBitacoraDetalle,
  DocumentoTicket,
  EstadoDiaReporte,
  EstadoUso,
  FiltroTickets,
  HerramientaDisponible,
  HerramientaPendiente,
  HerramientasTicket,
  InspeccionHerramienta,
  LlegadaEntrada,
  OpcionItemLista,
  PickerEntrada,
  ReporteHerramientas,
  ResponsableTrabajo,
  ResultadoParte,
  ResumenInspeccion,
  RolFirma,
  TicketFcr,
  TicketFcrResumen,
  UnidadLlegada,
  UsoTicket,
} from '../models/ticket-fcr';

/** Tickets de FCR del contenedor `operaciones`. La autoridad de pasos, roles y requisitos es el backend. */
@Injectable({ providedIn: 'root' })
export class TicketsFcrService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/operaciones/fcr`;
  private readonly t = (id: string) => `${this.base}/tickets/${id}`;

  catalogos(): Observable<CatalogosFcr> {
    return this.http.get<CatalogosFcr>(`${this.base}/catalogos`);
  }

  listar(filtro: FiltroTickets = {}): Observable<TicketFcrResumen[]> {
    let params = new HttpParams();
    if (filtro.paso) params = params.set('paso', filtro.paso);
    if (filtro.q?.trim()) params = params.set('q', filtro.q.trim());
    if (filtro.mios) params = params.set('mios', 'true');
    return this.http.get<TicketFcrResumen[]>(`${this.base}/tickets`, { params });
  }

  detalle(id: string): Observable<TicketFcr> {
    return this.http.get<TicketFcr>(this.t(id));
  }

  avanzar(id: string, hacia: string, motivo?: string): Observable<TicketFcr> {
    return this.http.post<TicketFcr>(
      `${this.t(id)}/avanzar`,
      motivo?.trim() ? { hacia, motivo: motivo.trim() } : { hacia },
    );
  }

  definirTipoOperador(
    id: string,
    tipoOperadorId: string,
    inspectorId: string,
  ): Observable<TicketFcr> {
    return this.http.post<TicketFcr>(`${this.t(id)}/tipo-operador`, {
      tipoOperadorId,
      inspectorId,
    });
  }

  asignar(
    id: string,
    cuerpo: {
      supervisorId?: string;
      operadores: Array<{ usuarioId: string; vehiculoId?: string }>;
    },
  ): Observable<TicketFcr> {
    return this.http.post<TicketFcr>(`${this.t(id)}/asignar`, cuerpo);
  }

  /** PUENTE TEMPORAL: confirma a mano un requisito de otro módulo que aún no publica su evento. */
  cumplirRequisitoManual(requisitoId: string, motivo: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/requisitos/${requisitoId}/cumplir`, {
      motivo: motivo.trim(),
    });
  }

  // ── Herramientas ──

  herramientas(id: string): Observable<HerramientasTicket> {
    return this.http.get<HerramientasTicket>(`${this.t(id)}/herramientas`);
  }
  herramientasDisponibles(q: string): Observable<HerramientaDisponible[]> {
    return this.http.get<HerramientaDisponible[]>(`${this.base}/herramientas-disponibles`, {
      params: new HttpParams().set('q', q),
    });
  }
  agregarHerramienta(id: string, articuloId: string): Observable<HerramientasTicket> {
    return this.http.post<HerramientasTicket>(`${this.t(id)}/herramientas`, { articuloId });
  }
  quitarHerramienta(id: string, herramientaId: string): Observable<HerramientasTicket> {
    return this.http.delete<HerramientasTicket>(`${this.t(id)}/herramientas/${herramientaId}`);
  }
  recargarHerramientas(id: string): Observable<HerramientasTicket> {
    return this.http.post<HerramientasTicket>(`${this.t(id)}/herramientas/recargar`, {});
  }
  solicitarHerramientas(id: string, herramientaIds?: string[]): Observable<HerramientasTicket> {
    return this.http.post<HerramientasTicket>(
      `${this.t(id)}/herramientas/solicitar`,
      herramientaIds?.length ? { herramientaIds } : {},
    );
  }
  confirmarListado(id: string, confirmado: boolean): Observable<HerramientasTicket> {
    return this.http.post<HerramientasTicket>(`${this.t(id)}/herramientas/confirmar-listado`, {
      confirmado,
    });
  }
  recibirHerramienta(
    id: string,
    herramientaId: string,
    novedad?: string,
  ): Observable<HerramientasTicket> {
    return this.http.post<HerramientasTicket>(
      `${this.t(id)}/herramientas/${herramientaId}/recibir`,
      novedad?.trim() ? { novedad: novedad.trim() } : {},
    );
  }
  corregirRecepcion(id: string, herramientaId: string): Observable<HerramientasTicket> {
    return this.http.delete<HerramientasTicket>(
      `${this.t(id)}/herramientas/${herramientaId}/recepcion`,
    );
  }
  prepararHerramienta(
    id: string,
    herramientaId: string,
    novedad?: string,
  ): Observable<HerramientasTicket> {
    return this.http.post<HerramientasTicket>(
      `${this.t(id)}/herramientas/${herramientaId}/preparar`,
      novedad?.trim() ? { novedad: novedad.trim() } : {},
    );
  }
  corregirPreparacion(id: string, herramientaId: string): Observable<HerramientasTicket> {
    return this.http.delete<HerramientasTicket>(
      `${this.t(id)}/herramientas/${herramientaId}/preparacion`,
    );
  }
  enviarHerramienta(id: string, herramientaId: string): Observable<HerramientasTicket> {
    return this.http.post<HerramientasTicket>(
      `${this.t(id)}/herramientas/${herramientaId}/enviar`,
      {},
    );
  }
  pendientesDeBodega(): Observable<HerramientaPendiente[]> {
    return this.http.get<HerramientaPendiente[]>(`${this.base}/herramientas/pendientes-de-bodega`);
  }
  pendientesDeRetorno(): Observable<HerramientaPendiente[]> {
    return this.http.get<HerramientaPendiente[]>(`${this.base}/herramientas/pendientes-de-retorno`);
  }
  devolverHerramientas(id: string, herramientaIds?: string[]): Observable<HerramientasTicket> {
    return this.http.post<HerramientasTicket>(
      `${this.t(id)}/herramientas/devolver`,
      herramientaIds?.length ? { herramientaIds } : {},
    );
  }
  herramientaFaltante(
    id: string,
    herramientaId: string,
    causa: CausaFaltante,
    detalle: string,
  ): Observable<HerramientasTicket> {
    return this.http.post<HerramientasTicket>(
      `${this.t(id)}/herramientas/${herramientaId}/faltante`,
      { causa, detalle: detalle.trim() },
    );
  }

  // ── Inspección (entrada SERVICIOS) ──

  inspecciones(id: string): Observable<ResumenInspeccion[]> {
    return this.http.get<ResumenInspeccion[]>(`${this.t(id)}/inspecciones`);
  }
  inspeccion(id: string, inspeccionId: string): Observable<InspeccionHerramienta> {
    return this.http.get<InspeccionHerramienta>(`${this.t(id)}/inspecciones/${inspeccionId}`);
  }
  iniciarInspeccion(id: string, herramientaId: string): Observable<InspeccionHerramienta> {
    return this.http.post<InspeccionHerramienta>(
      `${this.t(id)}/herramientas/${herramientaId}/inspeccion`,
      {},
    );
  }
  guardarEncabezado(
    id: string,
    inspeccionId: string,
    cuerpo: {
      fechaInspeccion?: string;
      fechaEnvio?: string;
      inspeccionadoPor?: ResponsableTrabajo;
      reparadoPor?: ResponsableTrabajo;
      observaciones?: string;
      numeroSerie?: string;
    },
  ): Observable<InspeccionHerramienta> {
    return this.http.put<InspeccionHerramienta>(
      `${this.t(id)}/inspecciones/${inspeccionId}`,
      cuerpo,
    );
  }
  guardarParte(
    id: string,
    inspeccionId: string,
    parteId: string,
    cuerpo: {
      visual?: ResultadoParte;
      endResultado?: ResultadoParte;
      cambioCantidad?: number;
      accion?: string;
    },
  ): Observable<InspeccionHerramienta> {
    return this.http.put<InspeccionHerramienta>(
      `${this.t(id)}/inspecciones/${inspeccionId}/partes/${parteId}`,
      cuerpo,
    );
  }
  agregarParte(
    id: string,
    inspeccionId: string,
    cuerpo: { descripcion: string; codigo?: string; cantidadEsperada?: number },
  ): Observable<InspeccionHerramienta> {
    return this.http.post<InspeccionHerramienta>(
      `${this.t(id)}/inspecciones/${inspeccionId}/partes`,
      cuerpo,
    );
  }
  quitarParte(
    id: string,
    inspeccionId: string,
    parteId: string,
  ): Observable<InspeccionHerramienta> {
    return this.http.delete<InspeccionHerramienta>(
      `${this.t(id)}/inspecciones/${inspeccionId}/partes/${parteId}`,
    );
  }
  firmar(id: string, inspeccionId: string, rol: RolFirma): Observable<InspeccionHerramienta> {
    return this.http.post<InspeccionHerramienta>(
      `${this.t(id)}/inspecciones/${inspeccionId}/firmas/${rol}`,
      {},
    );
  }
  enviarInspeccion(id: string, inspeccionId: string): Observable<InspeccionHerramienta> {
    return this.http.post<InspeccionHerramienta>(
      `${this.t(id)}/inspecciones/${inspeccionId}/enviar`,
      {},
    );
  }
  aprobarInspecciones(id: string): Observable<TicketFcr> {
    return this.http.post<TicketFcr>(`${this.t(id)}/aprobar-inspecciones`, {});
  }
  rechazarInspecciones(
    id: string,
    motivo: string,
    herramientaIds?: string[],
  ): Observable<TicketFcr> {
    return this.http.post<TicketFcr>(
      `${this.t(id)}/rechazar-inspecciones`,
      herramientaIds?.length
        ? { motivo: motivo.trim(), herramientaIds }
        : { motivo: motivo.trim() },
    );
  }

  // ── Documentos (el archivo se sube antes a `archivos` con el módulo `ticket_fcr_documento`) ──

  documentos(id: string): Observable<DocumentoTicket[]> {
    return this.http.get<DocumentoTicket[]>(`${this.t(id)}/documentos`);
  }
  adjuntarDocumento(
    id: string,
    campo: CampoDocumento,
    archivoId: string,
  ): Observable<DocumentoTicket[]> {
    return this.http.post<DocumentoTicket[]>(`${this.t(id)}/documentos`, { campo, archivoId });
  }

  // ── Reunión operativa, bitácora, uso, finalización y revisión ──

  reunion(id: string): Observable<ActaReunion | null> {
    return this.http.get<ActaReunion | null>(`${this.t(id)}/reunion-operativa`);
  }
  confirmarActa(id: string, fecha: string): Observable<ActaReunion> {
    return this.http.put<ActaReunion>(`${this.t(id)}/reunion-operativa`, { fecha });
  }
  bitacora(id: string): Observable<BitacoraTicket> {
    return this.http.get<BitacoraTicket>(`${this.t(id)}/bitacora`);
  }
  dia(id: string, fecha: string): Observable<DiaBitacoraDetalle> {
    return this.http.get<DiaBitacoraDetalle>(`${this.t(id)}/bitacora/${fecha}`);
  }
  guardarDia(
    id: string,
    fecha: string,
    actividades: ActividadBitacora[],
  ): Observable<DiaBitacoraDetalle> {
    return this.http.put<DiaBitacoraDetalle>(`${this.t(id)}/bitacora/${fecha}`, { actividades });
  }
  enviarDia(id: string, fecha: string): Observable<DiaBitacoraDetalle> {
    return this.http.post<DiaBitacoraDetalle>(`${this.t(id)}/bitacora/${fecha}/enviar`, {});
  }
  uso(id: string): Observable<UsoTicket> {
    return this.http.get<UsoTicket>(`${this.t(id)}/uso-herramientas`);
  }
  registrarUso(
    id: string,
    herramientaId: string,
    fecha: string,
    estado: EstadoUso,
    picker?: PickerEntrada,
  ): Observable<UsoTicket> {
    return this.http.put<UsoTicket>(
      `${this.t(id)}/uso-herramientas/${herramientaId}/${fecha}`,
      picker ? { estado, picker } : { estado },
    );
  }
  quitarUso(id: string, usoId: string): Observable<UsoTicket> {
    return this.http.delete<UsoTicket>(`${this.t(id)}/uso-herramientas/${usoId}`);
  }

  // ── Reporte de Herramientas por ítem de la lista de precios ──

  reporte(id: string): Observable<ReporteHerramientas> {
    return this.http.get<ReporteHerramientas>(`${this.t(id)}/reporte-herramientas`);
  }
  agregarItemReporte(id: string, item: AgregarItemReporteEntrada): Observable<ReporteHerramientas> {
    return this.http.post<ReporteHerramientas>(`${this.t(id)}/reporte-herramientas/items`, item);
  }
  actualizarItemReporte(
    id: string,
    itemId: string,
    cambios: { serie?: string },
  ): Observable<ReporteHerramientas> {
    return this.http.patch<ReporteHerramientas>(
      `${this.t(id)}/reporte-herramientas/items/${itemId}`,
      cambios,
    );
  }
  quitarItemReporte(id: string, itemId: string): Observable<ReporteHerramientas> {
    return this.http.delete<ReporteHerramientas>(
      `${this.t(id)}/reporte-herramientas/items/${itemId}`,
    );
  }
  /** Pone (o, con `null`, quita) la celda de un día: una marca en las filas por día; en las demás, la cantidad aplicada ese día. */
  marcarDiaReporte(
    id: string,
    itemId: string,
    fecha: string,
    estado: EstadoDiaReporte | null,
    cantidad?: number,
  ): Observable<ReporteHerramientas> {
    const url = `${this.t(id)}/reporte-herramientas/items/${itemId}/dias/${fecha}`;
    return estado
      ? this.http.put<ReporteHerramientas>(
          url,
          cantidad === undefined ? { estado } : { estado, cantidad },
        )
      : this.http.delete<ReporteHerramientas>(url);
  }
  confirmarReporte(id: string, confirmado: boolean): Observable<ReporteHerramientas> {
    return this.http.post<ReporteHerramientas>(`${this.t(id)}/reporte-herramientas/confirmar`, {
      confirmado,
    });
  }
  // ── Cambio de ítems del pedido (la propone el operador, la aprueba el Supervisor del ticket) ──

  itemsParaCambio(pedidoId: string, q = ''): Observable<ItemsParaCambio> {
    return this.http.get<ItemsParaCambio>(
      `${environment.apiUrl}/comercial/pedidos/${pedidoId}/items-para-cambio`,
      { params: new HttpParams().set('q', q) },
    );
  }
  cambiosItems(id: string): Observable<SolicitudCambioItems[]> {
    return this.http.get<SolicitudCambioItems[]>(`${this.t(id)}/cambios-items`);
  }
  proponerCambioItems(id: string, cuerpo: ProponerCambioEntrada): Observable<SolicitudCambioItems> {
    return this.http.post<SolicitudCambioItems>(`${this.t(id)}/cambios-items`, cuerpo);
  }
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

  /** Ítems de la lista de precios del pedido que se pueden agregar al reporte (los busca Comercial). */
  itemsDeLista(pedidoId: string, q: string): Observable<{ opciones: OpcionItemLista[] }> {
    return this.http.get<{ opciones: OpcionItemLista[] }>(
      `${environment.apiUrl}/comercial/pedidos/${pedidoId}/items-para-cambio`,
      { params: new HttpParams().set('q', q) },
    );
  }
  finalizarEjecucion(id: string): Observable<TicketFcr> {
    return this.http.post<TicketFcr>(`${this.t(id)}/finalizar-ejecucion`, {});
  }
  aprobarReportes(id: string): Observable<TicketFcr> {
    return this.http.post<TicketFcr>(`${this.t(id)}/aprobar-reportes`, {});
  }
  rechazarReportes(id: string, motivo: string): Observable<TicketFcr> {
    return this.http.post<TicketFcr>(`${this.t(id)}/rechazar-reportes`, { motivo: motivo.trim() });
  }

  // ── Llegada de unidades ──

  llegadas(id: string): Observable<UnidadLlegada[]> {
    return this.http.get<UnidadLlegada[]>(`${this.t(id)}/reportes-unidad-llegada`);
  }
  firmarLlegada(
    id: string,
    vehiculoId: string,
    cuerpo: LlegadaEntrada,
  ): Observable<UnidadLlegada[]> {
    return this.http.post<UnidadLlegada[]>(
      `${this.t(id)}/reportes-unidad-llegada/${vehiculoId}`,
      cuerpo,
    );
  }
}
