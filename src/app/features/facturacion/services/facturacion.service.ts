import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ActaEntregaRecepcion,
  CreateActaEntregaInput,
  CreateDocumentacionDiariaInput,
  CreateExcepcionInput,
  CreateFacturacionTicketInput,
  CreateGuiaCampoInput,
  CreateOtqInput,
  DocumentacionDiaria,
  Excepcion,
  FacturacionTicket,
  GuiaCampo,
  Otq,
  OtqItemDraft,
} from '../models/facturacion.model';

@Injectable({ providedIn: 'root' })
export class OtqService {
  private readonly http = inject(HttpClient);

  list(): Observable<Otq[]> {
    return this.http.get<Otq[]>('/api/facturacion/otq');
  }

  get(id: number): Observable<Otq> {
    return this.http.get<Otq>(`/api/facturacion/otq/${id}`);
  }

  create(input: CreateOtqInput): Observable<Otq> {
    return this.http.post<Otq>('/api/facturacion/otq', input);
  }

  /** FACT-003, Escenario B — reemplaza los ítems de la OTQ tras un cambio de alcance aprobado. */
  actualizarItems(id: number, items: OtqItemDraft[]): Observable<Otq> {
    return this.http.patch<Otq>(`/api/facturacion/otq/${id}/items`, { items });
  }
}

@Injectable({ providedIn: 'root' })
export class DocumentacionDiariaService {
  private readonly http = inject(HttpClient);

  list(): Observable<DocumentacionDiaria[]> {
    return this.http.get<DocumentacionDiaria[]>('/api/facturacion/documentacion');
  }

  create(input: CreateDocumentacionDiariaInput): Observable<DocumentacionDiaria> {
    return this.http.post<DocumentacionDiaria>('/api/facturacion/documentacion', input);
  }

  homologar(id: number, homologadoPor: string, observaciones?: string): Observable<DocumentacionDiaria> {
    return this.http.patch<DocumentacionDiaria>(`/api/facturacion/documentacion/${id}/homologar`, { homologadoPor, observaciones });
  }

  rechazar(id: number, observaciones: string): Observable<DocumentacionDiaria> {
    return this.http.patch<DocumentacionDiaria>(`/api/facturacion/documentacion/${id}/rechazar`, { observaciones });
  }
}

@Injectable({ providedIn: 'root' })
export class ExcepcionService {
  private readonly http = inject(HttpClient);

  list(): Observable<Excepcion[]> {
    return this.http.get<Excepcion[]>('/api/facturacion/excepciones');
  }

  create(input: CreateExcepcionInput): Observable<Excepcion> {
    return this.http.post<Excepcion>('/api/facturacion/excepciones', input);
  }

  aprobarCliente(id: number): Observable<Excepcion> {
    return this.http.patch<Excepcion>(`/api/facturacion/excepciones/${id}/aprobar-cliente`, {});
  }

  aprobarGerencia(id: number): Observable<Excepcion> {
    return this.http.patch<Excepcion>(`/api/facturacion/excepciones/${id}/aprobar-gerencia`, {});
  }

  rechazar(id: number): Observable<Excepcion> {
    return this.http.patch<Excepcion>(`/api/facturacion/excepciones/${id}/rechazar`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class GuiaCampoService {
  private readonly http = inject(HttpClient);

  list(): Observable<GuiaCampo[]> {
    return this.http.get<GuiaCampo[]>('/api/facturacion/guias-campo');
  }

  create(input: CreateGuiaCampoInput): Observable<GuiaCampo> {
    return this.http.post<GuiaCampo>('/api/facturacion/guias-campo', input);
  }

  firmar(id: number, firmaDynadrillNombre: string, companyMan: { nombre: string; cedula: string; cargo: string }): Observable<GuiaCampo> {
    return this.http.patch<GuiaCampo>(`/api/facturacion/guias-campo/${id}/firmar`, { firmaDynadrillNombre, companyMan });
  }
}

@Injectable({ providedIn: 'root' })
export class ActaEntregaService {
  private readonly http = inject(HttpClient);

  list(): Observable<ActaEntregaRecepcion[]> {
    return this.http.get<ActaEntregaRecepcion[]>('/api/facturacion/actas');
  }

  create(input: CreateActaEntregaInput): Observable<ActaEntregaRecepcion> {
    return this.http.post<ActaEntregaRecepcion>('/api/facturacion/actas', input);
  }

  firmar(id: number, firmaSupervisorNombre: string, companyMan: { nombre: string; cedula: string; cargo: string }): Observable<ActaEntregaRecepcion> {
    return this.http.patch<ActaEntregaRecepcion>(`/api/facturacion/actas/${id}/firmar`, { firmaSupervisorNombre, companyMan });
  }
}

@Injectable({ providedIn: 'root' })
export class FacturacionTicketService {
  private readonly http = inject(HttpClient);

  list(): Observable<FacturacionTicket[]> {
    return this.http.get<FacturacionTicket[]>('/api/facturacion/tickets');
  }

  get(id: number): Observable<FacturacionTicket> {
    return this.http.get<FacturacionTicket>(`/api/facturacion/tickets/${id}`);
  }

  /** Cierra un Pedido: crea el Ticket (una sola vez por pedidoId) a partir de la Prefactura consolidada. */
  cerrar(input: CreateFacturacionTicketInput): Observable<FacturacionTicket> {
    return this.http.post<FacturacionTicket>('/api/facturacion/tickets', input);
  }

  /**
   * Marca el Ticket como facturado. Hoy es un cambio de estado local — el
   * día que exista la integración de escritura con AS2, esta es la llamada
   * que dispararía la emisión real ante el SRI.
   */
  marcarFacturado(id: number, facturaAs2Ref?: string): Observable<FacturacionTicket> {
    return this.http.patch<FacturacionTicket>(`/api/facturacion/tickets/${id}/facturar`, { facturaAs2Ref });
  }
}
