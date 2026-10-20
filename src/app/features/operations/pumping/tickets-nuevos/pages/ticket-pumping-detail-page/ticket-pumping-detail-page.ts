import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillIconButtonComponent,
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
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../../../shared/components/motivo-dialog/motivo-dialog';
import { ArchivosService } from '../../../../../facturacion/pedidos-comercial/services/archivos.service';
import { mensajeErrorArchivo } from '../../../../../facturacion/pedidos-comercial/models/documentos-pedido';
import {
  formatoDia,
  formatoMoneda,
  type PedidoDetalle,
} from '../../../../../facturacion/pedidos-comercial/models/pedido-comercial.model';
import { PedidosComercialService } from '../../../../../facturacion/pedidos-comercial/services/pedidos-comercial.service';
import { TicketProgress } from '../../../../shared/ticket-progress/ticket-progress';
import type { TimelineTramo } from '../../../../../../shared/models/timeline.model';
import {
  PERMISO_ACTA_ENTREGA_CARGAR,
  PERMISO_DOCUMENTOS_GESTIONAR,
  PERMISO_DOCUMENTOS_VER,
  PERMISO_DOCUMENTOS_VER_TICKET,
  exigeMotivoSuplencia,
  fechaIso,
  insigniaArt,
  type DocumentoVigente,
  type PedidoDocumental,
} from '../../../../../qhse/documentos-pedido/models/documento-pedido';
import {
  ESTADO_EPI_ETIQUETA,
  PERMISO_EPI_SOLICITAR,
  type EstadoEpi,
  type OperadorEpiTicket,
} from '../../../../../qhse/entrega-epi/models/entrega-epi';
import { EntregaEpiService } from '../../../../../qhse/entrega-epi/services/entrega-epi.service';
import {
  TicketEpiDialog,
  type TicketEpiDialogData,
} from '../../components/ticket-epi-dialog/ticket-epi-dialog';
import {
  InspeccionVehiculoDialog,
  type InspeccionVehiculoDialogData,
} from '../../../../../flota/components/inspeccion-vehiculo-dialog';
import type {
  CasoInspeccion,
  InspeccionDetalle,
} from '../../../../../flota/models/inspeccion-flota.model';
import { FlotaInspeccionesService } from '../../../../../flota/services/flota-inspecciones.service';
import { TicketReporteUnidadForm } from '../../components/ticket-reporte-unidad-form/ticket-reporte-unidad-form';
import { DocumentosPedidoService } from '../../../../../qhse/documentos-pedido/services/documentos-pedido.service';
import {
  PERMISO_PREFACTURA_FIRMA_COMPANY_MAN,
  PERMISO_PREFACTURA_VISTA_TICKET,
} from '../../../../../facturacion/pedidos-comercial/models/prefactura-comercial';
import {
  TicketAsignarDialog,
  type TicketAsignarDialogData,
} from '../../components/ticket-asignar-dialog/ticket-asignar-dialog';
import {
  TicketCambioItemsDialog,
  type TicketCambioItemsDialogData,
} from '../../components/ticket-cambio-items-dialog/ticket-cambio-items-dialog';
import {
  TicketCambioItemsRevisarDialog,
  type TicketCambioItemsRevisarDialogData,
} from '../../components/ticket-cambio-items-revisar-dialog/ticket-cambio-items-revisar-dialog';
import {
  TicketIngresoDialog,
  type TicketIngresoDialogData,
} from '../../components/ticket-ingreso-dialog/ticket-ingreso-dialog';
import {
  TicketQuimicosDialog,
  type TicketQuimicosDialogData,
} from '../../components/ticket-quimicos-dialog/ticket-quimicos-dialog';
import { TicketMaintenanceCard } from '../../../components/ticket-maintenance-card/ticket-maintenance-card';
import {
  TicketPrefacturaDialog,
  type TicketPrefacturaDialogData,
} from '../../components/ticket-prefactura-dialog/ticket-prefactura-dialog';
import {
  TicketReporteDiarioDialog,
  type TicketReporteDiarioDialogData,
} from '../../components/ticket-reporte-diario-dialog/ticket-reporte-diario-dialog';
import {
  TicketReporteLlegadaDialog,
  type TicketReporteLlegadaDialogData,
} from '../../components/ticket-reporte-llegada-dialog/ticket-reporte-llegada-dialog';
import {
  TicketReporteUnidadDialog,
  type TicketReporteUnidadDialogData,
} from '../../components/ticket-reporte-unidad-dialog/ticket-reporte-unidad-dialog';
import {
  TicketTerminosDialog,
  type TicketTerminosDialogData,
} from '../../components/ticket-terminos-dialog/ticket-terminos-dialog';
import {
  CONFIRMACIONES_INGRESO,
  MODULO_LABELS,
  ORIGEN_REQUISITO_LABELS,
  ultimaLecturaPorGas,
  PASO_ASIGNACION,
  PASOS_PUMPING,
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
  type AceptacionOperador,
  type ConfirmacionIngreso,
  type DocumentoDelTicket,
  type GasIngreso,
  type IngresoLocacion,
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
  imports: [
    NgTemplateOutlet,
    TicketReporteUnidadForm,
    TicketMaintenanceCard,
    TicketProgress,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillCheckboxComponent,
    DynadrillDataTableComponent,
    DynadrillInputComponent,
    DynadrillScreenHeaderComponent,
    DynadrillSpinnerComponent,
    DynadrillIconButtonComponent,
    DynadrillTagComponent,
  ],
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
  private readonly pedidos = inject(PedidosComercialService);
  private readonly docsQhse = inject(DocumentosPedidoService);

  // ── Documentos QHSE del pedido (formato de recepción, SFI, ART, PT del día y Acta): los carga QHSE, aquí se consultan ──
  protected readonly puedeVerDocsQhse = computed(() => this.auth.can(PERMISO_DOCUMENTOS_VER));
  /** El equipo de Pumping ve el estado de los documentos del pedido de su ticket sin tener la bandeja de QHSE. */
  protected readonly puedeVerEstadoDocs = computed(
    () => this.puedeVerDocsQhse() || this.auth.can(PERMISO_DOCUMENTOS_VER_TICKET),
  );
  protected readonly documentosQhse = signal<PedidoDocumental | null>(null);
  protected readonly artInsignia = computed(() => {
    const art = this.documentosQhse()?.art ?? null;
    return art ? insigniaArt(art) : ({ text: 'Pendiente', tone: 'warning' } as const);
  });
  /** Una fila por operador asignado: sale de los requisitos de términos y condiciones del ticket. */
  protected readonly terminosPorOperador = computed(() =>
    (this.ticket()?.requisitos ?? []).filter((r) => r.codigo === 'terminos_aceptados'),
  );
  protected readonly terminosAceptados = computed(
    () =>
      this.terminosPorOperador().length > 0 &&
      this.terminosPorOperador().every((r) => r.estado === 'cumplido'),
  );

  // ── Entrega de EPI por operador: el equipo de Pumping la pide, QHSE la aprueba y la despacha (al despacharla el requisito se cumple solo) ──
  private readonly epiServicio = inject(EntregaEpiService);
  protected readonly puedeSolicitarEpi = computed(() => this.auth.can(PERMISO_EPI_SOLICITAR));
  protected readonly epiOperadores = signal<OperadorEpiTicket[]>([]);
  protected readonly muestraEpi = computed(
    () => this.puedeSolicitarEpi() && this.epiOperadores().length > 0,
  );
  protected readonly estadoEpi = (e: OperadorEpiTicket['entrega']): string =>
    e ? ESTADO_EPI_ETIQUETA[e.estado] : 'Sin solicitar';
  protected readonly tonoEpi = (
    e: OperadorEpiTicket['entrega'],
  ): 'success' | 'info' | 'error' | 'warning' | 'neutral' => {
    const por: Record<EstadoEpi, 'success' | 'info' | 'error' | 'warning'> = {
      despachado: 'success',
      aprobado: 'info',
      rechazado: 'error',
      solicitado: 'warning',
    };
    return e ? por[e.estado] : 'neutral';
  };
  protected puedePedirEpi(o: OperadorEpiTicket): boolean {
    return !o.entrega || o.entrega.estado === 'rechazado';
  }

  private cargarEpi(ticketId: string): void {
    if (!this.puedeSolicitarEpi()) return;
    this.epiServicio.deTicket(ticketId).subscribe({
      next: (l) => this.epiOperadores.set(l),
      error: () => this.epiOperadores.set([]),
    });
  }

  protected solicitarEpi(o: OperadorEpiTicket): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketEpiDialog, TicketEpiDialogData>({
      title: 'Solicitar entrega de EPI',
      content: TicketEpiDialog,
      data: {
        ticketId: t.id,
        trabajadorId: o.usuarioId,
        trabajadorNombre: o.nombre,
        trabajadorCargo: o.cargo,
      },
      footer: false,
      width: '680px',
    });
    ref.afterClose.subscribe((e: unknown) => {
      if (!e) return;
      this.notify.success('Solicitud registrada', 'QHSE la revisará y la despachará.');
      this.cargarEpi(t.id);
      this.cargarTerminos(t.id);
      this.cargarCasosFlota(t.id);
    });
  }

  // ── Inspección de vehículos (la hace el Operador con el formato de Flota; al registrarla Flota avisa y el requisito se cumple solo) ──
  private readonly flotaInspecciones = inject(FlotaInspeccionesService);
  protected readonly casosFlota = signal<CasoInspeccion[]>([]);
  protected readonly puedeInspeccionar = computed(() => this.auth.can('flota.inspecciones.crear'));
  /** El caso de inspección de una unidad del ticket; no existe si la unidad no está registrada en Flota como unidad de transporte. */
  protected casoDeUnidad(vehiculoId: string | null): CasoInspeccion | null {
    return vehiculoId
      ? (this.casosFlota().find((c) => c.unidad.vehiculo?.id === vehiculoId) ?? null)
      : null;
  }
  /** ¿Puedo hacer yo la inspección de salida de esta unidad? (su operador, o Superadmin) */
  protected puedeRealizarInspeccion(vehiculoId: string | null): boolean {
    const c = this.casoDeUnidad(vehiculoId);
    const u = this.yo();
    return (
      !!c &&
      !!u &&
      this.puedeInspeccionar() &&
      c.estado === 'pendiente' &&
      (c.operador.id === u.id || u.roleCode === 'superadmin')
    );
  }
  protected realizarInspeccion(vehiculoId: string | null): void {
    const caso = this.casoDeUnidad(vehiculoId);
    if (!caso) return;
    this.dialog
      .open<InspeccionVehiculoDialog, InspeccionVehiculoDialogData>({
        title: `Inspección de salida — ${caso.unidad.codigo}`,
        content: InspeccionVehiculoDialog,
        data: { caso, momento: 'salida' },
        size: 'large',
        footer: false,
      })
      .afterClose.subscribe((r) => r && this.recargar());
  }
  /**
   * Flota abre el caso de inspección de cada unidad al procesar el evento de la asignación, un instante después de que esta termina:
   * si faltan casos se vuelve a preguntar unas veces antes de dar la unidad por no registrada en Flota.
   */
  private cargarCasosFlota(ticketId: string, intento = 0): void {
    if (!this.auth.can('flota.inspecciones.ver')) return;
    this.flotaInspecciones.casos(ticketId).subscribe({
      next: (l) => {
        this.casosFlota.set(l);
        this.cargarInspeccionSalida();
        const esperados = this.ticket()?.asignacion.unidades.length ?? 0;
        if (l.length < esperados && intento < 4) {
          setTimeout(() => this.cargarCasosFlota(ticketId, intento + 1), 1500);
        }
      },
      error: () => this.casosFlota.set([]),
    });
  }

  /** La inspección de salida ya hecha de la unidad que firma el reporte: de ahí salen el origen y el destino del reporte. */
  protected readonly inspeccionSalida = signal<InspeccionDetalle | null>(null);
  private cargarInspeccionSalida(): void {
    const caso = this.casoDeUnidad(this.unidadParaFirmar()?.vehiculoId ?? null);
    if (!caso?.salidaInspeccionId) return this.inspeccionSalida.set(null);
    this.flotaInspecciones.obtener(caso.salidaInspeccionId).subscribe({
      next: (d) => this.inspeccionSalida.set(d),
      error: () => this.inspeccionSalida.set(null),
    });
  }
  /** Ver el detalle de la inspección que hizo el operador (solo lectura; el Supervisor la aprueba desde ahí). */
  protected readonly inspeccionRealizada = (vehiculoId: string | null): boolean =>
    !!this.casoDeUnidad(vehiculoId)?.salidaInspeccionId;
  protected verInspeccion(vehiculoId: string | null): void {
    const id = this.casoDeUnidad(vehiculoId)?.salidaInspeccionId;
    if (!id) return;
    this.dialog
      .open<InspeccionVehiculoDialog, InspeccionVehiculoDialogData>({
        title: 'Inspección de vehículo — DYN-SGI-RE-068',
        content: InspeccionVehiculoDialog,
        data: { inspeccionId: id },
        size: 'large',
        footer: false,
      })
      .afterClose.subscribe((r) => r && this.recargar());
  }

  // ── Ejecución operativa: lo que hace el operador en el sitio, como en la demo (checklist de ingreso, gases, LOTO, reportes, químicos) ──
  protected readonly vistaEjecucion = computed(() => this.ticket()?.paso.codigo === PASO_EJECUCION);
  protected readonly ingreso = signal<IngresoLocacion | null>(null);
  protected readonly confirmacionesIngreso = CONFIRMACIONES_INGRESO;
  protected readonly ultimasLecturas = computed(() =>
    this.ingreso() ? ultimaLecturaPorGas(this.ingreso()!) : new Map(),
  );
  /** Quien llena el equipo asignado puede marcar el checklist y registrar lecturas mientras el ticket está en la ejecución. */
  protected readonly puedeLlenarIngreso = computed(
    () => this.vistaEjecucion() && this.puedeLlenarEquipo(),
  );
  protected readonly lecturasGas = signal<Partial<Record<GasIngreso, string>>>({});
  protected readonly gasRegistrando = signal(false);

  private cargarIngreso(id: string): void {
    this.servicio.ingreso(id).subscribe({
      next: (i) => this.ingreso.set(i),
      error: () => this.ingreso.set(null),
    });
  }

  private aplicarIngreso(obs: ReturnType<TicketsPumpingService['ingreso']>): void {
    obs.subscribe({
      next: (i) => {
        this.ingreso.set(i);
        this.recargarRequisitos();
      },
      error: (err) =>
        this.notify.error(
          'No se pudo guardar',
          mensajeErrorTicket(err, 'No se pudo guardar el cambio. Intente de nuevo.'),
        ),
    });
  }

  protected cambiarConfirmacion(clave: ConfirmacionIngreso, valor: boolean): void {
    const t = this.ticket();
    if (!t) return;
    this.aplicarIngreso(this.servicio.actualizarIngreso(t.id, { [clave]: valor }));
  }

  protected alternarLoto(itemId: string): void {
    const t = this.ticket();
    if (!t) return;
    this.aplicarIngreso(this.servicio.alternarLoto(t.id, itemId));
  }

  protected fijarLecturaGas(gas: GasIngreso, valor: string): void {
    // una lectura no puede ser negativa
    const limpio = valor !== '' && Number(valor) < 0 ? '0' : valor;
    this.lecturasGas.update((l) => ({ ...l, [gas]: limpio }));
  }

  protected bloquearTeclaGas(event: KeyboardEvent): void {
    if (['-', '+', 'e', 'E'].includes(event.key)) event.preventDefault();
  }

  protected rangoGas(min: number | null, max: number, unidad: string): string {
    return min !== null ? `${min} – ${max} ${unidad}` : `hasta ${max} ${unidad}`;
  }

  private lecturaValida(raw: string | undefined): boolean {
    return !!raw && raw.trim() !== '' && !Number.isNaN(Number(raw)) && Number(raw) >= 0;
  }

  /** Gases con un valor válido escrito y todavía sin registrar. */
  protected readonly gasesPendientes = computed(() =>
    (this.ingreso()?.limites ?? []).filter((l) => this.lecturaValida(this.lecturasGas()[l.gas])),
  );

  /** Vista previa mientras se escribe: ¿queda dentro o fuera del rango seguro? (lo confirma el servidor al registrar). */
  protected estadoBorrador(gas: GasIngreso): 'seguro' | 'fuera' | null {
    const l = this.ingreso()?.limites.find((x) => x.gas === gas);
    const raw = this.lecturasGas()[gas];
    if (!l || !this.lecturaValida(raw)) return null;
    const v = Number(raw);
    return v <= l.maximo && (l.minimo === null || v >= l.minimo) ? 'seguro' : 'fuera';
  }

  /** Enter en un campo de gas: pasa al siguiente; en el último registra todas las lecturas. */
  protected enterEnGas(event: Event, indice: number): void {
    const campos = (event.currentTarget as HTMLElement)
      .closest('.gas-grid')
      ?.querySelectorAll<HTMLInputElement>('input');
    const siguiente = campos?.[indice + 1];
    if (siguiente) siguiente.focus();
    else this.registrarLecturas();
  }

  /** Registra de una vez todas las lecturas escritas (una llamada por gas, en orden). */
  protected registrarLecturas(): void {
    const t = this.ticket();
    const gases = this.gasesPendientes().map((l) => l.gas);
    if (!t || this.gasRegistrando() || gases.length === 0) return;
    this.gasRegistrando.set(true);
    const siguiente = (i: number): void => {
      if (i >= gases.length) {
        this.gasRegistrando.set(false);
        this.lecturasGas.set({});
        const fuera = gases.filter((g) => this.ultimasLecturas().get(g)?.seguro === false);
        if (fuera.length) {
          this.notify.warning(
            'Lecturas registradas',
            'Alguna lectura quedó fuera del rango seguro: no se puede continuar hasta que sea segura.',
          );
        } else {
          this.notify.success(
            'Lecturas registradas',
            'Todas las lecturas están dentro del rango seguro.',
          );
        }
        this.recargarRequisitos();
        return;
      }
      const gas = gases[i];
      this.servicio
        .actualizarIngreso(t.id, {
          nuevaLectura: { gas, lectura: Number(this.lecturasGas()[gas]) },
        })
        .subscribe({
          next: (ing) => {
            this.ingreso.set(ing);
            siguiente(i + 1);
          },
          error: (err) => {
            this.gasRegistrando.set(false);
            this.notify.error(
              'No se pudo registrar',
              mensajeErrorTicket(err, 'No se pudo registrar la lectura. Intente de nuevo.'),
            );
          },
        });
    };
    siguiente(0);
  }

  /** Las verificaciones del sitio (ingreso, gases y LOTO) aún no están completas. */
  protected readonly verificacionesPendientes = computed(
    () => !(this.ingreso()?.completo ?? false),
  );

  /** Un renglón por día de servicio (del pedido) más los que ya tienen reporte, con su estado. */
  protected readonly diasDeReporte = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const hechos = new Map(this.reportesDiarios().map((d) => [d.fecha, d]));
    const fechas = new Set<string>(hechos.keys());
    if (t.fechaInicioServicio) {
      const ini = new Date(`${t.fechaInicioServicio}T00:00:00Z`);
      const fin = new Date(`${t.fechaFinServicio ?? t.fechaInicioServicio}T00:00:00Z`);
      for (let d = ini, n = 0; d <= fin && n < 62; d = new Date(d.getTime() + 86_400_000), n++) {
        fechas.add(d.toISOString().slice(0, 10));
      }
    }
    return [...fechas].sort().map((fecha, i) => {
      const h = hechos.get(fecha);
      return {
        id: fecha,
        fecha,
        dia: `Día ${i + 1}`,
        fechaLabel: formatoDia(fecha),
        estado: h?.estado ?? null,
        estadoBadge: h
          ? {
              text: ESTADO_REPORTE_DIARIO_LABELS[h.estado],
              tone: ESTADO_REPORTE_DIARIO_TONO[h.estado],
            }
          : { text: 'Pendiente', tone: 'warning' as const },
        completado: h?.estado === 'completado' || h?.estado === 'corregido',
      };
    });
  });
  protected readonly columnasDias: DynadrillDataTableColumn[] = [
    { key: 'dia', header: 'Día' },
    { key: 'fechaLabel', header: 'Fecha' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];
  protected readonly claveDia = (row: Record<string, unknown>): string => String(row['id']);

  // Cierre de químicos: la cantidad usada de cada uno (lo que sobra lo devuelve el Supervisor en el control de retorno)
  protected readonly consumoBorrador = signal<Record<string, string>>({});
  protected readonly consumiendo = signal<string | null>(null);
  protected consumoDe(articuloId: string): string {
    return this.consumoBorrador()[articuloId] ?? '';
  }
  protected fijarConsumo(articuloId: string, valor: string): void {
    this.consumoBorrador.update((m) => ({ ...m, [articuloId]: valor }));
  }
  protected consumoValido(q: { articuloId: string; pendiente: number }): boolean {
    const n = Number(this.consumoBorrador()[q.articuloId]);
    return Number.isFinite(n) && n > 0 && n <= q.pendiente && this.consumiendo() === null;
  }
  protected registrarConsumo(q: { articuloId: string; pendiente: number }): void {
    const t = this.ticket();
    if (!t || !this.consumoValido(q)) return;
    this.consumiendo.set(q.articuloId);
    this.servicio
      .consumirQuimico(t.id, q.articuloId, Number(this.consumoBorrador()[q.articuloId]))
      .subscribe({
        next: (nuevo) => {
          this.consumiendo.set(null);
          this.quimicos.set(nuevo);
          this.consumoBorrador.update((m) => ({ ...m, [q.articuloId]: '' }));
          this.notify.success('Consumo registrado', 'Quedó anotado lo usado de este químico.');
        },
        error: (err) => {
          this.consumiendo.set(null);
          this.notify.error(
            'No se pudo registrar',
            mensajeErrorTicket(err, 'No se pudo registrar el consumo. Intente de nuevo.'),
          );
        },
      });
  }
  /** Algún químico todavía no tiene consumo registrado. */
  protected readonly quimicosSinConsumo = computed(() =>
    (this.quimicos()?.quimicos ?? []).some(
      (q) => q.usada === 0 && q.devuelta === 0 && q.pendiente > 0,
    ),
  );
  /** La formalización (el Company Man aprobó el inicio) ya quedó registrada. */
  protected readonly ejecucionFormalizada = computed(() =>
    (this.ticket()?.requisitos ?? []).some(
      (r) => r.codigo === 'ejecucion_formalizada' && r.estado === 'cumplido',
    ),
  );

  // ── Traslado de salida: lo que hace el operador (inspección, EPI, reporte de unidad), como en la demo ──
  protected readonly vistaSalida = computed(() => this.ticket()?.paso.codigo === 'traslado_salida');
  private readonly formReporte = viewChild(TicketReporteUnidadForm);
  /** Lo que todavía falta para poder enviar el reporte (todo lo pendiente del paso, menos el propio reporte). */
  protected readonly faltanParaEnviar = computed(() => {
    const t = this.ticket();
    return t ? pendientesDelPaso(t).filter((r) => r.codigo !== 'reporte_unidad_salida') : [];
  });
  protected readonly puedeEnviarReporte = computed(
    () => (this.formReporte()?.puedeEnviar() ?? false) && this.faltanParaEnviar().length === 0,
  );
  /** La unidad cuyo reporte de salida puedo firmar yo (su operador, o Superadmin) y si ya quedó firmado. */
  protected readonly unidadParaFirmar = computed(() => {
    const t = this.ticket();
    if (!t) return null;
    const r = t.requisitos.find(
      (x) => x.codigo === 'reporte_unidad_salida' && !!x.vehiculoId && this.puedeFirmarUnidad(x),
    );
    return r
      ? {
          vehiculoId: r.vehiculoId as string,
          placa: r.para ?? '',
          firmado: r.estado === 'cumplido',
        }
      : null;
  });
  /** Hay un reporte por firmar: la barra muestra «Enviar reporte de unidad de salida» en lugar de «Guardar y continuar». */
  protected readonly enviarPendiente = computed(
    () => this.vistaSalida() && !!this.unidadParaFirmar() && !this.unidadParaFirmar()?.firmado,
  );
  protected enviarReporte(): void {
    this.formReporte()?.enviar();
  }
  protected alFirmarReporte(): void {
    this.recargar();
  }

  /** Estado de la inspección de cada unidad (la hace el Operador; la aprueba el Supervisor en la revisión de salida). */
  protected readonly inspecciones = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return t.requisitos
      .filter((r) => r.codigo === 'inspeccion_vehiculo_realizada' && !!r.vehiculoId)
      .map((r) => {
        const aprobada = t.requisitos.find(
          (x) => x.codigo === 'inspeccion_vehiculo_aprobada' && x.vehiculoId === r.vehiculoId,
        );
        const realizada = r.estado === 'cumplido';
        const etiqueta = !realizada
          ? 'Pendiente'
          : aprobada?.estado === 'cumplido'
            ? 'Aprobada'
            : 'Por aprobar';
        const texto = !realizada
          ? 'Pendiente de realizar'
          : aprobada?.estado === 'cumplido'
            ? 'Aprobada por el Supervisor'
            : 'Realizada, esperando la aprobación del Supervisor';
        const tono: 'success' | 'warning' | 'info' = !realizada
          ? 'warning'
          : aprobada?.estado === 'cumplido'
            ? 'success'
            : 'info';
        return { requisito: r, placa: r.para ?? '', etiqueta, texto, tono };
      });
  });
  protected readonly placasSinInspeccion = computed(() =>
    this.inspecciones()
      .filter((i) => i.requisito.estado === 'pendiente')
      .map((i) => i.placa),
  );

  protected readonly epiPendiente = computed(() =>
    this.epiOperadores().some((o) => o.entrega?.estado !== 'despachado'),
  );
  protected textoEpi(e: OperadorEpiTicket['entrega']): string {
    if (!e) return 'Sin solicitar';
    if (e.estado === 'despachado') return 'Despachado';
    if (e.estado === 'aprobado') return 'Aprobado, esperando despacho de QHSE';
    if (e.estado === 'rechazado') return 'Rechazado — ' + (e.motivoRechazo ?? '');
    return 'Solicitado, esperando revisión de QHSE';
  }

  /** Términos y condiciones de cada operador (los aceptó él mismo): versión aceptada o pendiente. */
  private readonly terminosOperadores = signal<AceptacionOperador[]>([]);
  protected terminosDe(o: OperadorEpiTicket): AceptacionOperador['aceptacion'] {
    return this.terminosOperadores().find((x) => x.usuarioId === o.usuarioId)?.aceptacion ?? null;
  }
  protected esYo(usuarioId: string): boolean {
    return usuarioId === this.yo()?.id;
  }
  private cargarTerminos(ticketId: string): void {
    this.servicio.terminos(ticketId).subscribe({
      next: (l) => this.terminosOperadores.set(l),
      error: () => this.terminosOperadores.set([]),
    });
  }
  protected cargoDe(usuarioId: string): string {
    return this.epiOperadores().find((o) => o.usuarioId === usuarioId)?.cargo ?? 'Operador';
  }
  /** Quien puede ver el reporte de una unidad sin ser su operador lo abre en la ventana de solo lectura. */
  protected verReporteDe(vehiculoId: string | null): void {
    const r = this.ticket()?.requisitos.find(
      (x) => x.codigo === 'reporte_unidad_salida' && x.vehiculoId === vehiculoId,
    );
    if (r) this.abrirReporte(r);
  }

  private cargarDocumentosQhse(t: TicketPumping): void {
    if (!this.puedeVerEstadoDocs()) return;
    this.docsQhse.deTicket(t.id).subscribe({
      next: (d) => this.documentosQhse.set(d),
      error: () => this.documentosQhse.set(null),
    });
  }

  protected descargarDocQhse(d: DocumentoVigente | null, nombre: string): void {
    if (!d) return;
    this.docsQhse.abrir(d.archivoId).subscribe({
      next: (blob) => this.archivos.guardarComo(blob, nombre),
      error: () => this.errorAccion.set('No se pudo descargar el documento.'),
    });
  }

  // ── Cargar ART, PT y Acta desde el ticket (el backend decide quién: documentos.gestionar para ART/PT; acta_entrega.cargar para el Acta) ──
  protected readonly puedeCargarArtPt = computed(() => this.auth.can(PERMISO_DOCUMENTOS_GESTIONAR));
  protected readonly puedeCargarActa = computed(() => this.auth.can(PERMISO_ACTA_ENTREGA_CARGAR));
  /** Qué documento tiene abierto el formulario de carga (solo uno a la vez). */
  protected readonly cargaAbierta = signal<'art' | 'pt' | 'acta' | null>(null);
  protected readonly archivoDoc = signal<File | null>(null);
  protected readonly fechaDoc = signal(fechaIso(new Date()));
  protected readonly motivoSuplencia = signal('');
  protected readonly cargandoDoc = signal(false);
  /** Quien sube el Acta sin ser el supervisor asignado debe decir por qué el asignado no pudo. */
  protected readonly pideMotivoSuplencia = computed(() =>
    exigeMotivoSuplencia(
      this.ticket()?.asignacion.supervisor?.usuarioId ?? null,
      this.auth.currentUser()?.id,
    ),
  );

  protected alternarCarga(doc: 'art' | 'pt' | 'acta'): void {
    this.cargaAbierta.set(this.cargaAbierta() === doc ? null : doc);
    this.archivoDoc.set(null);
    this.motivoSuplencia.set('');
  }

  protected alElegirDoc(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.archivoDoc.set(input.files?.[0] ?? null);
  }

  protected subirDoc(): void {
    const t = this.ticket();
    const doc = this.cargaAbierta();
    const archivo = this.archivoDoc();
    if (!t || !doc || !archivo || this.cargandoDoc()) return;
    this.cargandoDoc.set(true);
    this.errorAccion.set(null);
    const peticion =
      doc === 'acta'
        ? this.docsQhse.cargarActa(t.id, archivo, { motivoSuplencia: this.motivoSuplencia() })
        : this.docsQhse.cargar(archivo, {
            pedidoId: t.pedidoId,
            ticketId: t.id,
            tipo: doc,
            fecha: this.fechaDoc(),
          });
    peticion.subscribe({
      next: () => {
        this.cargandoDoc.set(false);
        this.cargaAbierta.set(null);
        this.archivoDoc.set(null);
        this.notify.success('Documento cargado', 'Quedó registrado en QHSE.');
        this.cargarDocumentosQhse(t);
        this.cargarEpi(t.id);
        this.cargarTerminos(t.id);
        this.cargarCasosFlota(t.id);
      },
      error: (err) => {
        this.cargandoDoc.set(false);
        this.errorAccion.set(mensajeErrorTicket(err, 'No se pudo cargar el documento.'));
      },
    });
  }

  protected readonly numero = (v: number): string =>
    v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  protected readonly cantidad = (v: number): string =>
    v.toLocaleString('en-US', { maximumFractionDigits: 3 });

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  // ── "Avance del ticket": los 10 pasos del servicio en vertical (mismo componente que la demo) ──
  protected readonly etiquetasPasos = PASOS_PUMPING.map((p) => p.nombre);
  /** El historial del ticket va dentro de cada paso de la línea de avance (actor, fecha y duración), como en la demo. */
  protected readonly tramos = computed<(TimelineTramo | undefined)[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    const actual = this.indicePaso();
    return PASOS_PUMPING.map((p, i) => {
      let k = -1;
      t.historial.forEach((h, j) => {
        if (h.pasoNuevo === p.codigo) k = j;
      });
      if (k < 0) return undefined;
      const h = t.historial[k];
      const fin = t.historial[k + 1]?.at;
      const inicioMs = new Date(h.at).getTime();
      return {
        fase: p.nombre,
        macroEstado: i < actual || this.cerrado() ? 'aprobado' : 'en_proceso',
        inicio: h.at,
        fin,
        duracionMs: (fin ? new Date(fin).getTime() : Date.now()) - inicioMs,
        actorNombre: h.actor?.nombre ?? 'Sistema',
        actorRolLabel: h.actor?.rol ? etiquetaRol(h.actor.rol) : undefined,
        motivo: h.motivo ?? undefined,
      } satisfies TimelineTramo;
    });
  });
  /** Un ticket que llegó a su paso final (cierre) tiene todos los pasos completados, incluido el último. */
  protected readonly cerrado = computed(() => this.ticket()?.paso.macro === 'aprobado');
  protected readonly avancePaso = computed(() =>
    this.cerrado() ? PASOS_PUMPING.length : this.indicePaso(),
  );
  protected readonly indicePaso = computed(() => {
    const i = PASOS_PUMPING.findIndex((p) => p.codigo === this.ticket()?.paso.codigo);
    return i < 0 ? 0 : i;
  });

  /** El pedido tal como lo cotizó Ventas (ítems estimados); solo lo ve quien puede leer pedidos de Facturación. */
  protected readonly pedido = signal<PedidoDetalle | null>(null);
  protected readonly moneda = formatoMoneda;
  protected readonly cambioPendiente = computed(
    () => this.cambiosItems().find((s) => s.estado === 'pendiente') ?? null,
  );

  private cargarPedido(pedidoId: string): void {
    if (!this.puedeVerPedido()) return;
    this.pedidos
      .detalle(pedidoId)
      .subscribe({ next: (p) => this.pedido.set(p), error: () => this.pedido.set(null) });
  }

  protected irACambios(): void {
    document
      .getElementById('cambios-items')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly ticket = signal<TicketPumping | null>(null);

  /** Quien además puede ver el pedido en Facturación tiene el enlace al pedido. */
  protected readonly puedeVerPedido = computed(() => this.auth.can('comercial.pedidos.ver'));
  protected readonly tipos = computed(() =>
    (this.ticket()?.tiposServicio ?? []).map(etiquetaTipoServicio),
  );
  /** El paso de Asignación no avanza con un botón: se completa asignando al equipo. */
  protected readonly debeAsignar = computed(() => {
    const t = this.ticket();
    return !!t && t.puedeActuar && t.paso.codigo === PASO_ASIGNACION;
  });
  /** Salidas que avanzan el ticket (las que piden motivo lo devuelven a un paso anterior). */
  protected readonly siguientesAdelante = computed(() =>
    (this.ticket()?.siguientes ?? []).filter((s) => !s.requiereMotivo),
  );
  // ── Traslado de salida: lo que se exige para salir del paso ──
  private readonly yo = computed(() => this.auth.currentUser());
  protected readonly puedeConfirmarAMano = computed(() => this.auth.can(PERMISO_PUENTE_REQUISITOS));
  /** Los requisitos del paso actual (los que hay que cumplir para salir de él) y los ya cumplidos de pasos anteriores. */
  protected readonly requisitosVisibles = computed(() => {
    const t = this.ticket();
    return t ? t.requisitos.filter((r) => r.paso === t.paso.codigo || r.estado === 'cumplido') : [];
  });
  /** Los requisitos se muestran en la tarjeta del módulo que los atiende, como la demo separa los documentos de QHSE de los formularios del paso. */
  protected readonly requisitosQhse = computed(() =>
    this.requisitosVisibles().filter((r) => r.modulo === 'qhse'),
  );
  protected readonly requisitosFlota = computed(() =>
    this.requisitosVisibles().filter((r) => r.modulo === 'flota'),
  );
  protected readonly requisitosPumping = computed(() =>
    this.requisitosVisibles().filter((r) => r.modulo === 'pumping'),
  );
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
    return (
      this.yo()?.roleCode === 'superadmin' ||
      t.asignacion.operadores.some(
        (o) => o.vehiculoId === r.vehiculoId && o.usuarioId === this.yo()?.id,
      )
    );
  }
  protected puedeLlenarEquipo(): boolean {
    const t = this.ticket();
    const u = this.yo();
    if (!t || !u) return false;
    return (
      ['superadmin', 'jefe_base'].includes(u.roleCode) ||
      t.asignacion.supervisor?.usuarioId === u.id ||
      t.asignacion.operadores.some((o) => o.usuarioId === u.id)
    );
  }
  protected readonly modulo = (r: RequisitoTicket) => MODULO_LABELS[r.modulo];
  protected readonly origenRequisito = (r: RequisitoTicket) =>
    r.origen ? ORIGEN_REQUISITO_LABELS[r.origen] : '';

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
      data: {
        ticketId: t.id,
        soloLectura: t.paso.codigo !== 'ejecucion_operativa' || !this.puedeLlenarEquipo(),
      },
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
      data: {
        ticketId: t.id,
        vehiculoId: r.vehiculoId,
        placa: r.para ?? '',
        soloLectura: t.paso.codigo !== 'traslado_salida' || !this.puedeFirmarUnidad(r),
      },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((ok: boolean | undefined) => ok && this.recargar());
  }

  /** El Supervisor del equipo aprueba la inspección de la unidad al revisar los reportes de salida (mientras Flota no publique la suya). */
  protected puedeAprobarInspeccion(r: RequisitoTicket): boolean {
    return (
      r.codigo === 'inspeccion_vehiculo_aprobada' &&
      r.estado === 'pendiente' &&
      this.ticket()?.paso.codigo === PASO_REVISION_SALIDA &&
      this.esSupervisorDelTicket()
    );
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
      error: (err) => {
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
      data: {
        ticketId: t.id,
        vehiculoId: r.vehiculoId,
        placa: r.para ?? '',
        soloLectura: t.paso.codigo !== PASO_TRASLADO_LLEGADA || !this.puedeFirmarUnidad(r),
      },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((ok: boolean | undefined) => ok && this.recargar());
  }

  // ── Prefactura desde el ticket (revisión final) ──
  /** El mantenimiento no es un paso del flujo: la tarjeta se ve en cualquier estado, a quien puede leer Mantenimiento. */
  protected readonly puedeVerMantenimientos = computed(
    () =>
      this.auth.can('mantenimiento.operaciones.ver') || this.auth.can('mantenimiento.ordenes.ver'),
  );
  protected readonly puedeVerPrefactura = computed(
    () =>
      this.auth.can(PERMISO_PREFACTURA_VISTA_TICKET) &&
      ['revision_final', 'cierre'].includes(this.ticket()?.paso.codigo ?? ''),
  );
  protected abrirPrefactura(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketPrefacturaDialog, TicketPrefacturaDialogData>({
      title: 'Prefactura del servicio',
      content: TicketPrefacturaDialog,
      data: {
        pedidoId: t.pedidoId,
        ticketCodigo: String(t.ticketNumero ?? t.pedidoCodigo),
        pedidoCodigo: t.pedidoCodigo,
        cliente: t.cliente,
        pozo: t.pozo,
        campo: t.campo,
        companyMan: t.representanteCampo?.nombre ?? null,
        puedeFirmar:
          t.paso.codigo === PASO_REVISION_FINAL &&
          this.auth.can(PERMISO_PREFACTURA_FIRMA_COMPANY_MAN),
      },
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
        error: (err) =>
          this.notify.error(
            'No se pudo confirmar',
            mensajeErrorTicket(err, 'No se pudo confirmar el requisito.'),
          ),
      });
    });
  }

  // ── Químicos del ticket (asignado, usado, devuelto y pendiente; el movimiento vive en Inventario) ──
  protected readonly quimicos = signal<QuimicosTicket | null>(null);
  protected readonly hayQuimicos = computed(() => (this.quimicos()?.quimicos.length ?? 0) > 0);
  protected readonly esSupervisorDelTicket = computed(() => {
    const t = this.ticket();
    const u = this.yo();
    return (
      !!t && !!u && (u.roleCode === 'superadmin' || t.asignacion.supervisor?.usuarioId === u.id)
    );
  });
  protected readonly esDelEquipo = computed(() => {
    const t = this.ticket();
    const u = this.yo();
    return (
      !!t &&
      !!u &&
      (u.roleCode === 'superadmin' || t.asignacion.operadores.some((o) => o.usuarioId === u.id))
    );
  });
  /** El Operador del equipo registra el consumo en la Ejecución operativa; el Supervisor del equipo devuelve en el Control de retorno. */
  protected readonly puedeConsumir = computed(
    () =>
      this.ticket()?.paso.codigo === PASO_EJECUCION &&
      this.esDelEquipo() &&
      this.pendienteDeQuimicos(),
  );
  protected readonly puedeDevolver = computed(
    () =>
      this.ticket()?.paso.codigo === PASO_RETORNO &&
      this.esSupervisorDelTicket() &&
      this.pendienteDeQuimicos(),
  );
  private readonly pendienteDeQuimicos = computed(() =>
    (this.quimicos()?.quimicos ?? []).some((q) => q.pendiente > 0),
  );
  /** El Supervisor del equipo formaliza la ejecución (el Company Man aprobó el inicio) en la Ejecución operativa. */
  protected readonly puedeFormalizar = computed(() => {
    const t = this.ticket();
    return (
      !!t &&
      t.paso.codigo === PASO_EJECUCION &&
      this.esSupervisorDelTicket() &&
      t.requisitos.some((r) => r.codigo === 'ejecucion_formalizada' && r.estado === 'pendiente')
    );
  });

  // ── Reporte Diario de Actividades (Reporte Job) ──
  protected readonly reportesDiarios = signal<ReporteDiarioDia[]>([]);
  protected readonly fechaNueva = signal(new Date().toISOString().slice(0, 10));
  protected readonly estadoDia = (e: ReporteDiarioDia['estado']) => ESTADO_REPORTE_DIARIO_LABELS[e];
  protected readonly tonoDia = (e: ReporteDiarioDia['estado']) => ESTADO_REPORTE_DIARIO_TONO[e];
  /** El Operador del equipo llena el reporte diario mientras el ticket está en la Ejecución operativa. */
  protected readonly puedeLlenarReporteDiario = computed(
    () => this.ticket()?.paso.codigo === PASO_EJECUCION && this.esDelEquipo(),
  );
  /** Se muestra desde la ejecución: antes no hay nada que reportar. */
  protected readonly muestraReporteDiario = computed(() =>
    [
      'ejecucion_operativa',
      'control_retorno',
      'traslado_llegada',
      'revision_reportes_llegada',
      'revision_final',
      'cierre',
    ].includes(this.ticket()?.paso.codigo ?? ''),
  );

  // ── Cambio de ítems del pedido (propone el Operador, aprueba el Supervisor, aplica Comercial) ──
  protected readonly cambiosItems = signal<SolicitudCambioItems[]>([]);
  protected readonly estadoCambio = (s: SolicitudCambioItems) => ESTADO_SOLICITUD_LABELS[s.estado];
  protected readonly tonoCambio = (s: SolicitudCambioItems) => ESTADO_SOLICITUD_TONO[s.estado];
  protected readonly aplicacionCambio = etiquetaAplicacion;
  protected readonly esDelEquipoOSupervisor = computed(
    () => this.esDelEquipo() || this.esSupervisorDelTicket(),
  );
  /** El equipo del ticket propone cambios mientras el ticket no esté cerrado y no haya otra solicitud esperando al Supervisor. */
  protected readonly puedeProponerCambio = computed(() => {
    const t = this.ticket();
    return (
      !!t &&
      this.hayAsignacion() &&
      t.paso.codigo !== 'cierre' &&
      this.auth.can(PERMISO_CAMBIOS_SOLICITAR) &&
      this.esDelEquipoOSupervisor() &&
      !this.cambiosItems().some((s) => s.estado === 'pendiente')
    );
  });
  protected readonly puedeRevisarCambios = computed(
    () => this.auth.can(PERMISO_CAMBIOS_APROBAR) && this.esSupervisorDelTicket(),
  );
  protected readonly muestraCambios = computed(
    () => this.hayAsignacion() && (this.cambiosItems().length > 0 || this.puedeProponerCambio()),
  );

  private cargarCambiosItems(id: string): void {
    if (!this.auth.can(PERMISO_CAMBIOS_SOLICITAR) && !this.auth.can(PERMISO_CAMBIOS_APROBAR))
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
      data: { ticketId: t.id, pedidoId: t.pedidoId, pedidoCodigo: t.pedidoCodigo },
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
      data: { solicitud: s, pedidoId: t.pedidoId, puedeRevisar: this.puedeRevisarCambios() },
      footer: false,
      width: '820px',
    });
    ref.afterClose.subscribe(
      (r: SolicitudCambioItems | undefined) => r && this.cargarCambiosItems(t.id),
    );
  }

  // ── Monitoreo de cada día (documento del ticket) ──
  protected readonly documentos = signal<DocumentoDelTicket[]>([]);
  protected readonly subiendoMonitoreo = signal<string | null>(null);
  /** Los monitoreos de un día (el último es el vigente). */
  protected monitoreosDe(fecha: string): DocumentoDelTicket[] {
    return this.documentos().filter((d) => d.tipo === 'monitoreo' && d.fecha === fecha);
  }

  private cargarDocumentos(id: string): void {
    this.servicio
      .documentos(id)
      .subscribe({ next: (l) => this.documentos.set(l), error: () => this.documentos.set([]) });
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
        switchMap((a) => {
          subiendo = false;
          return this.servicio.adjuntarMonitoreo(t.id, fecha, a.id);
        }),
      )
      .subscribe({
        next: (l) => {
          this.subiendoMonitoreo.set(null);
          this.documentos.set(l);
          this.notify.success('Monitoreo adjuntado', `Día ${fecha}.`);
        },
        error: (err) => {
          this.subiendoMonitoreo.set(null);
          this.errorAccion.set(
            subiendo
              ? mensajeErrorArchivo(err)
              : mensajeErrorTicket(err, 'No se pudo adjuntar el monitoreo.'),
          );
        },
      });
  }

  protected descargarMonitoreo(d: DocumentoDelTicket): void {
    this.archivos.contenido(d.archivoId).subscribe({
      next: (blob) => this.archivos.guardarComo(blob, `Monitoreo ${d.fecha ?? ''}`.trim()),
      error: () => this.errorAccion.set('No se pudo descargar el monitoreo.'),
    });
  }

  private cargarReportesDiarios(id: string): void {
    this.servicio.reportesDiarios(id).subscribe({
      next: (l) => this.reportesDiarios.set(l),
      error: () => this.reportesDiarios.set([]),
    });
  }

  protected abrirReporteDiario(fecha: string, nuevo = false): void {
    const t = this.ticket();
    if (!t || !fecha) return;
    const dia = this.reportesDiarios().find((d) => d.fecha === fecha);
    const ref = this.dialog.open<TicketReporteDiarioDialog, TicketReporteDiarioDialogData>({
      title: 'Reporte diario de actividades',
      content: TicketReporteDiarioDialog,
      data: {
        ticketId: t.id,
        ticketCodigo: String(t.ticketNumero ?? t.pedidoCodigo),
        fecha,
        nuevo: nuevo && !dia,
        soloLectura: !this.puedeLlenarReporteDiario() || dia?.estado === 'corregido',
        cabecera: {
          cliente: t.cliente,
          pozo: t.pozo,
          campo: t.campo,
          bloque: t.bloque,
          representante: t.representanteCampo?.nombre ?? null,
          taladro: t.taladro,
          contrato: t.numeroContrato,
          supervisor: t.asignacion.supervisor?.nombre ?? null,
        },
      },
      footer: false,
      width: '980px',
    });
    ref.afterClose.subscribe(
      (hubo: boolean | undefined) => hubo && this.cargarReportesDiarios(t.id),
    );
  }

  private cargarQuimicos(id: string): void {
    this.servicio
      .quimicos(id)
      .subscribe({ next: (q) => this.quimicos.set(q), error: () => this.quimicos.set(null) });
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
    ref.afterClose.subscribe(
      (nuevo: QuimicosTicket | undefined) => nuevo && this.quimicos.set(nuevo),
    );
  }

  protected formalizar(): void {
    const t = this.ticket();
    if (!t || this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.servicio.formalizarEjecucion(t.id).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success(
          'Ejecución formalizada',
          'Quedó registrado que el Company Man aprobó el inicio.',
        );
        this.recargar();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.errorAccion.set(mensajeErrorTicket(err, 'No se pudo formalizar la ejecución.'));
      },
    });
  }

  /** Refresca el ticket (sus requisitos y su paso) sin recargar el resto de la pantalla. */
  private recargarRequisitos(): void {
    const t = this.ticket();
    if (!t) return;
    this.servicio
      .detalle(t.id)
      .subscribe({ next: (n) => this.ticket.set(n), error: () => undefined });
  }

  private recargar(): void {
    const t = this.ticket();
    if (!t) return;
    this.servicio
      .detalle(t.id)
      .subscribe({ next: (n) => this.ticket.set(n), error: () => undefined });
    this.cargarQuimicos(t.id);
    this.cargarReportesDiarios(t.id);
    this.cargarIngreso(t.id);
    this.cargarCambiosItems(t.id);
    this.cargarDocumentos(t.id);
    this.cargarDocumentosQhse(t);
    this.cargarEpi(t.id);
    this.cargarTerminos(t.id);
    this.cargarCasosFlota(t.id);
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
      next: (t) => {
        this.ticket.set(t);
        this.cargando.set(false);
        this.cargarQuimicos(t.id);
        this.cargarReportesDiarios(t.id);
        this.cargarIngreso(t.id);
        this.cargarCambiosItems(t.id);
        this.cargarDocumentos(t.id);
        this.cargarPedido(t.pedidoId);
        this.cargarDocumentosQhse(t);
        this.cargarEpi(t.id);
        this.cargarTerminos(t.id);
        this.cargarCasosFlota(t.id);
      },
      error: (err) => {
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
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.servicio.avanzar(t.id, s.codigo, motivo).subscribe({
      next: (n) => {
        this.ocupado.set(false);
        this.ticket.set(n);
        this.notify.success(`Pasó a ${s.nombre}`);
      },
      error: (err) => {
        this.ocupado.set(false);
        this.errorAccion.set(
          mensajeErrorTicket(err, 'No se pudo pasar al siguiente paso. Intente de nuevo.'),
        );
      },
    });
  }

  protected asignar(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<TicketAsignarDialog, TicketAsignarDialogData>({
      title: 'Asignar el equipo del servicio',
      content: TicketAsignarDialog,
      data: {
        ticketId: t.id,
        titulo: `Pedido ${t.pedidoCodigo} · Ticket ${t.ticketNumero ?? 's/n'}`,
        actual: t.asignacion,
      },
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
    return isNaN(d.getTime())
      ? iso
      : `${formatoDia(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
}
