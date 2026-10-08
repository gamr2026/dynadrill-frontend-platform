import type { ActividadTabla } from '../../../../shared/models/operativo-docs.model';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PumpingTicket, PumpingStep } from '../models/pumping.model';
import { environment } from '@env';

export interface PumpingDocumento {
  id: number;
  campo: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PumpingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/operations/pumping`;

  listTickets(): Observable<PumpingTicket[]> {
    return this.http.get<PumpingTicket[]>(`${this.baseUrl}/tickets`);
  }

  getTicket(id: number): Observable<PumpingTicket> {
    return this.http.get<PumpingTicket>(`${this.baseUrl}/tickets/${id}`);
  }

  /** Panel de solo lectura de Gerenciamiento de Viaje dentro del ticket — ya no se crea desde acá, lo genera el Conductor. */
  gerenciamientosViaje(id: number): Observable<{ id: number; code: string; estado: string; riskLevel: string; tipo: string }[]> {
    return this.http.get<{ id: number; code: string; estado: string; riskLevel: string; tipo: string }[]>(
      `${this.baseUrl}/tickets/${id}/gerenciamientos-viaje`,
    );
  }

  /** PUT genérico del ticket — para guardar campos que no tienen su propia acción dedicada (ej. gerenciamientos de viaje ya completados). */
  updateTicket(id: number, patch: Partial<PumpingTicket>): Observable<PumpingTicket> {
    return this.http.put<PumpingTicket>(`${this.baseUrl}/tickets/${id}`, patch);
  }

  assignSupervisor(ticketId: number, supervisorId: number): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/assign-supervisor`,
      { supervisorId },
    );
  }

  assignResources(
    ticketId: number,
    payload: {
      operatorIds: number[];
      unitIds: number[];
      /** Emparejamiento real operador -> unidad — sin esto el backend arma pares por posición de array y puede asignar la unidad de un operador a otro (ver PumpingDomainService.assignResources). */
      assignments: { operatorId: number; unitId: number | null }[];
      chemicals: { articuloId: number; name: string; unit: string; cantidad: number }[];
      /** Herramientas que Ventas cotizó en el pedido — quedan asignadas al ticket como 'seleccionada'. */
      tools?: { codigo: string; name: string; unit: string; cantidad: number }[];
      chemicalMixtureDocument?: string;
    },
  ): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/assign-resources`,
      payload,
    );
  }

  /** Cierre de químicos (Ejecución operativa): registra el consumo real; el sobrante se calcula server-side. */
  registerChemicalConsumption(ticketId: number, chemicalId: number, quantityUsed: number): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/chemical-consumption`,
      { chemicalId, quantityUsed },
    );
  }

  saveUnitReport(ticketId: number, report: unknown): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/unit-report`,
      report,
    );
  }

  /**
   * Facturación corrige un día del Reporte Job del ticket (actividades con sus tablas). Tiene la última palabra: después
   * el ticket ya no puede volver a enviar ese día.
   */
  corregirReporteJobDia(
    ticketId: number,
    fecha: string,
    actividades: { id?: number; startTime: string; endTime: string; detail: string; tablas?: ActividadTabla[] }[],
  ): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/tickets/${ticketId}/reporte-job/dias/${fecha}`, { actividades });
  }

  approveTicket(ticketId: number): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/approve`,
      {},
    );
  }

  rejectTicket(ticketId: number, reason: string): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/reject`,
      { reason },
    );
  }

  advanceStep(ticketId: number, step: PumpingStep): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(
      `${this.baseUrl}/tickets/${ticketId}/advance`,
      { step },
    );
  }

  // ── Documentos "monitoreo" del Reporte diario — un slot por (ticket, campo), campo = 'monitoreo-<fecha ISO>'. ──

  /** Metadata del documento del slot, sin descargar el archivo — el caller decide qué hacer con un 404 (no hay documento subido todavía). */
  metadataDocumento(ticketId: number, campo: string): Observable<PumpingDocumento> {
    return this.http.get<PumpingDocumento>(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}/meta`);
  }

  /** Todos los documentos subidos al ticket (ej. monitoreo de cada día) — para "Documentos generados" al finalizar. */
  listarDocumentos(ticketId: number): Observable<PumpingDocumento[]> {
    return this.http.get<PumpingDocumento[]>(`${this.baseUrl}/tickets/${ticketId}/documentos`);
  }

  subirDocumento(ticketId: number, campo: string, archivo: File): Observable<PumpingDocumento> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post<PumpingDocumento>(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}`, form);
  }

  /** Blob autenticado (Bearer vía HttpClient) — un `<a href>` directo al endpoint no lo llevaría. */
  descargarDocumento(ticketId: number, campo: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}`, { responseType: 'blob' });
  }

  eliminarDocumento(ticketId: number, campo: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/tickets/${ticketId}/documentos/${campo}`);
  }

  // ── Documentos QHSE reales (Formato de Recepción / ART / PT / SFI) — Fase 2
  // del plan QHSE↔Pumping. Formato de Recepción y SFI los sube QHSE (ver
  // `QhseDocumentosService` del front, página "Documentos por pedido"); acá
  // solo se leen/descargan. ART y PT los sube el Supervisor desde este ticket.

  documentosQhse(ticketId: number): Observable<DocumentosQhseTicket> {
    return this.http.get<DocumentosQhseTicket>(`${this.baseUrl}/tickets/${ticketId}/documentos-qhse`);
  }

  subirArtQhse(ticketId: number, fechaEmision: string, archivo: File): Observable<unknown> {
    const form = new FormData();
    form.append('fechaEmision', fechaEmision);
    form.append('file', archivo);
    return this.http.post(`${this.baseUrl}/tickets/${ticketId}/documentos-qhse/art`, form);
  }

  subirPtQhse(ticketId: number, ptwCode: string, archivo: File): Observable<unknown> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post(`${this.baseUrl}/tickets/${ticketId}/documentos-qhse/pt/${encodeURIComponent(ptwCode)}`, form);
  }

  subirEntregaQhse(ticketId: number, archivo: File): Observable<unknown> {
    const form = new FormData();
    form.append('file', archivo);
    return this.http.post(`${this.baseUrl}/tickets/${ticketId}/documentos-qhse/entrega`, form);
  }

  descargarDocumentoQhse(ticketId: number, tipo: string, referencia: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/tickets/${ticketId}/documentos-qhse/${tipo}/${encodeURIComponent(referencia)}`, {
      responseType: 'blob',
    });
  }

  // ── Inspección de vehículos por unidad — bloquea traslado_salida hasta que el Operador la realice y el paso a
  // ejecución hasta que el Supervisor la apruebe, por cada unidad de Transporte asignada (reemplaza al checklist de
  // equipos de QHSE: era el mismo documento).

  inspeccionesVehiculo(ticketId: number): Observable<InspeccionesVehiculoEstado> {
    return this.http.get<InspeccionesVehiculoEstado>(`${this.baseUrl}/tickets/${ticketId}/inspecciones-vehiculo`);
  }

  // ── Checklist de Ingreso a locación + Verificaciones de seguridad (Fase 2,
  // PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS) — se suma al gate de arriba
  // sobre la misma transición `traslado_salida`. Antes vivía en el PTW,
  // solo QHSE lo veía; ahora lo llena Operativo.

  checklistIngreso(ticketId: number): Observable<ChecklistIngreso> {
    return this.http.get<ChecklistIngreso>(`${this.baseUrl}/tickets/${ticketId}/checklist-ingreso`);
  }

  actualizarChecklistIngreso(
    ticketId: number,
    cambios: Partial<ChecklistIngresoBooleanos> & { nuevaLectura?: { gas: ChecklistIngresoGas; lectura: number } },
  ): Observable<ChecklistIngreso> {
    return this.http.patch<ChecklistIngreso>(`${this.baseUrl}/tickets/${ticketId}/checklist-ingreso`, cambios);
  }

  toggleLotoIngreso(ticketId: number, index: number): Observable<ChecklistIngreso> {
    return this.http.patch<ChecklistIngreso>(`${this.baseUrl}/tickets/${ticketId}/checklist-ingreso/loto/${index}`, {});
  }

  /** Fase 3: confirmación del Supervisor de que el Company Man aprobó el inicio del trabajo. */
  companyManAprobo(ticketId: number): Observable<PumpingTicket> {
    return this.http.patch<PumpingTicket>(`${this.baseUrl}/tickets/${ticketId}/company-man-aprobo`, {});
  }
}

/** Una unidad de Transporte asignada y el estado de su Inspección de Vehículos de este ticket. */
export interface InspeccionVehiculoCaso {
  unidadId: number;
  unidadCode: string;
  estado: 'pendiente' | 'por_aprobar' | 'aprobada';
  inspeccionId?: number;
  aprobadaPor?: string;
}

/**
 * Respuesta de `GET .../tickets/:id/inspecciones-vehiculo`. Los dos candados usan el mismo criterio exacto que bloquea
 * `advance` en el backend: `gateRealizada` (salir de traslado_salida) y `gateAprobada` (salir de revision_reportes_salida).
 */
export interface InspeccionesVehiculoEstado {
  casos: InspeccionVehiculoCaso[];
  gateRealizada: { ok: boolean; faltantes: string[] };
  gateAprobada: { ok: boolean; faltantes: string[] };
}

export type ChecklistIngresoGas = 'H2S' | 'LEL' | 'O2' | 'CO';

export const CHECKLIST_INGRESO_GAS_LIMITES: Record<ChecklistIngresoGas, { label: string; unidad: string; min?: number; max: number }> = {
  H2S: { label: 'H2S (Ácido Sulfhídrico)', unidad: 'ppm', max: 10 },
  LEL: { label: 'LEL (Límite Explosivo Inferior)', unidad: '%', max: 10 },
  O2: { label: 'O2 (Oxígeno)', unidad: '%', min: 19.5, max: 23.5 },
  CO: { label: 'CO (Monóxido de Carbono)', unidad: 'ppm', max: 25 },
};

export interface ChecklistIngresoGasReading {
  gas: ChecklistIngresoGas;
  lectura: number;
  seguro: boolean;
  medidoAt: string;
}

export interface ChecklistIngresoLotoItem {
  label: string;
  checked: boolean;
}

export interface ChecklistIngresoBooleanos {
  toolboxTalkRealizado: boolean;
  walkaroundCompletado: boolean;
  lineaBaseAmbientalDocumentada: boolean;
  rutasEmergenciaVerificadas: boolean;
  simopsConfirmado: boolean;
}

/**
 * `ChecklistIngresoPumping` del backend — checklist unificado "Ingreso a
 * locación" + "Verificaciones de seguridad" (Fase 2,
 * PLAN-QHSE-FASE2-PTW-STOP-EPI-DESECHOS), un registro por ticket.
 */
export interface ChecklistIngreso extends ChecklistIngresoBooleanos {
  id: number;
  pumpingTicketId: number;
  gasReadings: ChecklistIngresoGasReading[];
  lotoChecklist: ChecklistIngresoLotoItem[];
  lotoNotificadoClienteAt: string | null;
  confirmadoPor: string | null;
  confirmadoAt: string | null;
  completo: boolean;
}

/** Respuesta de `GET .../tickets/:id/documentos-qhse` — ver `PumpingDocumentosQhseController` y `EstadoDocumentalPedido` del backend. */
export interface DocumentosQhseTicket {
  pedidoId: number;
  formatoRecepcion: boolean;
  /** Acta de Entrega de Locación (DYN-PMP-RE-027) — la sube el Supervisor al finalizar el ticket. */
  formatoEntrega: boolean;
  sfi: boolean;
  artVigente: boolean | null;
  artFechaEmision: string | null;
  artVigenciaHasta: string | null;
  artVenceEnDias: number | null;
  ptHoy: boolean;
  ptwAbierto: { id: number; code: string } | null;
  /** PTW que QHSE cerró hoy: el PT ya cargado contra él sigue contando aunque no haya uno abierto. */
  ptwCerradoHoy: { id: number; code: string } | null;
  ptDeHoy: boolean;
}
