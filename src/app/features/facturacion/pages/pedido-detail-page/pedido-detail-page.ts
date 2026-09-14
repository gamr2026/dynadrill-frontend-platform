import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillProgressComponent,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ReporteHerramientasPdfDialog,
  ReporteHerramientasPdfDialogData,
  ReporteJobPdfDialog,
  ReporteJobPdfDialogData,
} from '../../../../shared/index';
import {
  ESTADOS_FUERA_DE_ALCANCE,
  ESTADO_PEDIDO_LABELS,
  EstadoPedido,
  LINEA_SERVICIO_LABELS,
  Pedido,
  valorEstimadoPedido,
  itemsEstimadosDe,
} from '../../models/pedido.model';
import { AvanceDocumental, DocumentoOperativo } from '../../models/documento-operativo.model';
import { Prefactura } from '../../models/prefactura.model';
import { GuiaRemision } from '../../models/guia-remision.model';
import { DocumentoOperativoService, GuiaRemisionService, PedidoService, PrefacturaService } from '../../services/pedido.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router } from '@angular/router';
import { GuiaRemisionDialog, GuiaRemisionDialogData } from '../../components/guia-remision-dialog';
import { GuiaRemisionPdfDialog, GuiaRemisionPdfDialogData } from '../../components/guia-remision-pdf-dialog';
import { FCR_PHASE_LABELS, FcrTicket } from '../../../operations/fcr/models/fcr.model';
import { FcrService } from '../../../operations/fcr/services/fcr.service';
import { NuevoPedidoDialog } from '../../components/nuevo-pedido-dialog';

interface Dato {
  label: string;
  value: string;
}

/**
 * Fase 0.3 / Fase 3 — Detalle de Pedido. Datos de cabecera (solo lectura) +
 * documentos operativos recibidos de FCR / Pumping + panel de avance.
 */
@Component({
  selector: 'app-pedido-detail-page',
  imports: [
    DatePipe,
    DecimalPipe,
    DynadrillScreenHeaderComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
    DynadrillButtonComponent,
    DynadrillProgressComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedido-detail-page.html',
  styleUrl: './pedido-detail-page.scss',
})
export class PedidoDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pedidoService = inject(PedidoService);
  private readonly docService = inject(DocumentoOperativoService);
  private readonly prefacturaService = inject(PrefacturaService);
  private readonly guiaService = inject(GuiaRemisionService);
  private readonly fcrService = inject(FcrService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  private readonly pedidoId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly pedido = signal<Pedido | null>(null);
  protected readonly documentos = signal<DocumentoOperativo[]>([]);
  protected readonly avance = signal<AvanceDocumental | null>(null);
  protected readonly prefactura = signal<Prefactura | null>(null);
  protected readonly guiaRemision = signal<GuiaRemision | null>(null);
  protected readonly fcrTicket = signal<FcrTicket | null>(null);
  protected readonly simulando = signal(false);
  protected readonly generando = signal(false);
  protected readonly generandoGuia = signal(false);

  protected readonly fcrFaseLabel = computed(() => {
    const t = this.fcrTicket();
    return t ? FCR_PHASE_LABELS[t.currentPhase] : '';
  });

  /** También permite regenerar cuando la prefactura vigente fue rechazada por el cliente (flujo "corregir y reenviar"). */
  protected readonly puedeGenerarPrefactura = computed(() => {
    const a = this.avance();
    const pf = this.prefactura();
    return !!a?.completo && (!pf || pf.estado === 'rechazada');
  });
  protected readonly esRegeneracion = computed(() => this.prefactura()?.estado === 'rechazada');
  protected readonly puedeGenerarGuia = computed(() => !!this.avance()?.guiaRemisionAplica && !this.guiaRemision());

  protected readonly estadoLabel = computed(() => {
    const p = this.pedido();
    return p ? ESTADO_PEDIDO_LABELS[p.estado] : '';
  });

  protected readonly estadoFueraDeAlcance = computed(() => {
    const p = this.pedido();
    return !!p && ESTADOS_FUERA_DE_ALCANCE.includes(p.estado);
  });

  protected readonly reporteJobDocs = computed(() =>
    this.documentos()
      .filter(d => d.tipo === 'reporte_job')
      .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '')),
  );
  protected readonly reporteHtasDocs = computed(() => this.documentos().filter(d => d.tipo === 'reporte_herramientas'));

  protected readonly datosCliente = computed<Dato[]>(() => {
    const p = this.pedido();
    if (!p) return [];
    return [
      { label: 'Cliente', value: p.cliente },
      { label: 'RUC', value: p.clienteRuc ?? '—' },
      { label: 'Subcliente', value: p.subcliente ?? '—' },
      { label: 'Contrato', value: p.numeroContrato },
    ];
  });

  protected readonly datosServicio = computed<Dato[]>(() => {
    const p = this.pedido();
    if (!p) return [];
    return [
      { label: 'Línea de servicio', value: LINEA_SERVICIO_LABELS[p.lineaServicio] },
      { label: 'Campo', value: p.campo },
      { label: 'Bloque', value: p.bloque },
      { label: 'Pozo', value: p.pozo },
      { label: 'Taladro / Rig', value: p.taladroRig },
      { label: 'Inicio de servicio', value: p.fechaInicioServicio ?? '—' },
      { label: 'Fin de servicio', value: p.fechaFinServicio ?? '—' },
    ];
  });

  protected readonly datosComercial = computed<Dato[]>(() => {
    const p = this.pedido();
    if (!p) return [];
    return [
      { label: 'Agente comercial', value: p.agenteComercial },
      { label: 'Representante en campo (PEC)', value: p.representanteCampo },
      { label: 'Representante en Quito (PEC)', value: p.representanteQuito },
      { label: 'Analista de facturación', value: p.analistaFacturacion ?? '—' },
    ];
  });

  protected readonly datosAdministrativos = computed<Dato[]>(() => {
    const p = this.pedido();
    if (!p) return [];
    return [
      { label: 'Condición de pago', value: p.condicionPago ?? '—' },
      { label: 'Zona', value: p.zona ?? '—' },
      { label: 'Bodega', value: p.bodega ?? '—' },
      { label: 'Origen', value: p.origen === 'as2' ? 'AS2' : 'Portal' },
      { label: 'Referencia AS2', value: p.as2Ref ?? '—' },
    ];
  });

  protected readonly lineasEstimadas = computed(() => {
    const p = this.pedido();
    return p ? itemsEstimadosDe(p) : [];
  });

  protected readonly valorEstimado = computed(() => {
    const p = this.pedido();
    return p ? valorEstimadoPedido(p) : 0;
  });

  protected estadoLabelDe(estado: EstadoPedido): string {
    return ESTADO_PEDIDO_LABELS[estado];
  }

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({
      pedido: this.pedidoService.get(this.pedidoId),
      documentos: this.docService.listDePedido(this.pedidoId),
      avance: this.docService.avance(this.pedidoId),
      prefactura: this.prefacturaService.dePedido(this.pedidoId),
      guiaRemision: this.guiaService.dePedido(this.pedidoId),
      fcrTickets: this.fcrService.listTickets(),
    }).subscribe({
      next: ({ pedido, documentos, avance, prefactura, guiaRemision, fcrTickets }) => {
        this.pedido.set(pedido);
        this.documentos.set(documentos);
        this.avance.set(avance);
        this.prefactura.set(prefactura);
        this.guiaRemision.set(guiaRemision);
        this.fcrTicket.set(fcrTickets.find(t => t.pedidoCode === pedido.code) ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el pedido.');
      },
    });
  }

  /** Ventas y Facturación pueden editar (ver ModuleRoles.pedidos) — solo Ventas gestiona Administrativos, ver NuevoPedidoDialog. */
  protected editarPedido(): void {
    const p = this.pedido();
    if (!p) return;
    const ref = this.dialog.open<NuevoPedidoDialog>({
      title: `Editar pedido ${p.code}`,
      content: NuevoPedidoDialog,
      data: { pedido: p },
      footer: false,
      width: '760px',
    });
    ref.afterClose.subscribe(actualizado => {
      if (actualizado) this.reload();
    });
  }

  protected verReporteJob(doc: DocumentoOperativo): void {
    if (!doc.header || !doc.actividades) return;
    this.dialog.open<ReporteJobPdfDialog, ReporteJobPdfDialogData>({
      title: `Reporte Job — ${doc.fecha ?? ''}`,
      content: ReporteJobPdfDialog,
      data: { header: doc.header, log: doc.actividades },
      footer: false,
      width: '820px',
    });
  }

  /** Un solo PDF de Reporte de Herramientas consolidando todos los días recibidos. */
  protected verReporteHerramientas(): void {
    const docs = this.reporteHtasDocs();
    if (!docs.length || !docs[0].header) return;
    const herramientas = docs.flatMap(d => d.herramientas ?? []);
    const usoHerramientas = docs.flatMap(d => d.usoHerramientas ?? []);
    this.dialog.open<ReporteHerramientasPdfDialog, ReporteHerramientasPdfDialogData>({
      title: 'Reporte de Herramientas',
      content: ReporteHerramientasPdfDialog,
      data: { header: docs[0].header, tools: herramientas, usageLog: usoHerramientas },
      footer: false,
      width: '920px',
    });
  }

  protected generarPrefactura(): void {
    if (!this.puedeGenerarPrefactura() || this.generando()) return;
    this.generando.set(true);
    const regeneracion = this.esRegeneracion();
    this.prefacturaService.generar(this.pedidoId, this.auth.currentUser()?.name ?? 'Facturación').subscribe({
      next: pf => {
        this.generando.set(false);
        this.notify.success(
          regeneracion ? 'Prefactura regenerada' : 'Prefactura generada',
          `${pf.code} — subtotal $${pf.subtotal.toFixed(2)}.`,
        );
        this.router.navigate(['/dashboard/facturacion/prefacturas', pf.id]);
      },
      error: () => {
        this.generando.set(false);
        this.notify.error('Error', 'No se pudo generar la prefactura.');
      },
    });
  }

  /** Puente Pedido -> FCR: el ticket FCR se creó automáticamente al abrir el pedido (líneas CTU/Fishing/Completion). */
  protected irAFcr(): void {
    const t = this.fcrTicket();
    if (t) this.router.navigate(['/modulos/operativo/fcr', t.id]);
  }

  protected verPrefactura(): void {
    const pf = this.prefactura();
    if (pf) this.router.navigate(['/dashboard/facturacion/prefacturas', pf.id]);
  }

  protected abrirGuiaRemision(): void {
    const p = this.pedido();
    if (!p || !this.puedeGenerarGuia()) return;
    const ref = this.dialog.open<GuiaRemisionDialog, GuiaRemisionDialogData>({
      title: 'Generar guía de remisión',
      content: GuiaRemisionDialog,
      data: { pedidoId: p.id, cliente: p.cliente, clienteRuc: p.clienteRuc, solicitadoPorSugerido: p.representanteCampo },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe(guia => {
      if (guia) this.reload();
    });
  }

  protected verGuiaRemisionPdf(): void {
    const guia = this.guiaRemision();
    const p = this.pedido();
    if (!guia || !p) return;
    this.dialog.open<GuiaRemisionPdfDialog, GuiaRemisionPdfDialogData>({
      title: 'Guía de remisión — Vista de impresión',
      content: GuiaRemisionPdfDialog,
      data: { guia, pedido: p },
      footer: false,
      width: '820px',
    });
  }

  /** Simula que un operador de FCR/Pumping cargó y firmó un Reporte Job de un día más. */
  protected simularCargaOperador(): void {
    const p = this.pedido();
    if (!p || this.simulando()) return;
    this.simulando.set(true);
    const proximaFecha = new Date();
    const iso = proximaFecha.toISOString().slice(0, 10);
    const origen = p.lineaServicio === 'pumping' ? 'pumping' : 'fcr';
    this.docService
      .push({
        pedidoCode: p.code,
        origen,
        ticketOperativoId: 0,
        tipo: 'reporte_job',
        fecha: iso,
        firmadoPor: p.representanteCampo || 'Operador',
        firmadoAt: proximaFecha.toISOString(),
        header: { code: p.code, cliente: p.cliente, pozo: p.pozo, supervisor: p.agenteComercial, operador: p.analistaFacturacion },
        actividades: [
          { id: 1, date: iso, startTime: '06:00', endTime: '14:00', durationHours: 8, detail: 'Jornada de operación registrada por el operador.', author: p.representanteCampo || 'Operador' },
        ],
      })
      .subscribe({
        next: () => {
          this.simulando.set(false);
          this.notify.success('Documento recibido', `${origen.toUpperCase()} cargó un Reporte Job del ${iso}.`);
          this.reload();
        },
        error: () => {
          this.simulando.set(false);
          this.notify.error('Error', 'No se pudo simular la carga.');
        },
      });
  }
}
