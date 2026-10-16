import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, DestroyRef } from '@angular/core';
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
import { useDetailChrome } from '../../../../layout/page-chrome.service';
import {
  TimelinePopoverTriggerDirective,
} from '../../../../shared/index';
import {
  ESTADOS_FUERA_DE_ALCANCE,
  ESTADOS_NO_ANULABLES,
  ESTADOS_RECHAZABLES,
  ESTADO_PEDIDO_LABELS,
  EstadoPedido,
  LINEA_SERVICIO_LABELS,
  Pedido,
  tiposServicioLabel,
  valorEstimadoPedido,
  itemsEstimadosDe,
} from '../../models/pedido.model';
import { AvanceDocumental, DocumentoOperativo, DocumentoRealPedido, ESTADOS_PEDIDO_DOCUMENTOS_CERRADOS } from '../../models/documento-operativo.model';
import { CorregirReporteJobDialog, CorregirReporteJobDialogData, CorregirReporteJobDialogResult } from '../../components/corregir-reporte-job-dialog';
import { Prefactura } from '../../models/prefactura.model';
import { GuiaRemision } from '../../models/guia-remision.model';
import { DocumentoOperativoService, GuiaRemisionService, PedidoService, PrefacturaService } from '../../services/pedido.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router } from '@angular/router';
import { GuiaRemisionDialog, GuiaRemisionDialogData } from '../../components/guia-remision-dialog';
import { GuiaRemisionHoja } from '../../../../shared/documentos/formatos/guia-remision-hoja';
import { FCR_PHASE_LABELS, FcrTicket } from '../../../operations/fcr/models/fcr.model';
import { PUMPING_STEP_LABELS, type PumpingStep } from '../../../operations/pumping/models/pumping.model';
import { PUMPING_ROLES } from '../../../operations/pumping/pumping.routes';
import { FCR_ROLES } from '../../../operations/fcr/fcr.routes';
import { FcrService } from '../../../operations/fcr/services/fcr.service';
import { PumpingService } from '../../../operations/pumping/services/pumping.service';
import { NuevoPedidoDialog } from '../../components/nuevo-pedido-dialog';
import { RechazarPedidoDialog, RechazarPedidoDialogData } from '../../components/rechazar-pedido-dialog';
import { AnularPedidoDialog, AnularPedidoDialogData } from '../../components/anular-pedido-dialog';
import { SolicitarDespachoDialog, SolicitarDespachoDialogData } from '../../components/solicitar-despacho-dialog';
import { TimelineTramo } from '../../../../shared/models/timeline.model';
import { DocumentoPdfService } from '../../../../shared/documentos';
import { fechaDoc } from '../../../../shared/documentos/documento-format.util';
import { ReporteUnidadHoja } from '../../../../shared/documentos/formatos/reporte-unidad-hoja';
import { PrefacturaHoja } from '../../../../shared/documentos/formatos/prefactura-hoja';
import { ReporteJobHoja, type ReporteJobExtras } from '../../../../shared/documentos/formatos/reporte-job-hoja';
import { ReporteHerramientasHoja } from '../../../../shared/documentos/formatos/reporte-herramientas-hoja';
import { SolicitudDespachoBodega } from '../../models/solicitud-despacho-bodega.model';

interface Dato {
  label: string;
  value: string;
}

/** Un paso de la línea de tiempo (Figma "Data/TimelineStep"): hecho, actual o pendiente. */
interface PasoTimeline {
  label: string;
  state: 'done' | 'current' | 'pending';
  /** Fecha del paso (ISO) — ausente en los pendientes. */
  fecha?: string;
  actor?: string;
  motivo?: string;
  tramo?: TimelineTramo;
}

/** Camino feliz del pedido — lo que falta por recorrer se muestra como "Pendiente" en el timeline. */
const FLUJO_PEDIDO: readonly EstadoPedido[] = [
  'abierto',
  'en_operacion',
  'documentos_completos',
  'en_revision_prefacturacion',
  'prefactura_generada',
  'enviado_para_firmas',
  'ticket_firmado',
  'aot_generada',
];

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
    TimelinePopoverTriggerDirective,
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
  private readonly pumpingService = inject(PumpingService);
  private readonly documentoPdf = inject(DocumentoPdfService);
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
  protected readonly solicitudDespacho = signal<SolicitudDespachoBodega | null>(null);
  protected readonly simulando = signal(false);
  protected readonly generando = signal(false);
  protected readonly generandoGuia = signal(false);

  /** dd/MM/yyyy para cualquier fecha de la tabla (llegan como "2026-09-30" o ISO con hora). */
  protected readonly fechaCorta = fechaDoc;

  /** "FCR" o "Pumping" según la línea del pedido — títulos y botones de esta pantalla. */
  protected readonly lineaLabel = computed(() => (this.pedido()?.lineaServicio === 'pumping' ? 'Pumping' : 'FCR'));

  /** El botón "Ir a FCR/Pumping" solo se muestra a los roles que pueden abrir ese ticket — sin acceso, el guard los sacaría al inicio. */
  protected readonly puedeAbrirTicket = computed(() => {
    const rol = this.auth.currentUser()?.roleName ?? '';
    return (this.pedido()?.lineaServicio === 'pumping' ? PUMPING_ROLES : FCR_ROLES).includes(rol);
  });

  /** Ticket operativo del pedido, sea de FCR o de Pumping. */
  protected readonly ticketAsociado = computed<{ id: number | null; code: string; fase: string }>(() => {
    if (this.pedido()?.lineaServicio === 'pumping') {
      const a = this.avance();
      const fase = a?.ticketPumpingFase;
      return {
        id: a?.ticketPumpingId ?? null,
        code: a?.ticketPumpingCode ?? '',
        fase: fase ? (PUMPING_STEP_LABELS[fase as PumpingStep] ?? fase) : '',
      };
    }
    const t = this.fcrTicket();
    return { id: t?.id ?? null, code: t?.code ?? '', fase: t ? this.fcrFaseLabel() : '' };
  });

  protected readonly fcrFaseLabel = computed(() => {
    const t = this.fcrTicket();
    return t ? FCR_PHASE_LABELS[t.currentPhase] : '';
  });

  /**
   * También permite regenerar cuando la prefactura vigente fue rechazada por
   * el cliente (flujo "corregir y reenviar"). Solo Facturación genera — Ventas
   * ve/edita el Pedido en esta misma página (`ModuleRoles.pedidos` los deja
   * entrar a ambos) pero la prefactura es responsabilidad exclusiva de
   * Facturación, mismo criterio que backend (`pedidos.controller.ts`).
   */
  protected readonly puedeGenerarPrefactura = computed(() => {
    const a = this.avance();
    const pf = this.prefactura();
    const role = this.auth.currentUser()?.roleName;
    const rolPermitido = role === 'Facturación' || role === 'Superadmin' || role === 'Jefe de Base';
    return rolPermitido && !!a?.completo && (!pf || pf.estado === 'rechazada');
  });
  protected readonly esRegeneracion = computed(() => this.prefactura()?.estado === 'rechazada');
  protected readonly puedeGenerarGuia = computed(() => !!this.avance()?.guiaRemisionAplica && !this.guiaRemision());

  /** Solo Facturación, y solo antes de que exista prefactura generada — ver `ESTADOS_RECHAZABLES`. */
  protected readonly puedeRechazar = computed(() => {
    const p = this.pedido();
    const role = this.auth.currentUser()?.roleName;
    const rolPermitido = role === 'Facturación' || role === 'Superadmin' || role === 'Jefe de Base';
    return rolPermitido && !!p && ESTADOS_RECHAZABLES.includes(p.estado);
  });

  /** Solo Facturación — cierre definitivo, aplica en cualquier estado salvo uno ya cerrado (ver `ESTADOS_NO_ANULABLES`). */
  protected readonly puedeAnular = computed(() => {
    const p = this.pedido();
    const role = this.auth.currentUser()?.roleName;
    const rolPermitido = role === 'Facturación' || role === 'Superadmin' || role === 'Jefe de Base';
    return rolPermitido && !!p && !ESTADOS_NO_ANULABLES.includes(p.estado);
  });

  /** Solo Facturación, y solo con la prefactura ya generada y sin una solicitud pendiente — ver `solicitarDespachoBodega` en el backend. */
  protected readonly puedeSolicitarDespacho = computed(() => {
    const p = this.pedido();
    const role = this.auth.currentUser()?.roleName;
    const rolPermitido = role === 'Facturación' || role === 'Superadmin' || role === 'Jefe de Base';
    return rolPermitido && p?.estado === 'prefactura_generada';
  });

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
  protected readonly reporteUnidad = computed(() => this.avance()?.reporteUnidad ?? null);
  protected readonly reporteHtasDocs = computed(() => this.documentos().filter(d => d.tipo === 'reporte_herramientas'));
  protected readonly documentosMonitoreo = computed(() => this.avance()?.documentosReales?.filter(d => d.tipo === 'monitoreo') ?? []);
  protected readonly documentosMezcla = computed(() => this.avance()?.documentosReales?.filter(d => d.tipo === 'mezcla') ?? []);
  /**
   * Reporte Job/Herramientas consolidados + Prefactura (sin archivo real
   * detrás, "Descargar" abre el mismo diálogo que "Ver PDF", ahí está el
   * botón que arma el PDF real) + Despacho de Bodega (ese sí es un archivo
   * real, el que Bodega adjuntó al despachar — ver `descargarDocumentoReal`).
   */
  protected readonly documentosGenerados = computed(() => this.avance()?.documentosReales?.filter(d => d.origen === 'generado') ?? []);

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
      { label: 'Tipo de servicio', value: tiposServicioLabel(p.tipoServicio) },
      { label: 'Sub-tipo de servicio', value: p.subTipoServicio?.length ? p.subTipoServicio.join(', ') : '—' },
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
      { label: 'Representante en campo', value: p.representanteCampo },
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

  /** Misma función que `estadoLabelDe`, para usar directo en el template con un `fase: string` (viene de `TimelineTramo`, no tipado a `EstadoPedido`). */
  protected readonly estadoLabelDeFn = (fase: string): string => this.estadoLabelDe(fase as EstadoPedido);

  /** Pasos hechos (tramos del backend, o `historialEstados` como respaldo) + los que faltan del flujo como pendientes. */
  protected readonly pasosTimeline = computed<PasoTimeline[]>(() => {
    const p = this.pedido();
    if (!p) return [];
    const tramos = p.timelineResumen?.tramos;
    const hechos: PasoTimeline[] = tramos?.length
      ? tramos.map((t) => ({ label: this.estadoLabelDeFn(t.fase), state: 'done', fecha: t.inicio, actor: t.actorNombre, motivo: t.motivo, tramo: t }))
      : p.historialEstados.map((h) => ({ label: this.estadoLabelDe(h.estado), state: 'done', fecha: h.fecha, actor: h.usuario, motivo: h.motivo }));
    if (hechos.length) hechos[hechos.length - 1].state = 'current';

    const vistos = new Set<string>(tramos?.length ? tramos.map((t) => t.fase) : p.historialEstados.map((h) => h.estado));
    const ultimoEnFlujo = FLUJO_PEDIDO.reduce((max, e, i) => (vistos.has(e) ? i : max), -1);
    const cerrado = p.estado === 'anulado' || ESTADOS_FUERA_DE_ALCANCE.includes(p.estado);
    const pendientes: PasoTimeline[] = cerrado
      ? []
      : FLUJO_PEDIDO.filter((e, i) => i > ultimoEnFlujo && !vistos.has(e)).map((e) => ({ label: ESTADO_PEDIDO_LABELS[e], state: 'pending' }));
    return [...hechos, ...pendientes];
  });

  /** `null` = sin selección manual → se muestra el detalle del tramo actual (el último). Clic en un ítem del historial lo selecciona. */
  private readonly manualHistorialIndex = signal<number | null>(null);
  protected readonly selectedHistorialIndex = computed(
    () => this.manualHistorialIndex() ?? (this.pedido()?.timelineResumen?.tramos.length ?? 1) - 1,
  );

  protected seleccionarHistorial(index: number): void {
    this.manualHistorialIndex.set(index);
  }

  constructor() {
    this.reload();

    // Si el pedido cambia de estado, la selección manual vieja del detalle ya no aplica.
    effect(() => {
      this.pedido();
      untracked(() => this.manualHistorialIndex.set(null));
    });

    // Barra "Detail" del header (Figma Nav/TopAppBar, solo móvil) — se
    // recalcula cada vez que cambian el pedido o los permisos de rechazar/
    // anular, para que el menú "⋮" siempre refleje lo mismo que el toolbar.
    useDetailChrome(
      () => 'Pedido ' + (this.pedido()?.code ?? ''),
      '/dashboard/facturacion/pedidos-demo',
      () => this.pedido()
        ? [
            { label: 'Editar pedido', action: () => this.editarPedido() },
            ...(this.puedeRechazar() ? [{ label: 'Rechazar pedido', action: () => this.rechazarPedido() }] : []),
            ...(this.puedeAnular() ? [{ label: 'Anular pedido', action: () => this.anularPedido(), danger: true }] : []),
          ]
        : [],
    );
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
      solicitudDespacho: this.pedidoService.solicitudDespacho(this.pedidoId),
    }).subscribe({
      next: ({ pedido, documentos, avance, prefactura, guiaRemision, fcrTickets, solicitudDespacho }) => {
        this.pedido.set(pedido);
        this.documentos.set(documentos);
        this.avance.set(avance);
        this.prefactura.set(prefactura);
        this.guiaRemision.set(guiaRemision);
        this.fcrTicket.set(fcrTickets.find(t => t.pedidoCode === pedido.code) ?? null);
        this.solicitudDespacho.set(solicitudDespacho);
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
      width: '960px',
    });
    ref.afterClose.subscribe(actualizado => {
      if (actualizado) this.reload();
    });
  }

  protected rechazarPedido(): void {
    const p = this.pedido();
    if (!p || !this.puedeRechazar()) return;
    const ref = this.dialog.open<RechazarPedidoDialog, RechazarPedidoDialogData>({
      title: `Rechazar pedido ${p.code}`,
      content: RechazarPedidoDialog,
      data: { pedido: p },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe(actualizado => {
      if (actualizado) this.reload();
    });
  }

  protected anularPedido(): void {
    const p = this.pedido();
    if (!p || !this.puedeAnular()) return;
    const ref = this.dialog.open<AnularPedidoDialog, AnularPedidoDialogData>({
      title: `Anular pedido ${p.code}`,
      content: AnularPedidoDialog,
      data: { pedido: p },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe(actualizado => {
      if (actualizado) this.reload();
    });
  }

  protected solicitarDespachoBodega(): void {
    const p = this.pedido();
    if (!p || !this.puedeSolicitarDespacho()) return;
    const ref = this.dialog.open<SolicitarDespachoDialog, SolicitarDespachoDialogData>({
      title: `Solicitar despacho a Bodega — ${p.code}`,
      content: SolicitarDespachoDialog,
      data: { pedido: p },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe(actualizado => {
      if (actualizado) this.reload();
    });
  }

  /** Reporte de Unidad del ticket de Pumping (formato DYN-MNT-RE-012) con lo registrado hasta ahora: salida y, si ya se hizo, llegada. */
  protected verReporteUnidad(descargar = false): void {
    const reporte = this.reporteUnidad();
    if (!reporte) return;
    this.documentoPdf.abrir({
      titulo: `Reporte de Unidad — ${reporte.reportCode}`,
      component: ReporteUnidadHoja,
      inputs: { reporte, ticketCode: this.avance()?.ticketPumpingCode ?? '' },
      nombreArchivo: `Reporte de Unidad ${reporte.reportCode}`,
      descargar,
    });
  }

  /** Datos del pedido que el formato DYN-SGI-RE-047 pide y no viajan en la cabecera del documento operativo. */
  private extrasReporteJob(): ReporteJobExtras {
    const p = this.pedido();
    if (!p) return {};
    return {
      campoBloque: `${p.campo} / ${p.bloque}`,
      taladro: p.taladroRig,
      ordenContrato: p.numeroContrato,
      representanteCliente: p.representanteCampo,
    };
  }

  /** Solo Facturación, Reporte Job de FCR o de Pumping, y solo antes de que el Pedido salga a firmas — el backend aplica la misma regla (409). */
  protected readonly puedeCorregirReporteJob = computed(() => {
    const p = this.pedido();
    const role = this.auth.currentUser()?.roleName;
    const rolPermitido = role === 'Facturación' || role === 'Superadmin' || role === 'Jefe de Base';
    return rolPermitido && !!p && !ESTADOS_PEDIDO_DOCUMENTOS_CERRADOS.includes(p.estado);
  });

  protected corregirReporteJob(doc: DocumentoOperativo): void {
    const ref = this.dialog.open<CorregirReporteJobDialog, CorregirReporteJobDialogData>({
      title: `Corregir Reporte Job — ${this.fechaCorta(doc.fecha)}`,
      content: CorregirReporteJobDialog,
      data: { doc },
      footer: false,
      width: '760px',
    });
    ref.afterClose.subscribe((guardado: CorregirReporteJobDialogResult | undefined) => {
      if (guardado) this.reload();
    });
  }

  protected verReporteJob(doc: DocumentoOperativo, descargar = false): void {
    if (!doc.header || !doc.actividades) return;
    this.documentoPdf.abrir({
      titulo: `Reporte Job — ${doc.fecha ?? ''}`,
      component: ReporteJobHoja,
      inputs: { header: doc.header, log: doc.actividades, extras: this.extrasReporteJob() },
      nombreArchivo: `Reporte diario de actividades ${doc.header.code} ${doc.fecha ?? ''}`.trim(),
      descargar,
    });
  }

  /** Un solo PDF de Reporte de Herramientas consolidando todos los días recibidos. */
  protected verReporteHerramientas(descargar = false): void {
    const docs = this.reporteHtasDocs();
    if (!docs.length || !docs[0].header) return;
    const herramientas = docs.flatMap(d => d.herramientas ?? []);
    const usoHerramientas = docs.flatMap(d => d.usoHerramientas ?? []);
    this.documentoPdf.abrir({
      titulo: 'Reporte de Herramientas',
      component: ReporteHerramientasHoja,
      inputs: { header: docs[0].header, tools: herramientas, usageLog: usoHerramientas },
      orientacion: 'landscape',
      nombreArchivo: `Reporte de Herramientas ${docs[0].header.code}`,
      descargar,
    });
  }

  /** Consolida los días recibidos en un solo PDF — mismo criterio que `verReporteHerramientas()`. */
  protected verReporteJobConsolidado(): void {
    const docs = this.reporteJobDocs();
    if (!docs.length || !docs[0].header) return;
    const log = docs.flatMap(d => d.actividades ?? []);
    this.documentoPdf.abrir({
      titulo: 'Reporte Job (consolidado)',
      component: ReporteJobHoja,
      inputs: { header: docs[0].header, log, extras: this.extrasReporteJob() },
      nombreArchivo: `Reporte diario de actividades ${docs[0].header.code}`,
    });
  }

  protected verPrefacturaPdf(): void {
    const pf = this.prefactura();
    const p = this.pedido();
    if (!pf || !p) return;
    this.documentoPdf.abrir({
      titulo: 'Prefactura — Vista de impresión',
      component: PrefacturaHoja,
      inputs: { prefactura: pf, pedido: p },
      nombreArchivo: `Prefactura ${pf.code}`,
    });
  }

  /**
   * Descarga real (archivo en disco) del documento de monitoreo o mezcla —
   * `origen: 'pumping'` va al ticket de Pumping (`PumpingDocumento`),
   * `origen: 'pedido'` va a los documentos adjuntos del propio Pedido
   * (`PedidoDocumento`, el que Ventas cargó al crear el pedido). Para
   * `origen: 'generado'` (Reporte Job/Herramientas/Prefactura) no hay
   * archivo real: se abre el mismo diálogo de vista previa, que trae su
   * propio botón "Descargar PDF" (jsPDF).
   */
  protected descargarDocumentoReal(doc: DocumentoRealPedido): void {
    if (doc.origen === 'generado' && doc.tipo !== 'despacho_bodega' && doc.tipo !== 'msds') {
      if (doc.tipo === 'reporte_job') this.verReporteJobConsolidado();
      else if (doc.tipo === 'reporte_herramientas') this.verReporteHerramientas();
      else if (doc.tipo === 'prefactura') this.verPrefacturaPdf();
      return;
    }
    // 'despacho_bodega' SÍ es un archivo real (el que Bodega adjuntó al
    // despachar) aunque `origen` sea 'generado' — mismo mecanismo de
    // descarga que un documento ya firmado (documentos-firmados), porque
    // literalmente se guardó ahí (ver `despacharSolicitudDespacho` en el
    // backend).
    const obs$ =
      doc.tipo === 'despacho_bodega' || doc.tipo === 'msds'
        ? this.pedidoService.descargarDocumentoFirmado(this.pedidoId, doc.tipo, doc.referencia)
        : doc.origen === 'pumping'
          ? this.pumpingService.descargarDocumento(doc.ticketId!, doc.campo!)
          : this.pedidoService.descargarDocumentoAdjunto(this.pedidoId, doc.pedidoDocumentoId!);
    obs$.subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.nombreOriginal;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.notify.error('Error', 'No se pudo descargar el documento.'),
    });
  }

  /**
   * Sube la versión firmada (electrónicamente, fuera del sistema) del
   * documento de monitoreo/mezcla — habilita "Enviar al cliente" cuando
   * todos los `documentosReales` del pedido ya tienen la suya (ver
   * `avance.documentosFirmadosCompletos` y `puedeEnviar` en
   * prefactura-detail-page.ts).
   */
  protected subirDocumentoFirmado(doc: DocumentoRealPedido, files: FileList | null): void {
    const archivo = files?.[0];
    if (!archivo) return;
    this.pedidoService.subirDocumentoFirmado(this.pedidoId, doc.tipo, doc.referencia, archivo).subscribe({
      next: () => {
        this.notify.success('Documento firmado cargado', `${doc.nombreOriginal} — versión firmada guardada.`);
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo subir el documento firmado.'),
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

  /** Puente Pedido -> ticket operativo: abre el ticket de FCR o de Pumping según la línea del pedido. */
  protected irATicket(): void {
    const t = this.ticketAsociado();
    if (!t.id) return;
    const modulo = this.pedido()?.lineaServicio === 'pumping' ? 'pumping' : 'fcr';
    this.router.navigate([`/modulos/operativo/${modulo}`, t.id]);
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

  protected verGuiaRemisionPdf(descargar = false): void {
    const guia = this.guiaRemision();
    const p = this.pedido();
    if (!guia || !p) return;
    this.documentoPdf.abrir({
      titulo: 'Guía de remisión — Vista de impresión',
      component: GuiaRemisionHoja,
      inputs: { guia, pedido: p },
      nombreArchivo: `Guía de remisión ${p.code}`,
      descargar,
    });
  }

  /** Simula que un operador de FCR/Pumping cargó y firmó un Reporte Job de un día más. */
  protected simularCargaOperador(): void {
    const p = this.pedido();
    if (!p || this.simulando()) return;
    this.simulando.set(true);
    const proximaFecha = new Date();
    const iso = proximaFecha.toISOString().slice(0, 10);
    const origen = p.lineaServicio;
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
