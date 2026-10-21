import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TicketProgress } from '../../../../shared/ticket-progress/ticket-progress';
import type { TimelineTramo } from '../../../../../../shared/models/timeline.model';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../../core/services/auth.service';
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../../../shared/components/motivo-dialog/motivo-dialog';
import {
  formatoDia,
  type PedidoDetalle,
} from '../../../../../facturacion/pedidos-comercial/models/pedido-comercial.model';
import { PedidosComercialService } from '../../../../../facturacion/pedidos-comercial/services/pedidos-comercial.service';
import { TicketDocumentosQhse } from '../../../../shared/ticket-documentos-qhse/ticket-documentos-qhse';
import {
  TicketFichaPedido,
  type RespaldoFichaPedido,
} from '../../../../shared/ticket-ficha-pedido/ticket-ficha-pedido';
import { PERMISO_PREFACTURA_VISTA_TICKET } from '../../../../../facturacion/pedidos-comercial/models/prefactura-comercial';
import { ActaEntregaCarga } from '../../../../../qhse/documentos-pedido/components/acta-entrega-carga';
import {
  TicketPrefacturaDialog,
  type TicketPrefacturaDialogData,
} from '../../../../pumping/tickets-nuevos/components/ticket-prefactura-dialog/ticket-prefactura-dialog';
import {
  ESTADO_SOLICITUD_LABELS,
  ESTADO_SOLICITUD_TONO,
  etiquetaAplicacion,
  type SolicitudCambioItems,
} from '../../../../pumping/tickets-nuevos/models/cambio-items';
import {
  TicketCambioItemsDialog,
  type TicketCambioItemsDialogData,
} from '../../../../pumping/tickets-nuevos/components/ticket-cambio-items-dialog/ticket-cambio-items-dialog';
import {
  TicketCambioItemsRevisarDialog,
  type TicketCambioItemsRevisarDialogData,
} from '../../../../pumping/tickets-nuevos/components/ticket-cambio-items-revisar-dialog/ticket-cambio-items-revisar-dialog';
import {
  TicketFcrAsignarDialog,
  type TicketFcrAsignarDialogData,
} from '../../components/ticket-fcr-asignar-dialog';
import { TicketFcrDocumentosPanel } from '../../components/ticket-fcr-documentos-panel';
import { TicketFcrEjecucionPanel } from '../../components/ticket-fcr-ejecucion-panel';
import {
  TicketFcrFechaDialog,
  type TicketFcrFechaDialogData,
} from '../../components/ticket-fcr-fecha-dialog';
import { TicketFcrHerramientasPanel } from '../../components/ticket-fcr-herramientas-panel';
import { TicketFcrInspeccionesPanel } from '../../components/ticket-fcr-inspecciones-panel';
import { TicketFcrReportesRevision } from '../../components/ticket-fcr-reportes-revision';
import { TicketFcrRetornoPanel } from '../../components/ticket-fcr-retorno-panel';
import {
  TicketFcrTipoOperadorDialog,
  type TicketFcrTipoOperadorDialogData,
} from '../../components/ticket-fcr-tipo-operador-dialog';
import {
  MODULO_LABELS,
  ORIGEN_REQUISITO_LABELS,
  PASOS_FCR,
  PASO_APROBACION,
  PASO_ASIGNACION,
  PASO_CIERRE,
  PASO_CERRADO,
  PASO_EJECUCION,
  PASO_INSPECCION,
  PASO_PREPARACION,
  PASO_RETORNO,
  PASO_REUNION,
  PASO_REVISION_REPORTES,
  PASO_TIPO_OPERADOR,
  PERMISO_FCR_CAMBIOS_APROBAR,
  PERMISO_FCR_CAMBIOS_SOLICITAR,
  PERMISO_FCR_PUENTE,
  TIPO_OT_LABELS,
  TONO_MACRO,
  etiquetaRol,
  etiquetaRoles,
  etiquetaTipoServicio,
  mensajeErrorTicket,
  pendientesDelPaso,
  type ActaReunion,
  type RequisitoTicket,
  type SiguientePaso,
  type TicketFcr,
} from '../../models/ticket-fcr';
import { TicketsFcrService } from '../../services/tickets-fcr.service';

/**
 * Ticket de un pedido de FCR: datos del pedido, paso actual con su responsable y las acciones que le tocan a quien lo atiende. Cada paso
 * trae su panel (herramientas, inspección, documentos, ejecución, retorno); las acciones que no avanzan con un botón (tipo de operador,
 * asignación, acta de reunión, finalizar, aprobar reportes) viven aquí.
 */
@Component({
  selector: 'app-ticket-fcr-detail-page',
  imports: [
    ActaEntregaCarga,
    DynadrillIconComponent,
    NgTemplateOutlet,
    TicketDocumentosQhse,
    TicketFichaPedido,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillScreenHeaderComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    TicketProgress,
    TicketFcrDocumentosPanel,
    TicketFcrEjecucionPanel,
    TicketFcrHerramientasPanel,
    TicketFcrInspeccionesPanel,
    TicketFcrReportesRevision,
    TicketFcrRetornoPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-fcr-detail-page.html',
  styleUrl: './ticket-fcr-detail-page.scss',
})
export class TicketFcrDetailPage {
  private readonly servicio = inject(TicketsFcrService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly pedidos = inject(PedidosComercialService);

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly ticket = signal<TicketFcr | null>(null);
  protected readonly acta = signal<ActaReunion | null>(null);
  protected readonly pedido = signal<PedidoDetalle | null>(null);
  private readonly recibidas = signal<{ recibidas: number; total: number } | null>(null);
  protected readonly cambiosItems = signal<SolicitudCambioItems[]>([]);

  protected readonly puedeVerPedido = computed(() => this.auth.can('comercial.pedidos.ver'));
  protected readonly puedeConfirmarAMano = computed(() => this.auth.can(PERMISO_FCR_PUENTE));
  protected readonly tipos = computed(() =>
    (this.ticket()?.tiposServicio ?? []).map(etiquetaTipoServicio),
  );
  protected readonly pendientes = computed(() => {
    const t = this.ticket();
    return t ? pendientesDelPaso(t) : [];
  });
  protected readonly requisitosVisibles = computed(() => {
    const t = this.ticket();
    return t ? t.requisitos.filter((r) => r.paso === t.paso.codigo || r.estado === 'cumplido') : [];
  });
  protected readonly hayAsignacion = computed(() => {
    const a = this.ticket()?.asignacion;
    return !!a && (!!a.supervisor || a.operadores.length > 0);
  });

  private readonly codigoActual = computed(() => this.ticket()?.paso.codigo ?? '');
  /** El paso que quien consulta eligió en el avance del ticket (por omisión, el actual). */
  /** Los pasos del avance, como en la demo: la venta no pasa por los de servicios y «Cerrado» no es un paso aparte. */
  protected readonly pasos = computed(() =>
    PASOS_FCR.filter(
      (p) =>
        p.codigo !== PASO_CERRADO &&
        (this.ticket()?.tipoOt !== 'venta' ||
          ![PASO_TIPO_OPERADOR, PASO_INSPECCION, PASO_APROBACION].includes(p.codigo)),
    ),
  );
  protected readonly indicePaso = computed(() => {
    const i = this.pasos().findIndex((p) => p.codigo === this.codigoActual());
    return i < 0 ? this.pasos().length - 1 : i;
  });
  protected readonly cerrado = computed(() => this.ticket()?.paso.macro === 'aprobado');
  protected readonly avancePaso = computed(() =>
    this.cerrado() ? this.pasos().length : this.indicePaso(),
  );
  protected readonly indiceFase = computed(() => this.indicePaso());
  /** Código del paso cuyo detalle se muestra: los paneles siguen a la fase elegida; las acciones, al paso actual. */
  private readonly codigoPaso = this.codigoActual;
  protected readonly etiquetasPasos = computed(() => this.pasos().map((p) => p.nombre));
  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');
  /** Las fases ya alcanzadas, de la primera a la actual: cada una queda apilada en la pantalla, como en la demo. */
  protected readonly fasesVisibles = computed(() =>
    this.cerrado() ? this.pasos() : this.pasos().slice(0, this.indicePaso() + 1),
  );
  protected esActual(codigo: string): boolean {
    return codigo === this.codigoActual() || (this.cerrado() && codigo === PASO_CIERRE);
  }
  /** El avance lateral lleva a la sección de la fase elegida. */
  protected seleccionarFase(i: number): void {
    const codigo = this.pasos()[i]?.codigo;
    document
      .getElementById(`fase-${codigo}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  protected readonly tramos = computed<(TimelineTramo | undefined)[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    const actual = this.indicePaso();
    return this.pasos().map((p, i) => {
      let k = -1;
      t.historial.forEach((h, j) => {
        if (h.pasoNuevo === p.codigo) k = j;
      });
      if (k < 0) return undefined;
      const h = t.historial[k];
      const fin = t.historial[k + 1]?.at;
      return {
        fase: p.nombre,
        macroEstado: i < actual || this.cerrado() ? 'aprobado' : 'en_proceso',
        inicio: h.at,
        fin,
        duracionMs: (fin ? new Date(fin).getTime() : Date.now()) - new Date(h.at).getTime(),
        actorNombre: h.actor?.nombre ?? 'Sistema',
        actorRolLabel: h.actor?.rol ? etiquetaRol(h.actor.rol) : undefined,
        motivo: h.motivo ?? undefined,
      } satisfies TimelineTramo;
    });
  });
  /** Qué se espera del ticket ahora y de quién (el banner de la demo). */
  protected readonly bannerAccion = computed(() => {
    const t = this.ticket();
    if (!t) return '';
    if (this.cerrado()) return 'El ticket está cerrado.';
    return t.puedeActuar
      ? `Es su turno: ${t.paso.nombre}.`
      : `Acción esperada: ${t.paso.nombre}, a cargo de ${etiquetaRoles(t.paso.roles)}.`;
  });
  protected irACambios(): void {
    document
      .getElementById('cambios-items')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  private readonly esServicio = computed(() => this.ticket()?.tipoOt === 'servicio');
  protected readonly debeDefinirTipo = computed(
    () => !!this.ticket()?.puedeActuar && this.codigoActual() === PASO_TIPO_OPERADOR,
  );
  protected readonly debeAsignar = computed(
    () => !!this.ticket()?.puedeActuar && this.codigoActual() === PASO_ASIGNACION,
  );
  protected readonly debeFirmarActa = computed(
    () => !!this.ticket()?.puedeActuar && this.codigoActual() === PASO_REUNION,
  );
  protected readonly enRevisionReportes = computed(
    () => !!this.ticket()?.puedeActuar && this.codigoActual() === PASO_REVISION_REPORTES,
  );
  /** Estos pasos se resuelven en su panel o con un botón propio; los botones genéricos de «siguiente» solo salen donde no hay acción propia. */
  protected readonly siguientesGenericos = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    if (this.enRevisionReportes()) return [];
    if (this.codigoActual() === PASO_EJECUCION) return [];
    return t.siguientes;
  });

  protected readonly verHerramientas = computed(() => !!this.ticket());
  protected readonly verInspecciones = computed(() => this.esServicio());
  protected readonly verDocumentos = computed(() => !!this.ticket());
  protected readonly verEjecucion = computed(() => !!this.ticket());
  protected readonly verRetorno = computed(() => !!this.ticket());
  protected readonly verActaEntrega = computed(() => !!this.ticket());
  protected readonly puedeVerPrefactura = computed(
    () =>
      this.auth.can(PERMISO_PREFACTURA_VISTA_TICKET) &&
      [PASO_CIERRE, PASO_CERRADO].includes(this.codigoPaso()),
  );

  protected readonly modulo = (r: RequisitoTicket) => MODULO_LABELS[r.modulo];
  protected readonly origenRequisito = (r: RequisitoTicket) =>
    r.origen ? ORIGEN_REQUISITO_LABELS[r.origen] : '';
  protected readonly dia = formatoDia;
  protected readonly rol = etiquetaRol;
  protected readonly roles = etiquetaRoles;
  protected readonly tipoOt = (t: TicketFcr) => TIPO_OT_LABELS[t.tipoOt];
  protected readonly tono = (t: TicketFcr) => TONO_MACRO[t.paso.macro];
  protected readonly paso = (codigo: string) =>
    PASOS_FCR.find((p) => p.codigo === codigo)?.nombre ?? codigo;
  protected readonly fechaHora = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : `${formatoDia(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  protected readonly respaldoFicha = computed<RespaldoFichaPedido>(() => {
    const t = this.ticket();
    return {
      campo: t?.campo ?? null,
      bloque: t?.bloque ?? null,
      pozo: t?.pozo ?? null,
      taladro: t?.taladro ?? null,
      numeroContrato: t?.numeroContrato ?? null,
      inicio: t?.fechaInicioServicio ?? null,
      fin: t?.fechaFinServicio ?? null,
    };
  });
  /** En servicios las herramientas se arman desde «Tipo de operador»; al llegar a la preparación pasan a su sección. */
  protected readonly herramientasEnTipoOperador = computed(
    () =>
      this.esServicio() &&
      this.indicePaso() < this.pasos().findIndex((x) => x.codigo === PASO_PREPARACION),
  );
  private readonly pedidoId = computed(() => this.ticket()?.pedidoId ?? null);
  protected readonly itemsPedido = computed(() => this.pedido()?.items ?? []);
  protected readonly operadoresTexto = computed(() => {
    const o = this.ticket()?.asignacion.operadores ?? [];
    return o.length ? o.map((x) => x.nombre).join(', ') : 'Sin asignar';
  });
  protected readonly herramientasRecibidas = computed(() => {
    const r = this.recibidas();
    return r ? `${r.recibidas} de ${r.total} recibidas` : '—';
  });
  /** «Fase anterior aprobada por …»: quien movió el ticket al paso actual. */
  protected readonly faseAnterior = computed(() => {
    const t = this.ticket();
    if (!t) return null;
    const h = [...t.historial].reverse().find((x) => x.pasoNuevo === t.paso.codigo);
    if (!h?.actor || !h.pasoAnterior) return null;
    return `Fase anterior aprobada por ${h.actor.nombre}${h.actor.rol ? ' (' + etiquetaRol(h.actor.rol) + ')' : ''} el ${formatoDia(h.at)}`;
  });

  constructor() {
    queueMicrotask(() => this.cargar());
    effect(() => {
      const t = this.ticket();
      if (!t) return;
      this.servicio.herramientas(t.id).subscribe({
        next: (h) =>
          this.recibidas.set({
            recibidas: h.herramientas.filter((x) => x.estado === 'recibida').length,
            total: h.herramientas.length,
          }),
        error: () => this.recibidas.set(null),
      });
    });
    // el pedido solo se vuelve a leer si cambia el ticket abierto, no cada vez que se recarga
    effect(() => {
      const pedidoId = this.pedidoId();
      if (!pedidoId || !this.puedeVerPedido()) return;
      this.pedidos.detalle(pedidoId).subscribe({
        next: (p) => this.pedido.set(p),
        error: () => this.pedido.set(null),
      });
    });
  }

  private cargar(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return void this.router.navigate(['/modulos/operativo/fcr/pedidos']);
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.detalle(id).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.cargando.set(false);
        this.cargarActa(t);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar el ticket. Intente de nuevo.'));
      },
    });
  }

  /** Recarga el ticket (lo llaman los paneles al cambiar algo); los paneles se refrescan solos con la versión nueva. */
  protected recargar(): void {
    const t = this.ticket();
    if (!t) return;
    this.servicio.detalle(t.id).subscribe({
      next: (n) => {
        this.ticket.set(n);
        this.cargarActa(n);
      },
      error: () => undefined,
    });
  }

  // ── Cambio de ítems del pedido: lo cotizado frente a lo realmente usado ──
  protected readonly estadoCambio = (s: SolicitudCambioItems) => ESTADO_SOLICITUD_LABELS[s.estado];
  protected readonly tonoCambio = (s: SolicitudCambioItems) => ESTADO_SOLICITUD_TONO[s.estado];
  protected readonly aplicacionCambio = etiquetaAplicacion;
  private readonly yo = computed(() => this.auth.currentUser());
  private readonly esSupervisorDelTicket = computed(() => {
    const t = this.ticket();
    const u = this.yo();
    return (
      !!t && !!u && (u.roleCode === 'superadmin' || t.asignacion.supervisor?.usuarioId === u.id)
    );
  });
  private readonly esDelEquipo = computed(() => {
    const t = this.ticket();
    const u = this.yo();
    return (
      !!t &&
      !!u &&
      (u.roleCode === 'superadmin' || t.asignacion.operadores.some((o) => o.usuarioId === u.id))
    );
  });
  protected readonly puedeProponerCambio = computed(() => {
    const t = this.ticket();
    return (
      !!t &&
      this.hayAsignacion() &&
      ![PASO_CIERRE, PASO_CERRADO].includes(this.codigoActual()) &&
      this.auth.can(PERMISO_FCR_CAMBIOS_SOLICITAR) &&
      (this.esDelEquipo() || this.esSupervisorDelTicket()) &&
      !this.cambiosItems().some((s) => s.estado === 'pendiente')
    );
  });
  protected readonly puedeRevisarCambios = computed(
    () => this.auth.can(PERMISO_FCR_CAMBIOS_APROBAR) && this.esSupervisorDelTicket(),
  );
  protected readonly muestraCambios = computed(
    () => this.hayAsignacion() && (this.cambiosItems().length > 0 || this.puedeProponerCambio()),
  );

  private cargarCambiosItems(id: string): void {
    if (
      !this.auth.can(PERMISO_FCR_CAMBIOS_SOLICITAR) &&
      !this.auth.can(PERMISO_FCR_CAMBIOS_APROBAR)
    )
      return;
    this.servicio
      .cambiosItems(id)
      .subscribe({ next: (l) => this.cambiosItems.set(l), error: () => this.cambiosItems.set([]) });
  }

  protected proponerCambio(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketCambioItemsDialog, TicketCambioItemsDialogData>({
      title: 'Proponer un cambio de ítems del pedido',
      content: TicketCambioItemsDialog,
      data: { ticketId: t.id, pedidoId: t.pedidoId, pedidoCodigo: t.pedidoCodigo, linea: 'fcr' },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe(
      (s: SolicitudCambioItems | undefined) => s && this.cargarCambiosItems(t.id),
    );
  }

  protected verCambio(s: SolicitudCambioItems): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<
      TicketCambioItemsRevisarDialog,
      TicketCambioItemsRevisarDialogData
    >({
      title: 'Cambio de ítems del pedido',
      content: TicketCambioItemsRevisarDialog,
      data: {
        solicitud: s,
        pedidoId: t.pedidoId,
        puedeRevisar: this.puedeRevisarCambios(),
        linea: 'fcr',
      },
      footer: false,
      width: '820px',
    });
    ref.afterClose.subscribe(
      (r: SolicitudCambioItems | undefined) => r && this.cargarCambiosItems(t.id),
    );
  }

  private cargarActa(t: TicketFcr): void {
    this.cargarCambiosItems(t.id);
    this.servicio
      .reunion(t.id)
      .subscribe({ next: (a) => this.acta.set(a), error: () => this.acta.set(null) });
  }

  private resultado(
    llamada: ReturnType<TicketsFcrService['detalle']>,
    exito: string,
    falla: string,
  ): void {
    this.ocupado.set(true);
    this.errorAccion.set(null);
    llamada.subscribe({
      next: (n) => {
        this.ocupado.set(false);
        this.ticket.set(n);
        this.notify.success(exito, '');
        this.cargarActa(n);
      },
      error: (err) => {
        this.ocupado.set(false);
        this.errorAccion.set(mensajeErrorTicket(err, falla));
      },
    });
  }

  /** Pasa al siguiente paso; si la salida exige motivo (devolver), lo pide antes. */
  protected avanzar(s: SiguientePaso): void {
    const t = this.ticket();
    if (!t || this.ocupado()) return;
    if (!s.requiereMotivo) return this.pasarA(s);
    const ref = this.dialog.open<MotivoDialog, MotivoDialogData>({
      title: `Devolver a ${s.nombre}`,
      content: MotivoDialog,
      data: {
        mensaje: `El ticket volverá a "${s.nombre}". Indique el motivo para que quien lo atiende sepa qué corregir.`,
        label: 'Motivo',
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((motivo: string | undefined) => motivo && this.pasarA(s, motivo));
  }

  private pasarA(s: SiguientePaso, motivo?: string): void {
    const t = this.ticket();
    if (!t) return;
    this.resultado(
      this.servicio.avanzar(t.id, s.codigo, motivo),
      `Pasó a ${s.nombre}`,
      'No se pudo pasar al siguiente paso. Intente de nuevo.',
    );
  }

  protected definirTipo(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketFcrTipoOperadorDialog, TicketFcrTipoOperadorDialogData>({
      title: 'Tipo de operador',
      content: TicketFcrTipoOperadorDialog,
      data: {
        ticketId: t.id,
        actual: {
          tipoOperadorId: t.tipoOperador?.id ?? null,
          inspectorId: t.inspector?.usuarioId ?? null,
        },
      },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe((n: TicketFcr | undefined) => n && this.ticket.set(n));
  }

  protected asignar(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketFcrAsignarDialog, TicketFcrAsignarDialogData>({
      title: 'Asignar el equipo del servicio',
      content: TicketFcrAsignarDialog,
      data: { ticketId: t.id, haySupervisor: !!t.asignacion.supervisor },
      footer: false,
      width: '600px',
    });
    ref.afterClose.subscribe((n: TicketFcr | undefined) => n && this.ticket.set(n));
  }

  protected firmarActa(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketFcrFechaDialog, TicketFcrFechaDialogData>({
      title: 'Acta de reunión operativa',
      content: TicketFcrFechaDialog,
      data: {
        mensaje: 'Registre la fecha en que se realizó la reunión operativa con el equipo.',
        etiqueta: 'Fecha de la reunión',
        inicial: new Date().toISOString().slice(0, 10),
        confirmar: 'Registrar acta',
      },
      footer: false,
      width: '440px',
    });
    ref.afterClose.subscribe((fecha: string | undefined) => {
      if (!fecha) return;
      this.ocupado.set(true);
      this.errorAccion.set(null);
      this.servicio.confirmarActa(t.id, fecha).subscribe({
        next: (a) => {
          this.ocupado.set(false);
          this.acta.set(a);
          this.notify.success('Acta registrada', '');
          this.recargar();
        },
        error: (err) => {
          this.ocupado.set(false);
          this.errorAccion.set(mensajeErrorTicket(err, 'No se pudo registrar el acta.'));
        },
      });
    });
  }

  protected aprobarReportes(): void {
    const t = this.ticket();
    if (t)
      this.resultado(
        this.servicio.aprobarReportes(t.id),
        'Reportes aprobados',
        'No se pudo aprobar los reportes.',
      );
  }

  protected rechazarReportes(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<MotivoDialog, MotivoDialogData>({
      title: 'Devolver los reportes',
      content: MotivoDialog,
      data: {
        mensaje:
          'El ticket vuelve a ejecución para que el equipo corrija la bitácora o el uso de herramientas.',
        label: 'Motivo',
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe(
      (motivo: string | undefined) =>
        motivo &&
        this.resultado(
          this.servicio.rechazarReportes(t.id, motivo),
          'Reportes devueltos',
          'No se pudo devolver los reportes.',
        ),
    );
  }

  protected abrirPrefactura(): void {
    const t = this.ticket();
    if (!t) return;
    this.dialog.open<TicketPrefacturaDialog, TicketPrefacturaDialogData>({
      title: 'Prefactura del servicio',
      content: TicketPrefacturaDialog,
      data: {
        pedidoId: t.pedidoId,
        puedeFirmar: false,
        ticketCodigo: String(t.ticketNumero ?? t.pedidoCodigo),
        pedidoCodigo: t.pedidoCodigo,
        cliente: t.cliente,
        pozo: t.pozo,
        campo: t.campo,
      },
      footer: false,
      width: '860px',
    });
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
      this.ocupado.set(true);
      this.errorAccion.set(null);
      this.servicio.cumplirRequisitoManual(r.id, motivo).subscribe({
        next: () => {
          this.ocupado.set(false);
          this.notify.success('Requisito confirmado', r.nombre);
          this.recargar();
        },
        error: (err) => {
          this.ocupado.set(false);
          this.errorAccion.set(mensajeErrorTicket(err, 'No se pudo confirmar el requisito.'));
        },
      });
    });
  }

  protected volver(): void {
    void this.router.navigate(['/modulos/operativo/fcr/pedidos']);
  }

  protected verPedido(): void {
    const t = this.ticket();
    if (t) void this.router.navigate(['/dashboard/facturacion/pedidos', t.pedidoId]);
  }
}
