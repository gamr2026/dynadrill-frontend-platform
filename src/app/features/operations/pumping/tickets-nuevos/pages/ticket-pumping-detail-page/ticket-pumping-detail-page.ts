import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../../core/services/auth.service';
import {
  ESTADO_SOLICITUD_LABELS,
  ESTADO_SOLICITUD_TONO,
  PERMISO_CAMBIOS_APROBAR,
  PERMISO_CAMBIOS_SOLICITAR,
  etiquetaAplicacion,
  type SolicitudCambioItems,
} from '../../models/cambio-items';
import { MotivoDialog, type MotivoDialogData } from '../../../../../../shared/components/motivo-dialog/motivo-dialog';
import { ArchivosService } from '../../../../../facturacion/pedidos-comercial/services/archivos.service';
import { mensajeErrorArchivo } from '../../../../../facturacion/pedidos-comercial/models/documentos-pedido';
import { formatoDia } from '../../../../../facturacion/pedidos-comercial/models/pedido-comercial.model';
import { PERMISO_PREFACTURA_FIRMA_COMPANY_MAN, PERMISO_PREFACTURA_VISTA_TICKET } from '../../../../../facturacion/pedidos-comercial/models/prefactura-comercial';
import { TicketAsignarDialog, type TicketAsignarDialogData } from '../../components/ticket-asignar-dialog/ticket-asignar-dialog';
import { TicketCambioItemsDialog, type TicketCambioItemsDialogData } from '../../components/ticket-cambio-items-dialog/ticket-cambio-items-dialog';
import { TicketCambioItemsRevisarDialog, type TicketCambioItemsRevisarDialogData } from '../../components/ticket-cambio-items-revisar-dialog/ticket-cambio-items-revisar-dialog';
import { TicketIngresoDialog, type TicketIngresoDialogData } from '../../components/ticket-ingreso-dialog/ticket-ingreso-dialog';
import { TicketQuimicosDialog, type TicketQuimicosDialogData } from '../../components/ticket-quimicos-dialog/ticket-quimicos-dialog';
import { TicketMaintenanceCard } from '../../../components/ticket-maintenance-card/ticket-maintenance-card';
import { TicketPrefacturaDialog, type TicketPrefacturaDialogData } from '../../components/ticket-prefactura-dialog/ticket-prefactura-dialog';
import { TicketReporteDiarioDialog, type TicketReporteDiarioDialogData } from '../../components/ticket-reporte-diario-dialog/ticket-reporte-diario-dialog';
import { TicketReporteLlegadaDialog, type TicketReporteLlegadaDialogData } from '../../components/ticket-reporte-llegada-dialog/ticket-reporte-llegada-dialog';
import { TicketReporteUnidadDialog, type TicketReporteUnidadDialogData } from '../../components/ticket-reporte-unidad-dialog/ticket-reporte-unidad-dialog';
import { TicketTerminosDialog, type TicketTerminosDialogData } from '../../components/ticket-terminos-dialog/ticket-terminos-dialog';
import {
  MODULO_LABELS,
  ORIGEN_REQUISITO_LABELS,
  PASO_ASIGNACION,
  MODULO_ARCHIVO_MONITOREO,
  PASO_EJECUCION,
  PASO_RETORNO,
  PASO_REVISION_FINAL,
  PASO_REVISION_SALIDA,
  PASO_TRASLADO_LLEGADA,
  PERMISO_PUENTE_REQUISITOS,
  TONO_MACRO,
  etiquetaRol,
  etiquetaRoles,
  etiquetaTipoServicio,
  mensajeErrorTicket,
  nombrePaso,
  pendientesDelPaso,
  ESTADO_REPORTE_DIARIO_LABELS,
  ESTADO_REPORTE_DIARIO_TONO,
  type DocumentoDelTicket,
  type QuimicosTicket,
  type ReporteDiarioDia,
  type RequisitoTicket,
  type SiguientePaso,
  type TicketPumping,
} from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

/**
 * Ticket de un pedido de Pumping: los datos del pedido tal como se abrió, el paso actual con su responsable, y las acciones
 * que le tocan a quien lo atiende. Hoy el Jefe de Base revisa el pedido y lo pasa a "Asignación"; los demás pasos se suman
 * por fases.
 */
@Component({
  selector: 'app-ticket-pumping-detail-page',
  imports: [TicketMaintenanceCard, DynadrillBannerComponent, DynadrillButtonComponent, DynadrillScreenHeaderComponent, DynadrillSpinnerComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-pumping-detail-page.html',
  styleUrl: './ticket-pumping-detail-page.scss',
})
export class TicketPumpingDetailPage {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly archivos = inject(ArchivosService);

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly ticket = signal<TicketPumping | null>(null);

  /** Quien además puede ver el pedido en Facturación tiene el enlace al pedido. */
  protected readonly puedeVerPedido = computed(() => this.auth.can('comercial.pedidos.ver'));
  protected readonly tipos = computed(() => (this.ticket()?.tiposServicio ?? []).map(etiquetaTipoServicio));
  /** El paso de Asignación no avanza con un botón: se completa asignando al equipo. */
  protected readonly debeAsignar = computed(() => {
    const t = this.ticket();
    return !!t && t.puedeActuar && t.paso.codigo === PASO_ASIGNACION;
  });
  protected readonly fueraDeAlcance = computed(() => {
    const t = this.ticket();
    return !!t && t.puedeActuar && t.siguientes.length === 0 && !this.debeAsignar();
  });
  // ── Traslado de salida: lo que se exige para salir del paso ──
  private readonly yo = computed(() => this.auth.currentUser());
  protected readonly puedeConfirmarAMano = computed(() => this.auth.can(PERMISO_PUENTE_REQUISITOS));
  /** Los requisitos del paso actual (los que hay que cumplir para salir de él) y los ya cumplidos de pasos anteriores. */
  protected readonly requisitosVisibles = computed(() => {
    const t = this.ticket();
    return t ? t.requisitos.filter(r => r.paso === t.paso.codigo || r.estado === 'cumplido') : [];
  });
  protected readonly pendientes = computed(() => {
    const t = this.ticket();
    return t ? pendientesDelPaso(t) : [];
  });
  protected readonly hayRequisitos = computed(() => (this.ticket()?.requisitos.length ?? 0) > 0);
  /** Está en el paso del que sale el requisito (solo ahí se llenan términos, checklist y reporte). */
  protected enSuPaso(r: RequisitoTicket): boolean {
    return this.ticket()?.paso.codigo === r.paso;
  }
  protected esMiOperador(r: RequisitoTicket): boolean {
    return !!r.usuarioId && r.usuarioId === this.yo()?.id;
  }
  /** ¿Puedo firmar el reporte de esta unidad? (su operador, o Superadmin) */
  protected puedeFirmarUnidad(r: RequisitoTicket): boolean {
    const t = this.ticket();
    if (!t || !r.vehiculoId) return false;
    return this.yo()?.roleCode === 'superadmin' || t.asignacion.operadores.some(o => o.vehiculoId === r.vehiculoId && o.usuarioId === this.yo()?.id);
  }
  protected puedeLlenarEquipo(): boolean {
    const t = this.ticket();
    const u = this.yo();
    if (!t || !u) return false;
    return ['superadmin', 'jefe_base'].includes(u.roleCode) || t.asignacion.supervisor?.usuarioId === u.id || t.asignacion.operadores.some(o => o.usuarioId === u.id);
  }
  protected readonly modulo = (r: RequisitoTicket) => MODULO_LABELS[r.modulo];
  protected readonly origenRequisito = (r: RequisitoTicket) => (r.origen ? ORIGEN_REQUISITO_LABELS[r.origen] : '');

  protected abrirTerminos(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketTerminosDialog, TicketTerminosDialogData>({
      title: 'Términos y condiciones de uso de equipos',
      content: TicketTerminosDialog,
      data: { ticketId: t.id },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe((ok: boolean | undefined) => ok && this.recargar());
  }

  protected abrirIngreso(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketIngresoDialog, TicketIngresoDialogData>({
      title: 'Checklist de ingreso a locación',
      content: TicketIngresoDialog,
      data: { ticketId: t.id, soloLectura: t.paso.codigo !== 'ejecucion_operativa' || !this.puedeLlenarEquipo() },
      footer: false,
      width: '720px',
    });
    ref.afterClose.subscribe((hubo: boolean | undefined) => hubo && this.recargar());
  }

  protected abrirReporte(r: RequisitoTicket): void {
    const t = this.ticket();
    if (!t || !r.vehiculoId) return;
    const ref = this.dialog.open<TicketReporteUnidadDialog, TicketReporteUnidadDialogData>({
      title: `Reporte de unidad de salida — ${r.para ?? ''}`,
      content: TicketReporteUnidadDialog,
      data: { ticketId: t.id, vehiculoId: r.vehiculoId, placa: r.para ?? '', soloLectura: t.paso.codigo !== 'traslado_salida' || !this.puedeFirmarUnidad(r) },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((ok: boolean | undefined) => ok && this.recargar());
  }

  /** El Supervisor del equipo aprueba la inspección de la unidad al revisar los reportes de salida (mientras Flota no publique la suya). */
  protected puedeAprobarInspeccion(r: RequisitoTicket): boolean {
    return r.codigo === 'inspeccion_vehiculo_aprobada' && r.estado === 'pendiente' && this.ticket()?.paso.codigo === PASO_REVISION_SALIDA && this.esSupervisorDelTicket();
  }
  protected aprobarInspeccion(r: RequisitoTicket): void {
    const t = this.ticket();
    if (!t || !r.vehiculoId || this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.servicio.aprobarInspeccion(t.id, r.vehiculoId).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success('Inspección aprobada', `Unidad ${r.para ?? ''}.`);
        this.recargar();
      },
      error: err => {
        this.ocupado.set(false);
        this.errorAccion.set(mensajeErrorTicket(err, 'No se pudo aprobar la inspección.'));
      },
    });
  }

  /** Reporte de unidad de llegada: lo firma el operador de la unidad en el Traslado de llegada; después se consulta. */
  protected abrirReporteLlegada(r: RequisitoTicket): void {
    const t = this.ticket();
    if (!t || !r.vehiculoId) return;
    const ref = this.dialog.open<TicketReporteLlegadaDialog, TicketReporteLlegadaDialogData>({
      title: `Reporte de unidad de llegada — ${r.para ?? ''}`,
      content: TicketReporteLlegadaDialog,
      data: { ticketId: t.id, vehiculoId: r.vehiculoId, placa: r.para ?? '', soloLectura: t.paso.codigo !== PASO_TRASLADO_LLEGADA || !this.puedeFirmarUnidad(r) },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((ok: boolean | undefined) => ok && this.recargar());
  }

  // ── Prefactura desde el ticket (revisión final) ──
  /** El mantenimiento no es un paso del flujo: la tarjeta se ve en cualquier estado, a quien puede leer Mantenimiento. */
  protected readonly puedeVerMantenimientos = computed(() => this.auth.can('mantenimiento.operaciones.ver') || this.auth.can('mantenimiento.ordenes.ver'));
  protected readonly puedeVerPrefactura = computed(() => this.auth.can(PERMISO_PREFACTURA_VISTA_TICKET) && ['revision_final', 'cierre'].includes(this.ticket()?.paso.codigo ?? ''));
  protected abrirPrefactura(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketPrefacturaDialog, TicketPrefacturaDialogData>({
      title: 'Prefactura del servicio',
      content: TicketPrefacturaDialog,
      data: { pedidoId: t.pedidoId, puedeFirmar: t.paso.codigo === PASO_REVISION_FINAL && this.auth.can(PERMISO_PREFACTURA_FIRMA_COMPANY_MAN) },
      footer: false,
      width: '860px',
    });
    ref.afterClose.subscribe((firmada: boolean | undefined) => firmada && this.recargar());
  }

  /** PUENTE TEMPORAL: confirma a mano un requisito de un módulo que todavía no existe en el portal nuevo. */
  protected confirmarAMano(r: RequisitoTicket): void {
    const ref = this.dialog.open<MotivoDialog, MotivoDialogData>({
      title: 'Confirmar a mano (temporal)',
      content: MotivoDialog,
      data: {
        mensaje: `${r.nombre}${r.para ? ' — ' + r.para : ''}. Mientras ${MODULO_LABELS[r.modulo]} no esté en el portal nuevo, se confirma a mano. Indique por qué lo confirma.`,
        label: 'Motivo',
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (!motivo) return;
      this.servicio.cumplirRequisitoManual(r.id, motivo).subscribe({
        next: () => {
          this.notify.success('Requisito confirmado', 'Quedó registrado como confirmado a mano.');
          this.recargar();
        },
        error: err => this.notify.error('No se pudo confirmar', mensajeErrorTicket(err, 'No se pudo confirmar el requisito.')),
      });
    });
  }

  // ── Químicos del ticket (asignado, usado, devuelto y pendiente; el movimiento vive en Inventario) ──
  protected readonly quimicos = signal<QuimicosTicket | null>(null);
  protected readonly hayQuimicos = computed(() => (this.quimicos()?.quimicos.length ?? 0) > 0);
  protected readonly esSupervisorDelTicket = computed(() => {
    const t = this.ticket();
    const u = this.yo();
    return !!t && !!u && (u.roleCode === 'superadmin' || t.asignacion.supervisor?.usuarioId === u.id);
  });
  protected readonly esDelEquipo = computed(() => {
    const t = this.ticket();
    const u = this.yo();
    return !!t && !!u && (u.roleCode === 'superadmin' || t.asignacion.operadores.some(o => o.usuarioId === u.id));
  });
  /** El Operador del equipo registra el consumo en la Ejecución operativa; el Supervisor del equipo devuelve en el Control de retorno. */
  protected readonly puedeConsumir = computed(() => this.ticket()?.paso.codigo === PASO_EJECUCION && this.esDelEquipo() && this.pendienteDeQuimicos());
  protected readonly puedeDevolver = computed(() => this.ticket()?.paso.codigo === PASO_RETORNO && this.esSupervisorDelTicket() && this.pendienteDeQuimicos());
  private readonly pendienteDeQuimicos = computed(() => (this.quimicos()?.quimicos ?? []).some(q => q.pendiente > 0));
  /** El Supervisor del equipo formaliza la ejecución (el Company Man aprobó el inicio) en la Ejecución operativa. */
  protected readonly puedeFormalizar = computed(() => {
    const t = this.ticket();
    return !!t && t.paso.codigo === PASO_EJECUCION && this.esSupervisorDelTicket() && t.requisitos.some(r => r.codigo === 'ejecucion_formalizada' && r.estado === 'pendiente');
  });

  // ── Reporte Diario de Actividades (Reporte Job) ──
  protected readonly reportesDiarios = signal<ReporteDiarioDia[]>([]);
  protected readonly fechaNueva = signal(new Date().toISOString().slice(0, 10));
  protected readonly estadoDia = (e: ReporteDiarioDia['estado']) => ESTADO_REPORTE_DIARIO_LABELS[e];
  protected readonly tonoDia = (e: ReporteDiarioDia['estado']) => ESTADO_REPORTE_DIARIO_TONO[e];
  /** El Operador del equipo llena el reporte diario mientras el ticket está en la Ejecución operativa. */
  protected readonly puedeLlenarReporteDiario = computed(() => this.ticket()?.paso.codigo === PASO_EJECUCION && this.esDelEquipo());
  /** Se muestra desde la ejecución: antes no hay nada que reportar. */
  protected readonly muestraReporteDiario = computed(() => ['ejecucion_operativa', 'control_retorno', 'traslado_llegada', 'revision_reportes_llegada', 'revision_final', 'cierre'].includes(this.ticket()?.paso.codigo ?? ''));

  // ── Cambio de ítems del pedido (propone el Operador, aprueba el Supervisor, aplica Comercial) ──
  protected readonly cambiosItems = signal<SolicitudCambioItems[]>([]);
  protected readonly estadoCambio = (s: SolicitudCambioItems) => ESTADO_SOLICITUD_LABELS[s.estado];
  protected readonly tonoCambio = (s: SolicitudCambioItems) => ESTADO_SOLICITUD_TONO[s.estado];
  protected readonly aplicacionCambio = etiquetaAplicacion;
  protected readonly esDelEquipoOSupervisor = computed(() => this.esDelEquipo() || this.esSupervisorDelTicket());
  /** El equipo del ticket propone cambios mientras el ticket no esté cerrado y no haya otra solicitud esperando al Supervisor. */
  protected readonly puedeProponerCambio = computed(() => {
    const t = this.ticket();
    return !!t && this.hayAsignacion() && t.paso.codigo !== 'cierre' && this.auth.can(PERMISO_CAMBIOS_SOLICITAR) && this.esDelEquipoOSupervisor() && !this.cambiosItems().some(s => s.estado === 'pendiente');
  });
  protected readonly puedeRevisarCambios = computed(() => this.auth.can(PERMISO_CAMBIOS_APROBAR) && this.esSupervisorDelTicket());
  protected readonly muestraCambios = computed(() => this.hayAsignacion() && (this.cambiosItems().length > 0 || this.puedeProponerCambio()));

  private cargarCambiosItems(id: string): void {
    if (!this.auth.can(PERMISO_CAMBIOS_SOLICITAR) && !this.auth.can(PERMISO_CAMBIOS_APROBAR)) return;
    this.servicio.cambiosItems(id).subscribe({ next: l => this.cambiosItems.set(l), error: () => this.cambiosItems.set([]) });
  }

  protected proponerCambio(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketCambioItemsDialog, TicketCambioItemsDialogData>({
      title: 'Proponer un cambio de ítems del pedido',
      content: TicketCambioItemsDialog,
      data: { ticketId: t.id, pedidoId: t.pedidoId, pedidoCodigo: t.pedidoCodigo },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((s: SolicitudCambioItems | undefined) => s && this.cargarCambiosItems(t.id));
  }

  protected verCambio(s: SolicitudCambioItems): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketCambioItemsRevisarDialog, TicketCambioItemsRevisarDialogData>({
      title: 'Cambio de ítems del pedido',
      content: TicketCambioItemsRevisarDialog,
      data: { solicitud: s, pedidoId: t.pedidoId, puedeRevisar: this.puedeRevisarCambios() },
      footer: false,
      width: '820px',
    });
    ref.afterClose.subscribe((r: SolicitudCambioItems | undefined) => r && this.cargarCambiosItems(t.id));
  }

  // ── Monitoreo de cada día (documento del ticket) ──
  protected readonly documentos = signal<DocumentoDelTicket[]>([]);
  protected readonly subiendoMonitoreo = signal<string | null>(null);
  /** Los monitoreos de un día (el último es el vigente). */
  protected monitoreosDe(fecha: string): DocumentoDelTicket[] {
    return this.documentos().filter(d => d.tipo === 'monitoreo' && d.fecha === fecha);
  }

  private cargarDocumentos(id: string): void {
    this.servicio.documentos(id).subscribe({ next: l => this.documentos.set(l), error: () => this.documentos.set([]) });
  }

  protected alElegirMonitoreo(fecha: string, e: Event): void {
    const input = e.target as HTMLInputElement;
    const t = this.ticket();
    const archivo = input.files?.[0];
    input.value = '';
    if (!t || !archivo || this.subiendoMonitoreo()) return;
    this.subiendoMonitoreo.set(fecha);
    this.errorAccion.set(null);
    let subiendo = true;
    this.archivos
      .subir(archivo, MODULO_ARCHIVO_MONITOREO)
      .pipe(
        switchMap(a => {
          subiendo = false;
          return this.servicio.adjuntarMonitoreo(t.id, fecha, a.id);
        }),
      )
      .subscribe({
        next: l => {
          this.subiendoMonitoreo.set(null);
          this.documentos.set(l);
          this.notify.success('Monitoreo adjuntado', `Día ${fecha}.`);
        },
        error: err => {
          this.subiendoMonitoreo.set(null);
          this.errorAccion.set(subiendo ? mensajeErrorArchivo(err) : mensajeErrorTicket(err, 'No se pudo adjuntar el monitoreo.'));
        },
      });
  }

  protected descargarMonitoreo(d: DocumentoDelTicket): void {
    this.archivos.contenido(d.archivoId).subscribe({
      next: blob => this.archivos.guardarComo(blob, `Monitoreo ${d.fecha ?? ''}`.trim()),
      error: () => this.errorAccion.set('No se pudo descargar el monitoreo.'),
    });
  }

  private cargarReportesDiarios(id: string): void {
    this.servicio.reportesDiarios(id).subscribe({ next: l => this.reportesDiarios.set(l), error: () => this.reportesDiarios.set([]) });
  }

  protected abrirReporteDiario(fecha: string, nuevo = false): void {
    const t = this.ticket();
    if (!t || !fecha) return;
    const dia = this.reportesDiarios().find(d => d.fecha === fecha);
    const ref = this.dialog.open<TicketReporteDiarioDialog, TicketReporteDiarioDialogData>({
      title: 'Reporte diario de actividades',
      content: TicketReporteDiarioDialog,
      data: {
        ticketId: t.id,
        fecha,
        nuevo: nuevo && !dia,
        soloLectura: !this.puedeLlenarReporteDiario() || dia?.estado === 'corregido',
        cabecera: {
          cliente: t.cliente,
          pozo: t.pozo,
          campo: t.campo,
          taladro: t.taladro,
          contrato: t.numeroContrato,
          supervisor: t.asignacion.supervisor?.nombre ?? null,
        },
      },
      footer: false,
      width: '980px',
    });
    ref.afterClose.subscribe((hubo: boolean | undefined) => hubo && this.cargarReportesDiarios(t.id));
  }

  private cargarQuimicos(id: string): void {
    this.servicio.quimicos(id).subscribe({ next: q => this.quimicos.set(q), error: () => this.quimicos.set(null) });
  }

  protected abrirQuimicos(modo: 'consumo' | 'devolucion'): void {
    const t = this.ticket();
    const q = this.quimicos();
    if (!t || !q) return;
    const ref = this.dialog.open<TicketQuimicosDialog, TicketQuimicosDialogData>({
      title: modo === 'consumo' ? 'Consumo de químicos' : 'Devolver químicos a bodega',
      content: TicketQuimicosDialog,
      data: { ticketId: t.id, modo, quimicos: q.quimicos },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe((nuevo: QuimicosTicket | undefined) => nuevo && this.quimicos.set(nuevo));
  }

  protected formalizar(): void {
    const t = this.ticket();
    if (!t || this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.servicio.formalizarEjecucion(t.id).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success('Ejecución formalizada', 'Quedó registrado que el Company Man aprobó el inicio.');
        this.recargar();
      },
      error: err => {
        this.ocupado.set(false);
        this.errorAccion.set(mensajeErrorTicket(err, 'No se pudo formalizar la ejecución.'));
      },
    });
  }

  private recargar(): void {
    const t = this.ticket();
    if (!t) return;
    this.servicio.detalle(t.id).subscribe({ next: n => this.ticket.set(n), error: () => undefined });
    this.cargarQuimicos(t.id);
    this.cargarReportesDiarios(t.id);
    this.cargarCambiosItems(t.id);
    this.cargarDocumentos(t.id);
  }

  protected readonly hayAsignacion = computed(() => {
    const a = this.ticket()?.asignacion;
    return !!a && (!!a.supervisor || a.operadores.length > 0 || a.unidades.length > 0);
  });

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  private cargar(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return void this.router.navigate(['/modulos/operativo/pumping/pedidos']);
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.detalle(id).subscribe({
      next: t => {
        this.ticket.set(t);
        this.cargando.set(false);
        this.cargarQuimicos(t.id);
        this.cargarReportesDiarios(t.id);
        this.cargarCambiosItems(t.id);
        this.cargarDocumentos(t.id);
      },
      error: err => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar el ticket. Intente de nuevo.'));
      },
    });
  }

  /** Pasa al siguiente paso; si la salida exige motivo (p. ej. rechazar la revisión final), lo pide antes. */
  protected avanzar(s: SiguientePaso): void {
    const t = this.ticket();
    if (!t || this.ocupado()) return;
    if (!s.requiereMotivo) return this.pasarA(s);
    const ref = this.dialog.open<MotivoDialog, MotivoDialogData>({
      title: `Devolver a ${s.nombre}`,
      content: MotivoDialog,
      data: { mensaje: `El ticket volverá a "${s.nombre}". Indique el motivo para que quien lo atiende sepa qué corregir.`, label: 'Motivo' },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((motivo: string | undefined) => motivo && this.pasarA(s, motivo));
  }

  private pasarA(s: SiguientePaso, motivo?: string): void {
    const t = this.ticket();
    if (!t) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.servicio.avanzar(t.id, s.codigo, motivo).subscribe({
      next: n => {
        this.ocupado.set(false);
        this.ticket.set(n);
        this.notify.success(`Pasó a ${s.nombre}`);
      },
      error: err => {
        this.ocupado.set(false);
        this.errorAccion.set(mensajeErrorTicket(err, 'No se pudo pasar al siguiente paso. Intente de nuevo.'));
      },
    });
  }

  protected asignar(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketAsignarDialog, TicketAsignarDialogData>({
      title: 'Asignar el equipo del servicio',
      content: TicketAsignarDialog,
      data: { ticketId: t.id, titulo: `Pedido ${t.pedidoCodigo} · Ticket ${t.ticketNumero ?? 's/n'}`, actual: t.asignacion },
      footer: false,
      width: '560px',
    });
    ref.afterClose.subscribe((nuevo: TicketPumping | undefined) => {
      if (!nuevo) return;
      this.ticket.set(nuevo);
      this.cargarQuimicos(nuevo.id);
    });
  }

  protected volver(): void {
    void this.router.navigate(['/modulos/operativo/pumping/pedidos']);
  }

  protected verPedido(): void {
    const t = this.ticket();
    if (t) void this.router.navigate(['/dashboard/facturacion/pedidos', t.pedidoId]);
  }

  protected readonly dia = formatoDia;
  protected readonly paso = nombrePaso;
  protected readonly rol = etiquetaRol;
  protected readonly roles = etiquetaRoles;
  protected readonly tono = (t: TicketPumping) => TONO_MACRO[t.paso.macro];
  protected readonly fechaHora = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : `${formatoDia(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
}
