import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../../../shared/components/motivo-dialog/motivo-dialog';
import { formatoDia } from '../../../../../facturacion/pedidos-comercial/models/pedido-comercial.model';
import { PERMISO_PREFACTURA_VISTA_TICKET } from '../../../../../facturacion/pedidos-comercial/models/prefactura-comercial';
import { ActaEntregaCarga } from '../../../../../qhse/documentos-pedido/components/acta-entrega-carga';
import {
  TicketPrefacturaDialog,
  type TicketPrefacturaDialogData,
} from '../../../../pumping/tickets-nuevos/components/ticket-prefactura-dialog/ticket-prefactura-dialog';
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
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillScreenHeaderComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    TicketFcrDocumentosPanel,
    TicketFcrEjecucionPanel,
    TicketFcrHerramientasPanel,
    TicketFcrInspeccionesPanel,
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

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly ticket = signal<TicketFcr | null>(null);
  protected readonly acta = signal<ActaReunion | null>(null);

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
    return !!a && (!!a.supervisor || a.operadores.length > 0 || a.unidades.length > 0);
  });

  private readonly codigoPaso = computed(() => this.ticket()?.paso.codigo ?? '');
  private readonly esServicio = computed(() => this.ticket()?.tipoOt === 'servicio');
  protected readonly debeDefinirTipo = computed(
    () => !!this.ticket()?.puedeActuar && this.codigoPaso() === PASO_TIPO_OPERADOR,
  );
  protected readonly debeAsignar = computed(
    () => !!this.ticket()?.puedeActuar && this.codigoPaso() === PASO_ASIGNACION,
  );
  protected readonly debeFirmarActa = computed(
    () => !!this.ticket()?.puedeActuar && this.codigoPaso() === PASO_REUNION,
  );
  protected readonly enRevisionReportes = computed(
    () => !!this.ticket()?.puedeActuar && this.codigoPaso() === PASO_REVISION_REPORTES,
  );
  /** Estos pasos se resuelven en su panel o con un botón propio; los botones genéricos de «siguiente» solo salen donde no hay acción propia. */
  protected readonly siguientesGenericos = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    if (
      this.debeDefinirTipo() ||
      this.debeAsignar() ||
      this.debeFirmarActa() ||
      this.enRevisionReportes()
    )
      return [];
    if (this.codigoPaso() === PASO_EJECUCION) return [];
    return t.siguientes;
  });

  protected readonly verHerramientas = computed(
    () =>
      [
        PASO_INSPECCION,
        PASO_APROBACION,
        PASO_PREPARACION,
        PASO_ASIGNACION,
        PASO_REUNION,
        PASO_EJECUCION,
        PASO_REVISION_REPORTES,
        PASO_RETORNO,
        PASO_CIERRE,
        PASO_CERRADO,
      ].includes(this.codigoPaso()) || this.codigoPaso() === 'revision_inicial',
  );
  protected readonly verInspecciones = computed(
    () => this.esServicio() && [PASO_INSPECCION, PASO_APROBACION].includes(this.codigoPaso()),
  );
  protected readonly verDocumentos = computed(() =>
    [PASO_INSPECCION, PASO_PREPARACION].includes(this.codigoPaso()),
  );
  protected readonly verEjecucion = computed(() =>
    [PASO_EJECUCION, PASO_REVISION_REPORTES, PASO_RETORNO, PASO_CIERRE, PASO_CERRADO].includes(
      this.codigoPaso(),
    ),
  );
  protected readonly verRetorno = computed(() =>
    [PASO_RETORNO, PASO_CIERRE, PASO_CERRADO].includes(this.codigoPaso()),
  );
  protected readonly verActaEntrega = computed(() =>
    [PASO_CIERRE, PASO_CERRADO].includes(this.codigoPaso()),
  );
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

  constructor() {
    queueMicrotask(() => this.cargar());
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

  private cargarActa(t: TicketFcr): void {
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
