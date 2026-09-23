import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe, formatDate } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import { AuthService } from '../../../../../core/services/auth.service';
import { capitalize, parseLocalDateString, toLocalDateString } from '../../../../../shared/utils';
import { MACRO_ESTADO_LABELS, MACRO_ESTADO_TONE } from '../../../../../shared/models/timeline.model';
import {
  DynadrillApprovalActionsComponent,
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDatetimePickerComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillInspectionGridComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
  type DynadrillApprovalDecision,
  type DynadrillContextCardItem,
  type DynadrillContextCardTag,
  type DynadrillInspectionItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  PumpingTicket,
  PumpingUnitReport,
  PUMPING_SERVICE_TYPE_LABELS,
  PUMPING_STEP_LABELS,
  PUMPING_STEP_ROLE,
  esRolResponsablePumping,
  createChassisInspectionItems,
  createMotorInspectionItems,
  createArrivalEquipmentItems,
  createInstrumentationItems,
  createDefaultTires,
  createDefaultHubodometro,
  nextHubodometroAxleLabel,
  type PumpingStep,
  type PumpingChemical,
  type HubodometroEntry,
  type TireEntry,
  type TravelManagement,
  type DailyActivityReport,
} from '../../models/pumping.model';
import { PumpingService } from '../../services/pumping.service';
import { SolicitudCambioItemsService } from '../../services/solicitud-cambio-items.service';
import type { SolicitudCambioItems } from '../../models/solicitud-cambio-items.model';
import {
  SolicitarCambioItemsDialog,
  SolicitarCambioItemsDialogData,
  SolicitarCambioItemsDialogResult,
} from '../../components/solicitar-cambio-items-dialog';
import { PedidoService } from '../../../../facturacion/services/pedido.service';
import { itemsEstimadosDe, TIPO_SERVICIO_LABELS, type ItemEstimado, type Pedido, type PedidoDocumentoAdjunto } from '../../../../facturacion/models/pedido.model';
import { VerPedidoDialog, VerPedidoDialogData } from '../../../../facturacion/components/ver-pedido-dialog';
import { TicketQhseBanner } from '../../../shared/ticket-qhse-banner/ticket-qhse-banner';
import {
  OperativoDocsBridgeService,
  TimelinePopoverTriggerDirective,
  UbicacionSelectorComponent,
  type UbicacionSeleccion,
} from '../../../../../shared/index';
import { CreateUnitReportInput, unitReportHasNovedades, type UnitReport } from '../../../../maintenance/models/unit-report.model';
import { UnitReportsService } from '../../../../maintenance/services/unit-reports.service';
import { UnidadesService } from '../../../../maintenance/services/unidades.service';
import type { Unidad } from '../../../../maintenance/models/unidad.model';
import { RolesService } from '../../../../users/services/users.service';
import {
  VehicleInspection,
  VEHICLE_CHECKLIST_VEHICULO,
  VEHICLE_CHECKLIST_EQUIPO,
  vehicleInspectionIsUsable,
} from '../../../../maintenance/models/vehicle-inspection.model';
import { VehicleInspectionDialog, VehicleInspectionDialogData } from '../../../../maintenance/components/vehicle-inspection-dialog';
import { VehicleInspectionsService } from '../../../../maintenance/services/vehicle-inspections.service';
import { ReviewArrivalReportDialog, ReviewArrivalReportDialogData, ReviewArrivalReportDialogResult } from '../../components/review-arrival-report-dialog';
import { TravelManagementDialog, TravelManagementDialogData, TravelManagementDialogResult } from '../../components/travel-management-dialog';
import { DailyActivityReportDialog, DailyActivityReportDialogData, DailyActivityReportDialogResult } from '../../components/daily-activity-report-dialog';
import { MaintenanceOrdersService } from '../../../../maintenance/services/maintenance-orders.service';
import { MaintenanceOrderWithSubOrders, SubOrder, SubOrderStatus } from '../../../../maintenance/models/maintenance-order.model';
import { SuborderDetailDialog, SuborderDetailDialogData } from '../../../../maintenance/components/suborder-detail-dialog';
import { SuborderReviewDialog, SuborderReviewDialogData } from '../../../../maintenance/components/suborder-review-dialog';
import { Articulo } from '../../../../inventario/models/articulo.model';
import { ArticulosService } from '../../../../inventario/services/articulos.service';
import { MovimientosInventarioService } from '../../../../inventario/services/movimientos-inventario.service';
import { forkJoin, map, of, type Observable } from 'rxjs';

/**
 * Inspección de salida de ejemplo — solo para MOSTRAR el detalle en los
 * pasos de llegada cuando todavía no hay una inspección real persistida.
 * `id: 0` marca que NO existe en el backend: los diálogos que la reciben
 * van siempre en modo lectura (`readonly: true`), nunca hacen PUT/PATCH.
 */
function createMockCompletedInspection(
  operatorName: string,
  unitCode: string,
  unidad?: Unidad,
  conductorNombre?: string,
): VehicleInspection {
  return {
    id: 0,
    unidadId: unidad?.id ?? 0,
    unidadCode: unidad?.code ?? unitCode,
    fecha: toLocalDateString(new Date()),
    puntoPartida: 'Base Coco',
    destino: 'Pozo Beta-9',
    // El conductor es el elegido en la inspección — no el operador del ticket.
    inspeccionadoPor: conductorNombre || operatorName,
    // Descripción del vehículo tomada del registro real de la Unidad.
    marca: unidad?.marca ?? '',
    tipo: unidad?.categoriaPeso ?? '',
    modelo: unidad?.modelo ?? '',
    anioFabricacion: unidad?.anio ?? '',
    placa: unidad?.placa ?? '',
    fechaMatricula: unidad?.fechaMatricula,
    caducidadMatricula: unidad?.caducidadMatricula,
    caducidadPoliza: unidad?.caducidadPoliza,
    kmInicial: 45200,
    kmFinal: 45380,
    proximoMantenimiento: toLocalDateString(new Date(Date.now() + 90 * 86_400_000)),
    checklistVehiculo: VEHICLE_CHECKLIST_VEHICULO.map(label => ({ label, estado: 'C' as const })),
    checklistEquipo: VEHICLE_CHECKLIST_EQUIPO.map(label => ({ label, estado: 'C' as const })),
    licenciaVigente: true,
    manejoDefensivoVigente: true,
    examenMedicoVigente: true,
    examenPsicosensometrico: true,
    documentosClientes: true,
    vacunasCertificado: true,
    reuneCondicionesParaTrabajar: true,
    observacionesConductor: 'Sin novedades',
    supervisorNombre: '',
    supervisorApprovedBy: '',
    supervisorApprovedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

const STEP_KEYS: PumpingStep[] = ['revision_inicial', 'asignacion', 'traslado_salida', 'revision_reportes_salida', 'ejecucion_operativa', 'control_retorno', 'traslado_llegada', 'mantenimiento', 'revision_reportes_llegada', 'revision_final', 'cierre'];

/** Mismo límite que el documento de monitoreo (`daily-activity-report-dialog.ts`). */
const MAX_CHEMICAL_MIXTURE_BYTES = 5 * 1024 * 1024;

/**
 * PumpingUnitReport guarda fechas como string ISO (yyyy-MM-dd);
 * dynadrill-datetime-picker trabaja con Date. Se usan los getters LOCALES
 * (no toISOString, que es UTC) — en Ecuador (UTC-5) un Date de medianoche
 * local caería al día anterior al serializar en UTC.
 */
function toIsoDateString(date: Date | null): string {
  return date ? toLocalDateString(date) : '';
}

/** A diferencia de `Number(x) || null`, no descarta una lectura real de 0 — solo trata el campo vacío como ausente. */
function toFuelReading(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isNaN(value) ? null : value;
}

@Component({
  selector: 'app-ticket-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillBannerComponent,
    DynadrillContextCardComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
    DynadrillInputComponent,
    DynadrillDatetimePickerComponent,
    DynadrillSelectComponent,
    DynadrillInspectionGridComponent,
    DynadrillChipGroupComponent,
    DynadrillApprovalActionsComponent,
    DynadrillUploadZoneComponent,
    DynadrillIconComponent,
    DynadrillIconButtonComponent,
    DynadrillTagComponent,
    UbicacionSelectorComponent,
    TicketQhseBanner,
    TimelinePopoverTriggerDirective,
  ],
  templateUrl: './ticket-detail-page.html',
  styleUrl: './ticket-detail-page.scss',
})
export class TicketDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pumpingService = inject(PumpingService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly docsBridge = inject(OperativoDocsBridgeService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  // ── Cobertura de la Matriz Maestra IPERC (HSE-PLAN-001) ──
  /** Resultado del chequeo del backend: la matriz maestra cubre —aprobadas— las actividades del trabajo. */
  protected readonly ipercVinculo = computed(() => this.ticket()?.qhse ?? null);
  /**
   * El servicio no avanza (asignar personal, ejecutar) si alguna actividad
   * de la línea no está aprobada en la matriz maestra. Tickets sin vínculo
   * (datos viejos / backend sin reiniciar) no se bloquean.
   */
  protected readonly coberturaOk = computed(() => {
    const v = this.ipercVinculo();
    return !v || v.cobertura === 'ok';
  });
  /** Actividades que todavía no están aprobadas — lo que HSE tiene pendiente. */
  protected readonly actividadesPendientes = computed(() =>
    (this.ipercVinculo()?.actividades ?? []).filter(a => a.estado !== 'aprobada'),
  );
  protected readonly actividadesPendientesTexto = computed(() =>
    this.actividadesPendientes()
      .map(a => a.nombre)
      .join(', '),
  );
  private readonly IPERC_ESTADO_LABELS: Record<string, string> = {
    borrador: 'en elaboración por HSE',
    en_evaluacion: 'en evaluación por HSE',
    en_revision: 'en revisión por HSE',
    aprobada: 'aprobada',
    rechazada: 'rechazada',
    no_evaluada: 'sin evaluar',
  };
  protected ipercEstadoLabel(estado: string): string {
    return this.IPERC_ESTADO_LABELS[estado] ?? estado;
  }
  /** El módulo QHSE (y su endpoint) solo lo abren estos roles. */
  private readonly QHSE_VIEWER_ROLES = ['Técnico HSE', 'Coordinador HSE', 'Gerente HSE', 'Superadmin', 'Jefe de Base'];
  protected readonly puedeVerMatrizIperc = computed(() => this.QHSE_VIEWER_ROLES.includes(this.roleName()));
  protected verMatrizIperc(actividadIpercId: number): void {
    if (this.puedeVerMatrizIperc()) this.router.navigate(['/dashboard/qhse/iperc', actividadIpercId]);
  }

  // ── PTW / Recibimiento de Sitio (HSE-SITIO-001) ──
  /** Estado del PTW del servicio (lo adjunta el backend). `null` mientras la cobertura IPERC no esté completa. */
  protected readonly ptwVinculo = computed(() => this.ipercVinculo()?.ptw ?? null);
  /**
   * Segundo gate: no se pasa a ejecución en campo (Reporte Diario) sin el
   * PTW firmado en sitio — PUM-004 "Descargar documentos HSE", RN-PUM-004-06.
   * Si aún no hay PTW (ticket sembrado / sin pedido) no se bloquea; el
   * bloqueo aplica en cuanto el PTW existe (se abre solo al completarse la
   * cobertura IPERC).
   */
  protected readonly ptwFirmadoOk = computed(() => {
    if (!this.coberturaOk()) return false;
    const p = this.ptwVinculo();
    return !p || p.firmadoSitio;
  });
  private readonly PTW_FASE_LABELS: Record<string, string> = {
    gabinete: 'preparación en gabinete',
    ingreso: 'ingreso a locación',
    verificaciones: 'verificaciones de seguridad',
    formalizacion: 'formalización del recibimiento',
    ejecucion: 'ejecución y devolución',
    gestion_documental: 'gestión documental final',
  };
  protected ptwFaseLabel(fase: string): string {
    return this.PTW_FASE_LABELS[fase] ?? fase;
  }
  protected verPtw(): void {
    const p = this.ptwVinculo();
    if (p && this.puedeVerMatrizIperc()) this.router.navigate(['/dashboard/qhse/ptw', p.id]);
  }

  // ── Eventos críticos: Stop Work (HSE-SEGUIMIENTO-003) y Emergencia (HSE-TRIAGE-001) ──
  /** Evento Stop Work abierto contra este servicio — mientras exista, el trabajo está detenido. */
  protected readonly swaActivo = computed(() => this.ipercVinculo()?.swa ?? null);
  /** Emergencia abierta ('activa' o 'controlada') contra este servicio — mismo criterio que un SWA, con mayor severidad. */
  protected readonly emergenciaActiva = computed(() => this.ipercVinculo()?.emergencia ?? null);
  /** Guard común: con un SWA o una Emergencia abiertos, ningún paso del flujo avanza. Devuelve `true` (y avisa) si está bloqueado. */
  private bloqueadoPorSwa(): boolean {
    const e = this.emergenciaActiva();
    if (e) {
      this.notify.error(
        'Emergencia activa',
        `Emergencia ${e.code} abierta. El servicio no puede avanzar hasta que se cierre en QHSE.`,
      );
      return true;
    }
    const s = this.swaActivo();
    if (!s) return false;
    this.notify.error(
      'Trabajo detenido',
      `Stop Work ${s.code} abierto (${s.tipoPeligro}). El servicio no puede avanzar hasta que HSE y el Company Man autoricen la reanudación.`,
    );
    return true;
  }
  protected verSwa(): void {
    const s = this.swaActivo();
    if (s && this.puedeVerMatrizIperc()) this.router.navigate(['/dashboard/qhse/swa', s.id]);
  }
  protected verEmergencia(): void {
    const e = this.emergenciaActiva();
    if (e && this.puedeVerMatrizIperc()) this.router.navigate(['/dashboard/qhse/emergencias', e.id]);
  }

  private readonly unitReportsService = inject(UnitReportsService);
  private readonly unidadesService = inject(UnidadesService);
  /** Catálogo de unidades — para completar la descripción real del vehículo en las inspecciones de ejemplo. */
  private readonly unidades = signal<Unidad[]>([]);
  private unidadPorCodigo(code: string): Unidad | undefined {
    return this.unidades().find(u => u.code === code);
  }
  private readonly rolesService = inject(RolesService);
  /** Nombre del Jefe de Base — va en "Gerente/Supervisor" y "Gerente que autoriza" del Gerenciamiento de Viaje. */
  protected readonly jefeBaseNombre = signal('');
  /** Nombres de conductores con permisos — para asignar el conductor en las inspecciones de ejemplo. */
  private readonly conductoresPermisos = signal<string[]>([]);
  private conductorParaOperador(operatorId: number): string {
    const nombres = this.conductoresPermisos();
    return nombres.length ? nombres[operatorId % nombres.length] : '';
  }
  /** Inspecciones de vehículos ya registradas en el backend — para recuperar
   *  la que hizo el operador (con su conductor real) al recargar la página. */
  private readonly realInspections = signal<VehicleInspection[]>([]);
  /**
   * Solo cuentan inspecciones de ESTE ticket — antes se tomaba la más
   * reciente para esa unidad sin importar de qué ticket era, así que una
   * unidad reutilizada (ej. CAM-04) llegaba con "Inspección realizada" ya
   * puesta en un ticket nuevo, heredada de un servicio anterior (bug
   * reportado). Las inspecciones viejas sin `ticketId` (de antes de este
   * campo) ya no matchean ningún ticket nuevo.
   */
  private ultimaInspeccionReal(unitCode: string): VehicleInspection | undefined {
    const ticketId = this.ticket()?.id;
    return this.realInspections()
      .filter(i => i.unidadCode === unitCode && i.ticketId === ticketId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  }
  /** Conductor elegido en la inspección de la unidad del operador (no el operador). */
  private conductorDeOperador(operatorId: number, retorno = false): string {
    const llegada = this.completedLlegadaInspections().get(operatorId) as VehicleInspection | undefined;
    const salida = this.completedInspections().get(operatorId) as VehicleInspection | undefined;
    const insp = retorno ? (llegada ?? salida) : salida;
    return insp?.inspeccionadoPor ?? '';
  }

  /** Quién hizo la inspección de vehículo de esa unidad en este tramo (salida o llegada) — para el Reporte de Unidad. */
  private inspectorDeUnidad(mapa: Map<number, unknown>, unitCode: string): string {
    for (const insp of mapa.values()) {
      const i = insp as VehicleInspection;
      if (i.unidadCode === unitCode) return i.inspeccionadoPor;
    }
    return '';
  }
  private readonly vehicleInspectionsService = inject(VehicleInspectionsService);
  private readonly maintenanceOrdersService = inject(MaintenanceOrdersService);
  private readonly articulosService = inject(ArticulosService);
  private readonly movimientosInventarioService = inject(MovimientosInventarioService);

  private readonly pedidoService = inject(PedidoService);
  private readonly solicitudCambioItemsService = inject(SolicitudCambioItemsService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly ticket = signal<PumpingTicket | null>(null);
  /** Pedido de Ventas vinculado a este ticket — sus ítems son lo que el Operador puede pedir cambiar. */
  protected readonly pedido = signal<Pedido | null>(null);
  protected readonly pedidoItems = computed(() => {
    const p = this.pedido();
    return p ? itemsEstimadosDe(p) : [];
  });
  protected readonly pedidoItemsTotal = computed(() =>
    this.pedidoItems().reduce((sum, item) => sum + item.cantidad * item.valorUnitario, 0),
  );
  protected readonly pedidoTipoServicioLabels = computed(() => {
    const p = this.pedido();
    return p ? p.tipoServicio.map(t => TIPO_SERVICIO_LABELS[t]) : [];
  });
  /** Solicitud de cambio de ítems todavía sin resolver por el Supervisor (si hay una). */
  protected readonly solicitudPendiente = signal<SolicitudCambioItems | null>(null);
  protected readonly viewMode = signal<string>(''); // 'asignar' | 'resumen' | ''
  protected readonly maintenanceOrders = signal<MaintenanceOrderWithSubOrders[]>([]);
  /**
   * `maintenanceOrders` arranca en `[]` hasta que responde la llamada HTTP
   * de `loadMaintenanceOrders()` — mientras tanto, `novedadesSinAtender()`
   * (que filtra sobre ese array) da una lista vacía por falta de datos, no
   * porque de verdad no haya nada pendiente, y el botón "Continuar a
   * ejecución de llegada" quedaba habilitado en esa ventana (bug
   * reportado: aparecía habilitado sin haber hecho los mantenimientos).
   */
  protected readonly maintenanceOrdersLoading = signal(true);
  /** Solo para leer el texto de la novedad original inline en la lista de "Mantenimientos operativos" — el detalle completo (diagnóstico, etc.) sigue viviendo en SuborderReviewDialog. */
  private readonly unitReports = signal<UnitReport[]>([]);

  // ── Stepper ──

  protected readonly stepLabels = Object.values(PUMPING_STEP_LABELS);

  // El stepper hace scroll horizontal en mobile (ver .scss) — sin esto, en
  // pasos avanzados (hasta 11) el paso activo queda fuera de vista y el
  // usuario tiene que descubrir por su cuenta que hay que deslizar para
  // encontrarlo. Mismo patrón que el tracker de fases de FCR.
  private readonly trackerScrollEl = viewChild<ElementRef<HTMLElement>>('trackerScroll');

  protected readonly currentStepIndex = computed(() => {
    const t = this.ticket();
    if (!t) return 0;
    return STEP_KEYS.indexOf(t.currentStep);
  });

  /** `null` = sin selección manual → se muestra el detalle del paso actual. Clic en un paso ya alcanzado lo selecciona. */
  private readonly manualStepIndex = signal<number | null>(null);
  protected readonly selectedStepIndex = computed(() => this.manualStepIndex() ?? this.currentStepIndex());

  protected seleccionarPaso(index: number): void {
    if (index > this.currentStepIndex()) return;
    this.manualStepIndex.set(index);
  }

  protected readonly currentStep = computed(() => this.ticket()?.currentStep ?? 'revision_inicial');

  // ── Context card (cabecera de identidad del ticket, dynadrill-ui@1.1.0 variant="card") ──

  protected readonly contextCardTags = computed<DynadrillContextCardTag[]>(() => {
    const t = this.ticket();
    const macro = t?.timelineResumen?.macroEstadoActual;
    const tags: DynadrillContextCardTag[] = [];
    if (macro) tags.push({ label: MACRO_ESTADO_LABELS[macro], variant: MACRO_ESTADO_TONE[macro] });
    if (t?.proposalOrigin) tags.push({ label: t.proposalOrigin, variant: 'info' });
    return tags;
  });

  protected readonly contextCardGroups = computed<DynadrillContextCardItem[][]>(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      [{ label: 'Cliente', value: t.clientName, icon: 'users' }],
      [
        { label: 'Pozo', value: t.wellName, icon: 'location' },
        { label: 'Tipo de servicio', value: PUMPING_SERVICE_TYPE_LABELS[t.serviceType], icon: 'tool', badgeVariant: 'brand' },
      ],
      [
        {
          label: 'Fecha estimada',
          value: t.estimatedDate || '—',
          icon: 'calendar',
          caption: t.estimatedDate ? capitalize(formatDate(parseLocalDateString(t.estimatedDate), "EEEE, d 'de' MMMM y", 'es')) : undefined,
        },
        { label: 'Origen', value: t.proposalOrigin, icon: 'modules', dotVariant: 'success' },
      ],
    ];
  });

  protected readonly contextCardFooterStatus = computed<DynadrillContextCardTag>(() => {
    const cerrado = this.ticket()?.status === 'cerrado' || this.ticket()?.status === 'aprobado';
    return cerrado ? { label: 'Finalizado', variant: 'neutral' } : { label: 'Activo', variant: 'success' };
  });

  // ══════════════════════════════════════════════
  // PASO 1: Revisión propuesta
  // ══════════════════════════════════════════════

  protected readonly supervisorOptions: DynadrillSelectOption[] = [
    { label: 'Luis Vega', value: 1 },
    { label: 'Ana Ruiz', value: 2 },
    { label: 'Marcos Torres', value: 3 },
  ];
  protected readonly selectedSupervisor = signal<number | null>(null);

  // ══════════════════════════════════════════════
  // PASO 2: Asignación
  // ══════════════════════════════════════════════

  protected readonly operatorOptions: DynadrillSelectOption[] = [
    { label: 'Álvarez Díaz Arturo Salomón — Operador I CTU', value: 1 },
    { label: 'Auquilla Salcán Luis Hernán — Operador de Fluidos', value: 2 },
    { label: 'Benítez Intriago Danny Orlando — Operador II Fishing', value: 3 },
    { label: 'Bravo Rosas Omar Alfredo — Operador II CTU', value: 4 },
  ];
  protected readonly selectedOperators = signal<number[]>([]);

  // Ids reales del catálogo `Unidad` (ver prisma/seed.ts UNIDADES) — GEN-01/
  // GEN-02 ocupan el 4 y 5, así que CAM-04/CAM-08 son 6 y 7, no 4 y 5.
  protected readonly unitOptions: DynadrillSelectOption[] = [
    { label: 'PUM-07', value: 1 },
    { label: 'PUM-15', value: 2 },
    { label: '4-CTV-03', value: 3 },
    { label: 'CAM-04', value: 6 },
    { label: 'CAM-08', value: 7 },
  ];
  protected readonly selectedUnits = signal<number[]>([]);

  // ── Químicos: catálogo real de Inventario (Bodeguero), categoría QUIMICA ──

  /** Solo los químicos existen como Articulo con stock — se cargan desde el módulo Inventario, no una lista fija. */
  protected readonly chemicalArticulos = signal<Articulo[]>([]);

  protected readonly chemicalOptions = computed<DynadrillSelectOption[]>(() =>
    this.chemicalArticulos().map(a => ({
      label: `${a.nombre} — ${a.unidadStock} (stock: ${a.stockActual})`,
      value: a.id,
    })),
  );

  protected readonly selectedChemicals = signal<number[]>([]);
  /** Cantidad a retirar de bodega por cada químico seleccionado (articuloId → cantidad). */
  protected readonly chemicalQuantities = signal<Map<number, number>>(new Map());
  /** Documento de mezcla de químicos — obligatorio en cuanto se selecciona al menos un químico. */
  protected readonly chemicalMixtureDocument = signal<NzUploadFile | null>(null);
  /** Si `chemicalMixtureDocument` viene de precargar un documento REAL del pedido (subida a disco, `PedidoDocumento`), acá queda la referencia para poder previsualizarlo/descargarlo — `null` si el que está cargado es uno subido acá mismo en Pumping (también real, `PumpingDocumento` campo='mezcla', ver `onChemicalMixtureDocumentSelected`). */
  protected readonly chemicalMixtureDocumentoOrigen = signal<PedidoDocumentoAdjunto | null>(null);
  protected readonly chemicalMixtureUploading = signal(false);

  private loadChemicalArticulos(): void {
    this.articulosService.list().subscribe({
      next: articulos => {
        this.chemicalArticulos.set(articulos.filter(a => a.categoria === 'QUIMICA' && a.activo));
        this.sincronizarQuimicosDelPedido();
      },
    });
  }

  // ── Químicos del pedido — Ventas los marca en Líneas Estimadas (esQuimico); ── //
  // ── se precargan acá en vez de tener que volver a elegirlos del catálogo.  ── //

  /** Líneas del pedido que Ventas marcó como químico. */
  protected readonly chemicalsPedido = computed(() => this.pedidoItems().filter(it => it.esQuimico));

  /** Cada línea de químico del pedido, emparejada con su Articulo real de Inventario por código (o `undefined` si no hay coincidencia — Ventas y Bodega no siempre usan el mismo código). */
  protected readonly chemicalsPedidoResueltos = computed(() =>
    this.chemicalsPedido().map(item => ({ item, articulo: this.chemicalArticulos().find(a => a.codigo === item.codigo) })),
  );

  private chemicalesPrecargados = false;

  /** Se corre una sola vez, apenas están disponibles tanto el pedido como el catálogo de químicos (llegan de dos cargas async independientes, en cualquier orden). */
  private sincronizarQuimicosDelPedido(): void {
    if (this.chemicalesPrecargados) return;
    const resueltos = this.chemicalsPedidoResueltos().filter(r => !!r.articulo);
    if (!this.pedido() || this.chemicalArticulos().length === 0) return; // todavía falta una de las dos cargas
    this.chemicalesPrecargados = true;
    if (!resueltos.length) return;
    this.selectedChemicals.set(resueltos.map(r => r.articulo!.id));
    this.chemicalQuantities.set(new Map(resueltos.map(r => [r.articulo!.id, r.item.cantidad])));
  }

  /**
   * Documentos de referencia que Ventas adjuntó al crear el pedido (ej.
   * ficha de mezcla de químicos) — para que Pumping sepa de qué se trata
   * sin que se lo vuelvan a pedir. Si hay al menos uno y todavía no se
   * cargó el documento de mezcla, se precarga con el primero (mismo
   * criterio del resto de la app: se guarda el nombre del archivo, no su
   * contenido — no hay almacenamiento real de binarios).
   */
  /** Cargados aparte (subida real a disco, `PedidoDocumento`) — ya no viven en el payload del propio Pedido. */
  protected readonly documentosReferenciaPedido = signal<PedidoDocumentoAdjunto[]>([]);

  private precargarDocumentoDeMezcla(): void {
    if (this.chemicalMixtureDocument()) return; // ya tiene uno cargado (a mano, o ya se precargó antes)
    const [primero] = this.documentosReferenciaPedido();
    if (!primero) return;
    this.chemicalMixtureDocument.set({ uid: '-1', name: primero.nombreOriginal } as NzUploadFile);
    this.chemicalMixtureDocumentoOrigen.set(primero);
  }

  /** Blob autenticado (mismo criterio que `previsualizarDocumento` de FCR) — un `<a href>` directo al endpoint no llevaría el Bearer. */
  protected previsualizarDocumentoReferenciaPedido(doc: PedidoDocumentoAdjunto): void {
    const p = this.pedido();
    if (!p) return;
    this.pedidoService.descargarDocumentoAdjunto(p.id, doc.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el documento.'),
    });
  }

  protected chemicalArticulo(articuloId: number): Articulo | undefined {
    return this.chemicalArticulos().find(a => a.id === articuloId);
  }

  protected selectedChemicalRows(): Articulo[] {
    const ids = this.selectedChemicals();
    return this.chemicalArticulos().filter(a => ids.includes(a.id));
  }

  protected chemicalQuantity(articuloId: number): string {
    const n = this.chemicalQuantities().get(articuloId);
    return n != null ? String(n) : '';
  }

  protected onChemicalQuantityChange(articuloId: number, value: string): void {
    const n = Number(value);
    this.chemicalQuantities.update(map => {
      const updated = new Map(map);
      if (Number.isFinite(n) && n > 0) {
        updated.set(articuloId, n);
      } else {
        updated.delete(articuloId);
      }
      return updated;
    });
  }

  /** Resuelve a mano una línea de químico del pedido que no cruzó por código contra Inventario. */
  protected onResolverQuimicoManual(item: ItemEstimado, articuloId: number): void {
    this.selectedChemicals.update(ids => (ids.includes(articuloId) ? ids : [...ids, articuloId]));
    this.chemicalQuantities.update(map => new Map(map).set(articuloId, item.cantidad));
  }

  /**
   * Sube el archivo real a disco (`PumpingDocumento`, campo='mezcla') — antes
   * solo se guardaba `file.name` en el payload del ticket, sin contenido
   * real detrás (bug: Facturación no tenía forma de recuperar el documento
   * firmado para adjuntarlo antes de "Enviar al cliente"). Mismo patrón que
   * el documento de monitoreo (`daily-activity-report-dialog.ts`).
   */
  protected onChemicalMixtureDocumentSelected(file: NzUploadFile): void {
    const ticketId = this.ticket()?.id;
    const archivo = (file.originFileObj as File | undefined) ?? (file as unknown as File);
    if (!ticketId || !archivo || typeof archivo.size !== 'number') {
      this.notify.error('Archivo no reconocido', 'No se pudo leer el archivo seleccionado. Probá de nuevo.');
      return;
    }
    if (archivo.size > MAX_CHEMICAL_MIXTURE_BYTES) {
      this.notify.error('Archivo demasiado grande', 'El archivo supera el máximo permitido de 5MB.');
      return;
    }
    this.chemicalMixtureUploading.set(true);
    this.pumpingService.subirDocumento(ticketId, 'mezcla', archivo).subscribe({
      next: doc => {
        this.chemicalMixtureDocument.set({ uid: '-1', name: doc.nombreOriginal } as NzUploadFile);
        this.chemicalMixtureDocumentoOrigen.set(null);
        this.chemicalMixtureUploading.set(false);
        this.notify.success('Documento cargado', `${doc.nombreOriginal} — documento de mezcla de químicos.`);
      },
      error: () => {
        this.chemicalMixtureUploading.set(false);
        this.notify.error('Error', 'No se pudo subir el documento de mezcla.');
      },
    });
  }

  /** Motivo de bloqueo (cantidad sin definir o stock insuficiente en bodega), o null si todo está en regla. */
  protected readonly chemicalStockError = computed(() => {
    for (const articulo of this.selectedChemicalRows()) {
      const cantidad = this.chemicalQuantities().get(articulo.id);
      if (!cantidad || cantidad <= 0) return `Ingrese la cantidad a retirar de ${articulo.nombre}.`;
      if (cantidad > articulo.stockActual) {
        return `${articulo.nombre}: stock insuficiente en bodega (disponible ${articulo.stockActual} ${articulo.unidadStock}).`;
      }
    }
    return null;
  });

  // ══════════════════════════════════════════════
  // PASO 2: Asignación — Resumen
  // ══════════════════════════════════════════════

  protected readonly assignmentSummaryColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Operador' },
    { key: 'role', header: 'Cargo/Rol' },
    { key: 'unitCode', header: 'Unidad asignada' },
    { key: 'inspectionStatus', header: 'Inspección', type: 'badge' },
    { key: 'reportStatus', header: 'Reporte de unidad', type: 'badge' },
  ];

  protected readonly assignmentSummaryRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return t.operators.map(op => ({
      id: op.id,
      name: op.name,
      role: op.role,
      unitCode: op.unitCode,
      inspectionStatus: { text: 'Pendiente', tone: 'warning' as const },
      reportStatus: { text: 'Pendiente', tone: 'warning' as const },
    }));
  });

  /** Verifica si todos los operadores tienen inspección y reporte completados */
  protected readonly allOperatorsReady = computed(() => {
    const rows = this.assignmentSummaryRows();
    return rows.length > 0 && rows.every(
      r => r.inspectionStatus.text === 'Realizada' && r.reportStatus.text === 'Completado',
    );
  });

  protected readonly chemicalSummaryColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Químico' },
    { key: 'quantityAssigned', header: 'Cantidad asignada' },
    { key: 'unit', header: 'Unidad' },
  ];

  protected readonly chemicalSummaryRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return t.chemicals.map(c => ({
      id: c.id,
      name: c.name,
      quantityAssigned: c.quantityAssigned,
      unit: c.unit,
    }));
  });

  // ══════════════════════════════════════════════
  // PASO 2: Asignación — Formulario con operador-unidad vinculado
  // ══════════════════════════════════════════════

  protected readonly operatorAssignments = signal<{ operatorId: number; unitId: number | null }[]>([]);

  protected onOperatorAdded(value: unknown): void {
    const ids = Array.isArray(value) ? value as number[] : [];
    this.selectedOperators.set(ids);
    // Sincronizar assignments: agregar nuevos, quitar eliminados
    this.operatorAssignments.update(current => {
      const existing = current.filter(a => ids.includes(a.operatorId));
      const newIds = ids.filter(id => !current.some(a => a.operatorId === id));
      return [...existing, ...newIds.map(id => ({ operatorId: id, unitId: null }))];
    });
  }

  protected onOperatorUnitChange(operatorId: number, unitId: unknown): void {
    this.operatorAssignments.update(assignments =>
      assignments.map(a => a.operatorId === operatorId ? { ...a, unitId: unitId as number } : a),
    );
    // Actualizar selectedUnits con todas las unidades asignadas
    const allUnits = this.operatorAssignments()
      .map(a => a.unitId)
      .filter((id): id is number => id !== null);
    this.selectedUnits.set([...new Set(allUnits)]);
  }

  protected getOperatorName(operatorId: number): string {
    return this.operatorOptions.find(o => o.value === operatorId)?.label ?? '';
  }

  protected getOperatorUnit(operatorId: number): number | null {
    return this.operatorAssignments().find(a => a.operatorId === operatorId)?.unitId ?? null;
  }

  protected readonly allOperatorsHaveUnits = computed(() => {
    const assignments = this.operatorAssignments();
    return assignments.length > 0 && assignments.every(a => a.unitId !== null);
  });

  // ══════════════════════════════════════════════
  // Supervisor: Revisar reportes de salida
  // ══════════════════════════════════════════════

  protected readonly reviewSalidaColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Operador' },
    { key: 'role', header: 'Cargo/Rol' },
    { key: 'unitCode', header: 'Unidad asignada' },
    { key: 'inspectionStatus', header: 'Inspección de Vehículos (DYN-SGI-RE-068)', type: 'badge' },
    { key: 'reportStatus', header: 'Reporte de Unidad (DYN-MNT-RE-012)', type: 'badge' },
  ];

  protected readonly reviewSalidaRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const rejected = this.rejectedSalidaOperators();
    const approved = this.approvedSalidaOperators();
    const inspecciones = this.completedInspections();
    return t.operators.map(op => ({
      id: op.id,
      name: op.name,
      role: op.role,
      unitCode: op.unitCode,
      // Antes quedaba hardcodeado en "Realizada" sin importar el estado
      // real — el Supervisor veía la inspección como hecha aunque el
      // operador nunca la hubiera registrado, y no tenía forma de
      // hacerla/completarla desde acá (bug reportado).
      inspectionStatus: inspecciones.has(op.id)
        ? { text: 'Realizada', tone: 'success' as const }
        : { text: 'Pendiente', tone: 'warning' as const },
      reportStatus: rejected.has(op.id)
        ? { text: 'Rechazado', tone: 'error' as const }
        : approved.has(op.id)
          ? { text: 'Aprobado', tone: 'success' as const }
          : { text: 'Completado', tone: 'success' as const },
      approved: false,
    }));
  });

  // Trackeo de aprobaciones por operador para salida
  protected readonly approvedSalidaOperators = signal<Set<number>>(new Set());
  protected readonly rejectedSalidaOperators = signal<Set<number>>(new Set());
  protected readonly salidaRejectionReasons = signal<Map<number, string>>(new Map());
  protected readonly travelManagements = signal<Map<number, TravelManagement>>(new Map());

  protected isOperatorSalidaApproved(row: Record<string, unknown>): boolean {
    return this.approvedSalidaOperators().has(row['id'] as number);
  }

  protected canReviewSalida(row: Record<string, unknown>): boolean {
    const insp = row['inspectionStatus'] as { text: string };
    const report = row['reportStatus'] as { text: string };
    return insp.text === 'Realizada' && report.text === 'Completado';
  }

  protected isOperatorSalidaRejected(row: Record<string, unknown>): boolean {
    return this.rejectedSalidaOperators().has(row['id'] as number);
  }

  protected viewSalidaRejectionReason(row: Record<string, unknown>): void {
    const id = row['id'] as number;
    const reason = this.salidaRejectionReasons().get(id) || 'Sin motivo especificado.';
    this.notify.error(`Motivo de rechazo — ${row['name']}`, reason);
  }

  protected approveSalidaOperator(row: Record<string, unknown>): void {
    const t = this.ticket();
    if (!t?.unitReport) {
      this.notify.error('Sin reporte', 'No hay reporte de unidad disponible para revisar.');
      return;
    }

    const operatorName = row['name'] as string;
    const unitCode = row['unitCode'] as string;
    // La inspección que el operador realmente registró (no un mock nuevo).
    const inspection =
      (this.completedInspections().get(row['id'] as number) as VehicleInspection | undefined) ??
      createMockCompletedInspection(operatorName, unitCode, this.unidadPorCodigo(unitCode), this.conductorParaOperador(row['id'] as number));

    const ref = this.dialog.open<ReviewArrivalReportDialog, ReviewArrivalReportDialogData>({
      title: 'Revisar inspección y reporte de salida',
      content: ReviewArrivalReportDialog,
      data: {
        operatorName,
        unitCode,
        report: t.unitReport,
        inspection,
      },
      size: 'large',
      footer: false,
    });

    ref.afterClose.subscribe((result: ReviewArrivalReportDialogResult | undefined) => {
      if (!result) return;

      const id = row['id'] as number;
      if (result.approved) {
        this.approvedSalidaOperators.update(set => {
          const updated = new Set(set);
          updated.add(id);
          return updated;
        });
        this.notify.success('Aprobado', `Reporte de salida de ${row['name']} aprobado. Ahora debe crear el Gerenciamiento de Viaje.`);
      } else {
        this.rejectedSalidaOperators.update(set => {
          const updated = new Set(set);
          updated.add(id);
          return updated;
        });
        this.salidaRejectionReasons.update(map => {
          const updated = new Map(map);
          updated.set(id, result.rejectionReason ?? '');
          return updated;
        });
        this.notify.error('Rechazado', `Reporte de ${row['name']} rechazado.`);
      }
    });
  }

  // ── Travel Management (DYN-SGI-RE-049) ──

  /** Operadores cuyo gerenciamiento espera la autorización del Jefe de Base. */
  protected readonly travelPendingApproval = signal<Set<number>>(new Set());
  /** Gerenciamientos retenidos hasta que el Jefe de Base los autorice. */
  protected readonly travelPendingManagements = signal<Map<number, TravelManagement>>(new Map());
  protected readonly returnTravelPendingManagements = signal<Map<number, TravelManagement>>(new Map());

  /**
   * "Sigo sin ver que la info del gerenciamiento de ida se recupere en el de
   * retorno" — el motivo real era que `travelManagements`/`returnTravelManagements`
   * vivían solo en memoria del componente, nunca se guardaban en el ticket:
   * cualquier recarga de página los vaciaba antes de llegar al paso de
   * retorno. Se persisten acá (PUT genérico del ticket) cada vez que cambian.
   */
  private guardarGerenciamientosEnTicket(): void {
    const t = this.ticket();
    if (!t) return;
    this.pumpingService
      .updateTicket(t.id, {
        travelManagements: Object.fromEntries(this.travelManagements()),
        returnTravelManagements: Object.fromEntries(this.returnTravelManagements()),
      })
      .subscribe({ error: () => this.notify.error('Error', 'No se pudo guardar el gerenciamiento de viaje.') });
  }

  /**
   * Todo Gerenciamiento de Viaje (DYN-SGI-RE-049) lo autoriza el Jefe de Base.
   * En la demo un mismo usuario recorre todos los roles: el diálogo de
   * confirmación es la firma del Jefe de Base. No se cambia el rol de la
   * sesión — la autorización es solo del lado del cliente y el Supervisor
   * tiene que poder seguir el flujo (avanzar de paso) apenas queda autorizada.
   */
  protected async autorizarGerenciamiento(row: Record<string, unknown>, retorno = false): Promise<void> {
    const id = row['id'] as number;
    const pendientes = retorno ? this.returnTravelPendingManagements() : this.travelPendingManagements();
    const tm = pendientes.get(id);
    if (!tm) return;
    const jefeBase = this.jefeBaseNombre() || 'Jefe de Base';
    const ok = await this.dialog.confirm({
      title: `Autorización de ${jefeBase}`,
      content: `Como Jefe de Base (${jefeBase}), ¿autorizas el gerenciamiento de viaje${retorno ? ' de retorno' : ''} de ${row['name']} (riesgo ${tm.riskLevel})?${tm.riskLevel === 'ALTO' ? ' El riesgo ALTO requiere además el visto bueno del Director General, fuera del alcance del app.' : ''}`,
      okText: 'Autorizar como Jefe de Base',
    });
    if (!ok) return;

    const aprobador = jefeBase;
    const autorizado: TravelManagement = { ...tm, approverName: aprobador, approverSignature: aprobador };
    const pendMap = retorno ? this.returnTravelPendingManagements : this.travelPendingManagements;
    const doneMap = retorno ? this.returnTravelManagements : this.travelManagements;
    pendMap.update(m => {
      const u = new Map(m);
      u.delete(id);
      return u;
    });
    doneMap.update(m => {
      const u = new Map(m);
      u.set(id, autorizado);
      return u;
    });
    this.travelPendingApproval.update(set => {
      const u = new Set(set);
      u.delete(id);
      return u;
    });
    this.returnTravelPendingApproval.update(set => {
      const u = new Set(set);
      u.delete(id);
      return u;
    });
    this.guardarGerenciamientosEnTicket();
    this.notify.success('Gerenciamiento autorizado', `El Jefe de Base autorizó el gerenciamiento de viaje${retorno ? ' de retorno' : ''} de ${row['name']}.`);
  }

  protected hasTravelManagement(row: Record<string, unknown>): boolean {
    return this.travelManagements().has(row['id'] as number);
  }

  protected isTravelPendingApproval(row: Record<string, unknown>): boolean {
    return this.travelPendingApproval().has(row['id'] as number);
  }

  /**
   * Orden final confirmado con el cliente: el Supervisor primero revisa y
   * aprueba la inspección + reporte de unidad de cada operador; recién una
   * vez aprobado crea el Gerenciamiento de Viaje de salida (ver
   * reviewSalidaActionsTpl) — por eso solo cuenta el Gerenciamiento de los
   * operadores ya aprobados, no de todos los del ticket.
   */
  protected readonly allTravelManagementsCompleted = computed(() => {
    const rows = this.reviewSalidaRows();
    const approved = this.approvedSalidaOperators();
    const travels = this.travelManagements();
    if (rows.length === 0) return false;
    return rows.every(r => approved.has(r.id) && travels.has(r.id));
  });

  /**
   * Abre el dialog de Gerenciamiento de Viaje (DYN-SGI-RE-049) — último
   * paso por operador, solo disponible una vez aprobado su reporte de
   * unidad (ver reviewSalidaActionsTpl).
   * Según los puntos:
   * - BAJO: el supervisor directo aprueba (se completa inmediatamente)
   * - MEDIO/ALTO: requiere aprobación del Jefe de Base (queda pendiente)
   */
  protected openTravelManagement(row: Record<string, unknown>): void {
    const t = this.ticket();
    if (!t) return;
    const operatorId = row['id'] as number;

    const travelRef = this.dialog.open<TravelManagementDialog, TravelManagementDialogData>({
      title: 'Gerenciamiento de Viaje — DYN-SGI-RE-049',
      content: TravelManagementDialog,
      data: {
        operatorName: row['name'] as string,
        unitCode: row['unitCode'] as string,
        ticketCode: t.code,
        origen: t.unitReport?.origin ?? '',
        destino: t.unitReport?.destination ?? '',
        lineaServicio: PUMPING_SERVICE_TYPE_LABELS[t.serviceType],
        supervisor: t.assignedSupervisor ?? '',
        jefeBase: this.jefeBaseNombre(),
        conductor: this.conductorDeOperador(operatorId),
        conductores: row['name'] as string,
        placas: '',
      },
      size: 'large',
      footer: false,
    });

    travelRef.afterClose.subscribe((travelResult: TravelManagementDialogResult | undefined) => {
      if (!travelResult?.completed || !travelResult.travelManagement) return;

      const tm = travelResult.travelManagement;

      // BAJO: el supervisor directo lo cierra, sin pasar por el Jefe de
      // Base (antes quedaba pendiente igual sin importar el riesgo — el
      // comentario ya decía esto pero el código no lo aplicaba).
      if (tm.riskLevel === 'BAJO') {
        this.travelManagements.update(map => {
          const updated = new Map(map);
          updated.set(operatorId, tm);
          return updated;
        });
        this.guardarGerenciamientosEnTicket();
        this.notify.success('Gerenciamiento de viaje guardado', `Riesgo BAJO — cerrado directamente por el Supervisor.`);
        return;
      }

      // MEDIO/ALTO: queda pendiente hasta que el Jefe de Base lo autorice
      // desde la tabla de personal ("Autorizar gerenciamiento").
      this.travelPendingManagements.update(map => {
        const updated = new Map(map);
        updated.set(operatorId, tm);
        return updated;
      });
      this.travelPendingApproval.update(set => {
        const updated = new Set(set);
        updated.add(operatorId);
        return updated;
      });
      this.notify.info(
        'Enviado al Jefe de Base',
        `Gerenciamiento de viaje de ${row['name']} (riesgo ${tm.riskLevel}) — pendiente de autorización del Jefe de Base.`,
      );
    });
  }

  protected readonly allSalidaApproved = computed(() => {
    const rows = this.reviewSalidaRows();
    const approved = this.approvedSalidaOperators();
    return rows.length > 0 && rows.every(r => approved.has(r.id));
  });

  // ══════════════════════════════════════════════
  // Supervisor: Revisar reportes de llegada (sin inspección)
  // ══════════════════════════════════════════════

  protected readonly reviewLlegadaColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Operador' },
    { key: 'role', header: 'Cargo/Rol' },
    { key: 'unitCode', header: 'Unidad asignada' },
    { key: 'reportStatus', header: 'Reporte de Unidad (DYN-MNT-RE-012)', type: 'badge' },
  ];

  protected readonly reviewLlegadaRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const rejected = this.rejectedLlegadaOperators();
    const approved = this.approvedLlegadaOperators();
    return t.operators.map(op => ({
      id: op.id,
      name: op.name,
      role: op.role,
      unitCode: op.unitCode,
      reportStatus: rejected.has(op.id)
        ? { text: 'Rechazado', tone: 'error' as const }
        : approved.has(op.id)
          ? { text: 'Aprobado', tone: 'success' as const }
          : { text: 'Completado', tone: 'success' as const },
    }));
  });

  // Trackeo de aprobaciones por operador para llegada
  protected readonly approvedLlegadaOperators = signal<Set<number>>(new Set());
  protected readonly rejectedLlegadaOperators = signal<Set<number>>(new Set());
  protected readonly rejectionReasons = signal<Map<number, string>>(new Map());

  protected isOperatorLlegadaApproved(row: Record<string, unknown>): boolean {
    return this.approvedLlegadaOperators().has(row['id'] as number);
  }

  protected isOperatorLlegadaRejected(row: Record<string, unknown>): boolean {
    return this.rejectedLlegadaOperators().has(row['id'] as number);
  }

  protected viewRejectionReason(row: Record<string, unknown>): void {
    const id = row['id'] as number;
    const reason = this.rejectionReasons().get(id) || 'Sin motivo especificado.';
    this.notify.error(`Motivo de rechazo — ${row['name']}`, reason);
  }

  protected canReviewLlegada(row: Record<string, unknown>): boolean {
    const report = row['reportStatus'] as { text: string };
    return report.text === 'Completado';
  }

  protected approveLlegadaOperator(row: Record<string, unknown>): void {
    const t = this.ticket();
    if (!t?.unitReport) {
      this.notify.error('Sin reporte', 'No hay reporte de unidad disponible para revisar.');
      return;
    }

    const ref = this.dialog.open<ReviewArrivalReportDialog, ReviewArrivalReportDialogData>({
      title: 'Revisar reporte de llegada',
      content: ReviewArrivalReportDialog,
      data: {
        operatorName: row['name'] as string,
        unitCode: row['unitCode'] as string,
        report: t.unitReport,
      },
      size: 'large',
      footer: false,
    });

    ref.afterClose.subscribe((result: ReviewArrivalReportDialogResult | undefined) => {
      if (!result) return;

      const id = row['id'] as number;
      if (result.approved) {
        this.approvedLlegadaOperators.update(set => {
          const updated = new Set(set);
          updated.add(id);
          return updated;
        });
        this.notify.success('Aprobado', `Reporte de llegada de ${row['name']} aprobado.`);
      } else {
        this.rejectedLlegadaOperators.update(set => {
          const updated = new Set(set);
          updated.add(id);
          return updated;
        });
        this.rejectionReasons.update(map => {
          const updated = new Map(map);
          updated.set(id, result.rejectionReason ?? '');
          return updated;
        });
        this.notify.error('Rechazado', `Reporte de ${row['name']} rechazado.`);
      }
    });
  }

  protected readonly allLlegadaApproved = computed(() => {
    const rows = this.reviewLlegadaRows();
    const approved = this.approvedLlegadaOperators();
    return rows.length > 0 && rows.every(r => approved.has(r.id));
  });

  // ── Gerenciamiento de Viaje de Retorno (DYN-SGI-RE-049) ──

  protected readonly returnTravelManagements = signal<Map<number, TravelManagement>>(new Map());
  protected readonly returnTravelPendingApproval = signal<Set<number>>(new Set());

  protected hasReturnTravelManagement(row: Record<string, unknown>): boolean {
    return this.returnTravelManagements().has(row['id'] as number);
  }

  protected isReturnTravelPendingApproval(row: Record<string, unknown>): boolean {
    return this.returnTravelPendingApproval().has(row['id'] as number);
  }

  /**
   * Orden final confirmado con el cliente: para la llegada el Gerenciamiento
   * de Viaje va PRIMERO — antes de que el operador pueda siquiera crear la
   * inspección y el reporte de unidad de llegada (paso `control_retorno`,
   * ver advanceFromGerenciamientoLlegada). Por eso se basa en personnelRows
   * (la asignación del ticket) y no en reviewLlegadaRows, que depende de un
   * reporte que en este punto todavía no existe.
   */
  protected readonly allReturnTravelManagementsCompleted = computed(() => {
    const rows = this.personnelRows();
    const travels = this.returnTravelManagements();
    if (rows.length === 0) return false;
    return rows.every(r => travels.has(r.id));
  });

  protected openReturnTravelManagement(row: Record<string, unknown>): void {
    const t = this.ticket();
    if (!t) return;
    const operatorId = row['id'] as number;
    /** El gerenciamiento de ida de este mismo operador — motivo/plan y ruta se precargan desde ahí, editables. */
    const gerenciamientoIda = this.travelManagements().get(operatorId);

    const travelRef = this.dialog.open<TravelManagementDialog, TravelManagementDialogData>({
      title: 'Gerenciamiento de Viaje de Retorno — DYN-SGI-RE-049',
      content: TravelManagementDialog,
      data: {
        operatorName: row['name'] as string,
        unitCode: row['unitCode'] as string,
        ticketCode: t.code,
        origen: t.unitReport?.destination ?? '',
        destino: t.unitReport?.origin ?? '',
        lineaServicio: PUMPING_SERVICE_TYPE_LABELS[t.serviceType],
        supervisor: t.assignedSupervisor ?? '',
        jefeBase: this.jefeBaseNombre(),
        conductor: this.conductorDeOperador(operatorId, true),
        conductores: row['name'] as string,
        placas: '',
        previousTravelManagement: gerenciamientoIda,
      },
      size: 'large',
      footer: false,
    });

    travelRef.afterClose.subscribe((travelResult: TravelManagementDialogResult | undefined) => {
      if (!travelResult?.completed || !travelResult.travelManagement) return;

      const tm = travelResult.travelManagement;

      // Mismo criterio que el gerenciamiento de ida: BAJO lo cierra el
      // supervisor directo, sin pasar por el Jefe de Base.
      if (tm.riskLevel === 'BAJO') {
        this.returnTravelManagements.update(map => {
          const updated = new Map(map);
          updated.set(operatorId, tm);
          return updated;
        });
        this.guardarGerenciamientosEnTicket();
        this.notify.success('Gerenciamiento de retorno guardado', `Riesgo BAJO — cerrado directamente por el Supervisor.`);
        return;
      }

      this.returnTravelPendingManagements.update(map => {
        const updated = new Map(map);
        updated.set(operatorId, tm);
        return updated;
      });
      this.returnTravelPendingApproval.update(set => {
        const updated = new Set(set);
        updated.add(operatorId);
        return updated;
      });
      this.notify.info(
        'Enviado al Jefe de Base',
        `Gerenciamiento de retorno de ${row['name']} (riesgo ${tm.riskLevel}) — pendiente de autorización del Jefe de Base.`,
      );
    });
  }

  protected approveAllSalidaReports(): void {
    const t = this.ticket();
    if (!t) return;
    if (this.bloqueadoPorSwa()) return;
    if (!this.coberturaOk()) {
      this.notify.error(
        'Matriz IPERC incompleta',
        `El servicio no puede pasar a ejecución: HSE tiene pendiente aprobar ${this.actividadesPendientes()
          .map(a => a.nombre)
          .join(', ')} en la matriz maestra.`,
      );
      return;
    }
    if (!this.ptwFirmadoOk()) {
      const p = this.ptwVinculo();
      this.notify.error(
        'PTW pendiente',
        p
          ? `El servicio no puede pasar a ejecución en campo: el PTW ${p.code} está en ${this.ptwFaseLabel(
              p.fase,
            )} — falta la firma en sitio (HSE-SITIO-001).`
          : 'El servicio no puede pasar a ejecución en campo: todavía no se abrió el PTW/Recibimiento de Sitio en QHSE.',
      );
      return;
    }
    this.submitting.set(true);
    const nextStep: PumpingStep = 'ejecucion_operativa';
    this.pumpingService.advanceStep(t.id, nextStep).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        const nextRole = PUMPING_STEP_ROLE[nextStep];
        this.auth.switchRole(nextRole.roleName, nextRole.roleId);
        this.notify.success('Aprobado', `Reportes de salida aprobados. Ahora actúa como ${nextRole.roleName}.`);
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo avanzar el ticket.');
      },
    });
  }

  protected approveAllLlegadaReports(): void {
    const t = this.ticket();
    if (!t) return;
    if (this.bloqueadoPorSwa()) return;
    this.submitting.set(true);
    const nextStep: PumpingStep = 'revision_final';
    this.pumpingService.advanceStep(t.id, nextStep).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        const nextRole = PUMPING_STEP_ROLE[nextStep];
        this.auth.switchRole(nextRole.roleName, nextRole.roleId);
        this.notify.success('Aprobado', `Reportes de llegada aprobados. Ahora actúa como ${nextRole.roleName}.`);
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo avanzar el ticket.');
      },
    });
  }

  // ══════════════════════════════════════════════
  // Ejecución operativa — Reporte diario DYN-SGI-RE-047
  // ══════════════════════════════════════════════

  protected readonly dailyActivityReports = signal<Map<string, DailyActivityReport>>(new Map());

  protected readonly dailyReportDayColumns: DynadrillDataTableColumn[] = [
    { key: 'dia', header: 'Día' },
    { key: 'fecha', header: 'Fecha' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ];

  /**
   * Un solo reporte diario (el de hoy) — a pedido del cliente: llenar un
   * reporte por cada día del servicio hacía el flujo demasiado lento para
   * avanzar en la demo. Si más adelante se quiere el historial completo,
   * volver a iterar desde `unitReport.departureDate`.
   */
  protected readonly dailyReportDayRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const reports = this.dailyActivityReports();
    const dateStr = toLocalDateString(new Date());
    return [{
      id: 1,
      dia: 'Día 1',
      fecha: dateStr,
      statusBadge: reports.has(dateStr)
        ? { text: 'Completado', tone: 'success' as const }
        : { text: 'Pendiente', tone: 'warning' as const },
    }];
  });

  protected isDailyReportCompleted(row: Record<string, unknown>): boolean {
    return this.dailyActivityReports().has(row['fecha'] as string);
  }

  protected readonly allDailyReportsCompleted = computed(() => {
    const rows = this.dailyReportDayRows();
    if (rows.length === 0) return false;
    const reports = this.dailyActivityReports();
    return rows.every(r => reports.has(r.fecha));
  });

  /** Puente Pumping → Facturación: al guardar un reporte diario, se empuja al Pedido vinculado. */
  private enviarReporteJobAFacturacion(report: DailyActivityReport): void {
    const t = this.ticket();
    if (!t?.pedidoCode) return;
    const actividades = report.actividades
      .filter(a => a.detalle.trim())
      .map((a, i) => ({
        id: i + 1,
        date: report.fecha,
        startTime: a.inicio,
        endTime: a.fin,
        durationHours: a.horas ?? 0,
        detail: a.detalle,
        author: report.nombreSupervisor || t.assignedSupervisor,
      }));
    if (!actividades.length) return;
    this.docsBridge.pushReporteJob({
      pedidoCode: t.pedidoCode,
      origen: 'pumping',
      ticketOperativoId: t.id,
      fecha: report.fecha,
      firmadoPor: report.nombreSupervisor || t.assignedSupervisor,
      header: { code: t.code, cliente: t.clientName, pozo: t.wellName, supervisor: t.assignedSupervisor, operador: t.assignedOperator },
      actividades,
    });
    this.notify.info('Enviado a Facturación', `Reporte Job del ${report.fecha} vinculado al Pedido ${t.pedidoCode}.`);
  }

  protected openDailyActivityReportForDay(row: Record<string, unknown>): void {
    const t = this.ticket();
    if (!t) return;
    const fecha = row['fecha'] as string;

    const ref = this.dialog.open<DailyActivityReportDialog, DailyActivityReportDialogData>({
      title: `Reporte diario — ${row['dia']} (${fecha})`,
      content: DailyActivityReportDialog,
      data: {
        ticketCode: t.code,
        ticketId: t.id,
        fechaClave: fecha,
        cliente: t.clientName,
        pozo: t.wellName,
        campoBloque: t.unitReport?.blockName ?? '',
        supervisor: t.assignedSupervisor ?? '',
        numeroContrato: t.numeroContrato,
        taladro: t.taladroRig,
        taladroId: t.taladroId,
        // Representante del cliente ya se definió en el Pedido (Company Man / Representante de Campo) — no hace falta re-tipearlo acá.
        representanteCliente: this.pedido()?.representanteCampo,
        existing: undefined,
      },
      size: 'large',
      footer: false,
    });

    ref.afterClose.subscribe((result: DailyActivityReportDialogResult | undefined) => {
      if (result?.saved && result.report) {
        const report = { ...result.report, fecha };
        this.dailyActivityReports.update(map => {
          const updated = new Map(map);
          updated.set(fecha, report);
          return updated;
        });
        this.notify.success('Reporte guardado', `Reporte del ${fecha} guardado correctamente.`);
        this.enviarReporteJobAFacturacion(report);
      }
    });
  }

  // ── Cierre de químicos — consumo real y devolución de sobrante a bodega ──

  protected readonly chemicalConsumptionInputs = signal<Map<number, string>>(new Map());

  protected chemicalConsumptionInput(chemicalId: number): string {
    return this.chemicalConsumptionInputs().get(chemicalId) ?? '';
  }

  protected onChemicalConsumptionInputChange(chemicalId: number, value: string): void {
    this.chemicalConsumptionInputs.update(map => {
      const updated = new Map(map);
      updated.set(chemicalId, value);
      return updated;
    });
  }

  protected chemicalConsumptionValid(chemical: PumpingChemical): boolean {
    const raw = this.chemicalConsumptionInput(chemical.id);
    if (raw.trim() === '') return false;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= chemical.quantityAssigned;
  }

  /** Sobrante en vivo, mientras el Supervisor escribe la cantidad usada (antes de guardar). */
  protected chemicalConsumptionPreviewSobrante(chemical: PumpingChemical): number | null {
    const raw = this.chemicalConsumptionInput(chemical.id);
    if (raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(chemical.quantityAssigned - n, 0);
  }

  protected readonly allChemicalsClosed = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    return t.chemicals.every(c => c.consumptionRegistered);
  });

  /**
   * Registra el consumo real de un químico. Si queda sobrante, se devuelve
   * a bodega automáticamente (entrada real en el kardex de Inventario, a
   * cargo del Bodeguero) — sin esto el "sobrante" quedaría solo anotado en
   * Pumping sin reflejarse nunca en el stock que Bodeguero administra.
   */
  protected registerChemicalConsumption(chemical: PumpingChemical): void {
    const t = this.ticket();
    if (!t || !this.chemicalConsumptionValid(chemical)) return;
    const quantityUsed = Number(this.chemicalConsumptionInput(chemical.id));

    this.pumpingService.registerChemicalConsumption(t.id, chemical.id, quantityUsed).subscribe({
      next: updated => {
        this.ticket.set(updated);
        const sobrante = chemical.quantityAssigned - quantityUsed;
        if (sobrante <= 0) {
          this.notify.success('Consumo registrado', `${chemical.name}: sin sobrante que devolver a bodega.`);
          return;
        }
        this.returnChemicalToWarehouse(t, chemical, sobrante);
      },
      error: () => this.notify.error('Error', `No se pudo registrar el consumo de ${chemical.name}.`),
    });
  }

  private returnChemicalToWarehouse(t: PumpingTicket, chemical: PumpingChemical, sobrante: number): void {
    const responsable = this.auth.currentUser()?.name ?? t.assignedSupervisor ?? 'Supervisor';
    this.movimientosInventarioService.registrar({
      articuloId: chemical.articuloId,
      tipo: 'entrada',
      cantidad: sobrante,
      fecha: new Date().toISOString().slice(0, 10),
      motivo: `Devolución de sobrante — Ticket ${t.code}`,
      responsable,
    }).subscribe({
      next: () => this.notify.success('Sobrante devuelto a bodega', `${chemical.name}: ${sobrante} ${chemical.unit} devueltos y registrados en Inventario.`),
      error: () => this.notify.error('Error', `El consumo de ${chemical.name} se guardó, pero no se pudo registrar la devolución a bodega.`),
    });
  }

  protected advanceFromEjecucionOperativa(): void {
    const t = this.ticket();
    if (!t) return;
    if (this.bloqueadoPorSwa()) return;
    this.submitting.set(true);
    const nextStep: PumpingStep = 'control_retorno';
    this.pumpingService.advanceStep(t.id, nextStep).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        const nextRole = PUMPING_STEP_ROLE[nextStep];
        this.auth.switchRole(nextRole.roleName, nextRole.roleId);
        this.notify.success('Avanzado', `El ticket avanza a Gerenciamiento de llegada. Ahora actúa como ${nextRole.roleName}.`);
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo avanzar el ticket.');
      },
    });
  }

  /**
   * Orden final confirmado con el cliente: el Gerenciamiento de Viaje de
   * llegada lo crea el Supervisor ANTES de que el operador pueda crear la
   * inspección y el reporte de unidad de llegada — ver
   * allReturnTravelManagementsCompleted/openReturnTravelManagement más
   * arriba, gated en el paso `control_retorno`.
   */
  protected advanceFromGerenciamientoLlegada(): void {
    const t = this.ticket();
    if (!t) return;
    if (this.bloqueadoPorSwa()) return;
    this.submitting.set(true);
    const nextStep: PumpingStep = 'traslado_llegada';
    this.pumpingService.advanceStep(t.id, nextStep).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        const nextRole = PUMPING_STEP_ROLE[nextStep];
        this.auth.switchRole(nextRole.roleName, nextRole.roleId);
        this.notify.success('Avanzado', `El ticket avanza a En ejecución (Llegada). Ahora actúa como ${nextRole.roleName}.`);
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo avanzar el ticket.');
      },
    });
  }

  // ══════════════════════════════════════════════
  // PASO 3: Ejecución — Reporte de Unidad DYN-MNT-RE-012
  // ══════════════════════════════════════════════

  protected readonly personnelColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Operador' },
    { key: 'role', header: 'Cargo/Rol' },
    { key: 'unitCode', header: 'Unidad asignada' },
  ];

  protected readonly isOperador = computed(() => this.roleName() === 'Operador');
  protected readonly isSupervisor = computed(() => this.roleName() === 'Supervisor' || this.roleName() === 'Supervisor Pumping');

  protected readonly personnelRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return t.operators.map(op => ({
      id: op.id,
      name: op.name,
      role: op.role,
      unitCode: op.unitCode,
    }));
  });

  // Trackeo de inspecciones realizadas por operador (id -> VehicleInspection)
  protected readonly completedInspections = signal<Map<number, unknown>>(new Map());

  protected hasCompletedInspection(row: Record<string, unknown>): boolean {
    return this.completedInspections().has(row['id'] as number);
  }

  /** Inspecciones de llegada realizadas por operador (id -> VehicleInspection) */
  protected readonly completedLlegadaInspections = signal<Map<number, unknown>>(new Map());

  protected hasCompletedLlegadaInspection(row: Record<string, unknown>): boolean {
    return this.completedLlegadaInspections().has(row['id'] as number);
  }

  /** Verifica si todos los operadores de la tabla tienen inspección de salida realizada */
  protected readonly allInspectionsCompleted = computed(() => {
    const rows = this.personnelRows();
    const completed = this.completedInspections();
    if (rows.length === 0) return false;
    return rows.every(r => completed.has(r.id));
  });

  /** Verifica si todos los operadores tienen inspección de llegada realizada */
  protected readonly allLlegadaInspectionsCompleted = computed(() => {
    const rows = this.personnelRows();
    const completed = this.completedLlegadaInspections();
    if (rows.length === 0) return false;
    return rows.every(r => completed.has(r.id));
  });

  // Información general del reporte
  //
  // Pozo / Base(campo) / Bloque ya no se tipean: salen del catálogo de
  // ubicaciones vía <app-ubicacion-selector>. Se siguen guardando como
  // strings en el payload (wellName/baseName/blockName) para no romper el
  // contrato del reporte, y además se conservan los ids para trazabilidad.
  protected readonly reportWellName = signal('');
  protected readonly reportBaseName = signal('');
  protected readonly reportBlockName = signal('');
  protected readonly reportPozoId = signal<number | null>(null);
  protected readonly reportCampoId = signal<number | null>(null);
  protected readonly reportBloqueId = signal<number | null>(null);

  /**
   * Semilla del selector: el pozo que ya trae el ticket (heredado del
   * pedido). Depende sólo de `ticket()` — nunca de las señales que escribe
   * `onUbicacionChange`, para que no se realimente.
   */
  protected readonly ubicacionInicial = computed<Partial<UbicacionSeleccion> | null>(() => {
    const t = this.ticket();
    // Prioriza el id real del catálogo (heredado del Pedido al crear el
    // ticket) — el texto (wellName) queda de respaldo para tickets viejos
    // creados antes de que el ticket guardara el id.
    return t?.pozoId ? { pozoId: t.pozoId } : t?.wellName ? { pozo: t.wellName } : null;
  });

  protected onUbicacionChange(u: UbicacionSeleccion): void {
    this.reportWellName.set(u.nombreCompletoPozo || u.pozo);
    this.reportBaseName.set(u.campo);
    this.reportBlockName.set(u.bloque);
    this.reportPozoId.set(u.pozoId);
    this.reportCampoId.set(u.campoId);
    this.reportBloqueId.set(u.bloqueId);
  }
  protected readonly reportHeaderCode = signal('');
  protected readonly reportClientName = signal('');
  protected readonly reportUnitCode = signal('');
  // dynadrill-datetime-picker trabaja con Date, no con el string ISO que guarda
  // PumpingUnitReport — se convierte en los límites (initFromTicket / saveUnitReport).
  // Arrancan en hoy (editable) — initFromTicket las pisa si ya existe un reporte guardado con su propia fecha.
  protected readonly reportDepartureDate = signal<Date | null>(new Date());
  protected readonly reportArrivalDate = signal<Date | null>(new Date());
  protected readonly reportFuelDeparture = signal('');
  protected readonly reportFuelArrival = signal('');
  protected readonly reportOrigin = signal('');
  protected readonly reportDestination = signal('');

  // Neumáticos (máximo 4 llantas: delantera/trasera x izq/der)
  protected readonly tires = signal<TireEntry[]>(createDefaultTires());

  protected updateTire(index: number, field: 'salida' | 'llegada', value: string): void {
    this.tires.update(tires =>
      tires.map((t, i) => i === index ? { ...t, [field]: value } : t),
    );
  }

  /**
   * Hubodómetro: dispositivo montado por eje (no es el odómetro general del
   * vehículo) — se lee por eje en dos puntos del trayecto: Origen y Destino.
   */
  protected readonly hubodometroOrigen = signal<HubodometroEntry[]>(createDefaultHubodometro());
  protected readonly hubodometroDestino = signal<HubodometroEntry[]>(createDefaultHubodometro());

  protected updateHubodometro(point: 'origen' | 'destino', axleIndex: number, field: 'salida' | 'llegada', value: string): void {
    const target = point === 'origen' ? this.hubodometroOrigen : this.hubodometroDestino;
    target.update(entries =>
      entries.map((h, i) => i === axleIndex ? { ...h, [field]: value ? Number(value) : null } : h),
    );
  }

  /**
   * Agrega un eje más — Origen y Destino siempre tienen el mismo número de
   * ejes (espejo), así que se agregan juntos aquí. Solo se hace en Salida;
   * Llegada reutiliza el mismo conjunto ya definido (initFromTicket).
   */
  protected addHubodometroAxle(): void {
    const label = nextHubodometroAxleLabel(this.hubodometroOrigen());
    const entry: HubodometroEntry = { label, salida: null, llegada: null };
    this.hubodometroOrigen.update(entries => [...entries, entry]);
    this.hubodometroDestino.update(entries => [...entries, { ...entry }]);
  }

  /** Quita un eje (mínimo 1) — se relabelan A, B, C... para que no queden huecos. */
  protected removeHubodometroAxle(axleIndex: number): void {
    if (this.hubodometroOrigen().length <= 1) return;
    const relabel = (entries: HubodometroEntry[]): HubodometroEntry[] =>
      entries.filter((_, i) => i !== axleIndex).map((e, i) => ({ ...e, label: String.fromCharCode(65 + i) }));
    this.hubodometroOrigen.update(relabel);
    this.hubodometroDestino.update(relabel);
  }

  // Secciones de inspección
  protected readonly chassisItems = signal<DynadrillInspectionItem[]>(createChassisInspectionItems());
  protected readonly motorItems = signal<DynadrillInspectionItem[]>(createMotorInspectionItems());
  protected readonly arrivalEquipmentItems = signal<DynadrillInspectionItem[]>(createArrivalEquipmentItems());
  protected readonly instrumentationItems = signal<DynadrillInspectionItem[]>(createInstrumentationItems());

  // Novedades
  protected readonly noveltiesMecanica = signal('');
  protected readonly noveltiesInstrumentacion = signal('');
  protected readonly noveltiesOperaciones = signal('');
  /** Oculta las 3 textareas de novedades hasta que el operador confirme que hay algo que reportar — la mayoría de los días no hay. */
  protected readonly hayNovedades = signal(false);

  protected onHayNovedadesChange(hay: boolean): void {
    this.hayNovedades.set(hay);
    if (!hay) {
      this.noveltiesMecanica.set('');
      this.noveltiesInstrumentacion.set('');
      this.noveltiesOperaciones.set('');
    }
  }

  // Operatividad
  protected readonly unitReadyOptions = ['Sí', 'No'];
  protected readonly unitReadySelection = signal<string[]>([]);
  protected readonly operationInterruptedOptions = ['Sí', 'No'];
  protected readonly operationInterruptedSelection = signal<string[]>([]);
  protected readonly interruptionDetail = signal('');

  /** Las dos preguntas de operatividad deben quedar contestadas (Sí/No) antes de poder enviar el reporte de unidad. */
  protected readonly operatividadCompleta = computed(
    () => this.unitReadySelection().length > 0 && this.operationInterruptedSelection().length > 0,
  );

  // Firmas (automáticas desde operador asignado)
  protected readonly departureOperatorName = signal('');
  protected readonly arrivalOperatorName = signal('');
  protected readonly departureApprovalDate = signal('');
  protected readonly arrivalApprovalDate = signal('');

  protected readonly departureSignatureName = computed(() => {
    const t = this.ticket();
    if (t?.operators?.length) return t.operators[0].name;
    return this.departureOperatorName() || '—';
  });

  protected readonly departureSignatureDate = computed(() => {
    if (this.departureApprovalDate()) return this.departureApprovalDate();
    if (this.reportDepartureDate()) return toIsoDateString(this.reportDepartureDate());
    return toIsoDateString(new Date());
  });

  protected readonly arrivalSignatureName = computed(() => {
    const t = this.ticket();
    if (t?.operators?.length) return t.operators[t.operators.length > 1 ? 1 : 0].name;
    return this.arrivalOperatorName() || '—';
  });

  protected readonly arrivalSignatureDate = computed(() => {
    if (this.arrivalApprovalDate()) return this.arrivalApprovalDate();
    if (this.reportArrivalDate()) return toIsoDateString(this.reportArrivalDate());
    return toIsoDateString(new Date());
  });

  // Datos de salida en solo lectura para la vista de llegada
  protected readonly arrivalGeneralInfoItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Pozo', value: this.reportWellName() || '—' },
    { label: 'Base', value: this.reportBaseName() || '—' },
    { label: 'Bloque', value: this.reportBlockName() || '—' },
    { label: 'Cabezal', value: this.reportHeaderCode() || '—' },
    { label: 'Cliente', value: this.reportClientName() || '—' },
    { label: 'Unidad', value: this.reportUnitCode() || '—' },
  ]);

  protected readonly arrivalFuelReadonlyItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Fecha de salida', value: toIsoDateString(this.reportDepartureDate()) || '—' },
    { label: 'Combustible salida', value: this.reportFuelDeparture() || '—' },
  ]);

  // ══════════════════════════════════════════════
  // PASO 4: Revisión — resumen + aprobación
  // ══════════════════════════════════════════════

  protected readonly decision = signal<DynadrillApprovalDecision>(null);

  protected readonly chemicalColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Químico' },
    { key: 'quantityAssigned', header: 'Asignado' },
    { key: 'quantityUsed', header: 'Usado' },
    { key: 'quantityReturned', header: 'Devuelto' },
    { key: 'unit', header: 'Unidad' },
  ];

  protected readonly chemicalRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return t.chemicals.map(c => ({
      id: c.id,
      name: c.name,
      quantityAssigned: c.quantityAssigned,
      quantityUsed: c.quantityUsed,
      quantityReturned: c.quantityReturned,
      unit: c.unit,
    }));
  });

  protected readonly reviewContextItems = computed<DynadrillContextCardItem[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      { label: 'Ticket', value: t.code },
      { label: 'Cliente', value: t.clientName },
      { label: 'Pozo', value: t.wellName },
      { label: 'Tipo de servicio', value: PUMPING_SERVICE_TYPE_LABELS[t.serviceType] },
      { label: 'Supervisor', value: t.assignedSupervisor || '—' },
      { label: 'Unidad', value: t.unitCode || '—' },
      { label: 'Reporte de unidad', value: t.unitReport ? 'Completado' : 'Pendiente' },
    ];
  });

  // ══════════════════════════════════════════════
  // Constructor
  // ══════════════════════════════════════════════

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.viewMode.set(this.route.snapshot.queryParamMap.get('mode') ?? '');
    this.pumpingService.getTicket(id).subscribe({
      next: ticket => {
        // Demo: un mismo usuario recorre todos los roles. Si el rol de la
        // sesión no es el que actúa el paso actual del ticket (p. ej. quedó
        // en "Jefe de Base" tras autorizar un gerenciamiento), se pasa a ese
        // rol en vez de bloquear el acceso.
        const expected = PUMPING_STEP_ROLE[ticket.currentStep];
        if (expected && !esRolResponsablePumping(expected.roleName, this.roleName())) {
          this.auth.switchRole(expected.roleName, expected.roleId);
        }
        this.ticket.set(ticket);
        this.loading.set(false);
        this.initFromTicket(ticket);
        this.loadMaintenanceOrders();
        if (ticket.pedidoId) {
          this.pedidoService.get(ticket.pedidoId).subscribe({
            next: p => {
              this.pedido.set(p);
              this.sincronizarQuimicosDelPedido();
              this.pedidoService.listarDocumentosAdjuntos(p.id).subscribe(docs => {
                this.documentosReferenciaPedido.set(docs);
                this.precargarDocumentoDeMezcla();
              });
            },
            error: () => this.pedido.set(null),
          });
        }
        this.reloadSolicitudPendiente(ticket.id);
      },
      error: () => this.loading.set(false),
    });
    this.loadChemicalArticulos();
    this.unidadesService.list().subscribe(us => {
      this.unidades.set(us);
      this.syncMockInspections();
    });
    this.rolesService.usuariosPorRol('jefe_base').subscribe(us => this.jefeBaseNombre.set(us[0]?.name ?? ''));
    this.vehicleInspectionsService.listConductoresPermisos().subscribe(cs => {
      this.conductoresPermisos.set(cs.map(c => c.nombre));
      this.syncMockInspections();
    });
    this.vehicleInspectionsService.list().subscribe(list => {
      this.realInspections.set(list);
      this.syncMockInspections();
    });

    afterRenderEffect(() => {
      this.currentStepIndex();
      const container = this.trackerScrollEl()?.nativeElement;
      const active = container?.querySelector<HTMLElement>('.ticket-detail__step--active');
      active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });

    // Si el ticket avanza de paso, la selección manual vieja del detalle ya no aplica.
    effect(() => {
      this.currentStepIndex();
      untracked(() => this.manualStepIndex.set(null));
    });
  }

  // ══════════════════════════════════════════════
  // Solicitud de cambio de ítems del pedido (Operador -> Supervisor)
  // ══════════════════════════════════════════════

  /**
   * "El operador dispone todo el tiempo de una opción para ... solicitar la
   * edición de los ítems del pedido" — botón permanente, visible en
   * cualquier paso. El Supervisor también puede editar los ítems desde acá
   * (mismo diálogo), pero su cambio se aplica directo, sin pasar por
   * aprobación (ver `abrirSolicitudCambioItems`).
   */
  protected readonly puedeSolicitarCambioItems = computed(
    () => (this.isOperador() || this.isSupervisor()) && !!this.ticket()?.pedidoId,
  );

  /** "El botón junto a Reportar para ver el pedido de Ventas... siempre que quieran" — visible a cualquier rol, en cualquier paso. */
  protected abrirVerPedido(): void {
    const p = this.pedido();
    if (!p) return;
    this.dialog.open<VerPedidoDialog, VerPedidoDialogData>({
      title: `Pedido ${p.code} — ${p.cliente}`,
      content: VerPedidoDialog,
      data: { pedido: p, onEditarItems: this.puedeSolicitarCambioItems() ? () => this.abrirSolicitudCambioItems() : undefined },
      footer: false,
      width: '760px',
    });
  }

  private reloadSolicitudPendiente(pumpingTicketId: number): void {
    this.solicitudCambioItemsService.porTicket(pumpingTicketId).subscribe({
      next: solicitudes => this.solicitudPendiente.set(solicitudes.find(s => s.estado === 'pendiente') ?? null),
      error: () => this.solicitudPendiente.set(null),
    });
  }

  protected abrirSolicitudCambioItems(): void {
    const t = this.ticket();
    const p = this.pedido();
    if (!t || !p) return;

    const aplicaInmediato = this.isSupervisor();
    const ref = this.dialog.open<SolicitarCambioItemsDialog, SolicitarCambioItemsDialogData>({
      title: 'Solicitar cambio de ítems del pedido',
      content: SolicitarCambioItemsDialog,
      data: { pedidoCode: p.code, cliente: p.cliente, itemsActuales: this.pedidoItems(), aplicaInmediato },
      footer: false,
      width: '820px',
    });

    ref.afterClose.subscribe((result?: SolicitarCambioItemsDialogResult) => {
      if (!result) return;
      const usuario = this.auth.currentUser()?.name ?? this.roleName();
      this.solicitudCambioItemsService
        .proponer({ pumpingTicketId: t.id, itemsPropuestos: result.itemsPropuestos, motivo: result.motivo, solicitadoPor: usuario })
        .subscribe({
          next: solicitud => {
            if (!aplicaInmediato) {
              this.solicitudPendiente.set(solicitud);
              this.notify.success('Solicitud enviada', 'Tu Supervisor debe aprobarla para que se actualice el pedido.');
              return;
            }
            // Supervisor: mismo endpoint de aprobación que usa `aprobaciones-page.ts`,
            // pero autoaplicado acá mismo — su propio cambio no necesita pasar por
            // otro Supervisor. Reusa 100% la lógica de aplicación del backend
            // (sobreescribe Pedido.itemsEstimados y recalcula la prefactura si aplica).
            this.solicitudCambioItemsService.aprobar(solicitud.id, usuario).subscribe({
              next: () => {
                this.solicitudPendiente.set(null);
                this.pedidoService.get(p.id).subscribe(actualizado => this.pedido.set(actualizado));
                this.notify.success('Pedido actualizado', `Los ítems de ${p.code} quedaron actualizados.`);
              },
              error: err => this.notify.error('Error', err?.error?.message ?? 'No se pudo actualizar el pedido. Probá de nuevo.'),
            });
          },
          error: err =>
            this.notify.error('Error', err?.error?.message ?? 'No se pudo enviar la solicitud. Probá de nuevo.'),
        });
    });
  }

  // ══════════════════════════════════════════════
  // Mantenimientos asociados a la unidad del ticket
  // ══════════════════════════════════════════════

  private loadMaintenanceOrders(): void {
    this.maintenanceOrdersService.list().subscribe({
      next: orders => {
        this.maintenanceOrders.set(orders);
        this.maintenanceOrdersLoading.set(false);
      },
      error: () => this.maintenanceOrdersLoading.set(false),
    });
    this.unitReportsService.list().subscribe({
      next: reports => this.unitReports.set(reports),
    });
  }

  /** Novedad original (Reporte de Unidad) detrás de una sub-orden Operativo — mismo dato que ya usa reviewOperativoMaintenance(), acá para mostrarlo inline en la lista sin abrir el diálogo. */
  protected novedadOperativaDe(sub: SubOrder): string {
    const order = this.maintenanceOrders().find(o => o.subOrders.some(s => s.id === sub.id));
    const report = order ? this.unitReports().find(r => r.id === order.unitReportId) : undefined;
    return report?.problemasOperaciones || '';
  }

  /** Texto resumen de mantenimientos para una unidad: "Mecánico — En Ejecución, Operativo — Pendiente" */
  protected maintenanceStatusForUnit(unitCode: string): string {
    const orders = this.maintenanceOrders().filter(o => o.unidad === unitCode);
    if (orders.length === 0) return 'Sin mantenimientos';
    const lines = orders.flatMap(o =>
      o.subOrders.map(sub => `${sub.type} — ${sub.status}`),
    );
    return lines.join('\n');
  }

  /** Sub-órdenes Operativo de la unidad del ticket (las únicas que revisa el Supervisor de Pumping acá). */
  protected readonly operativoSubOrders = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return this.maintenanceOrders()
      .filter(o => o.unidad === t.unitCode)
      .flatMap(o => o.subOrders.filter(s => s.type === 'Operativo'));
  });

  /**
   * TODAS las sub-órdenes de la unidad (Mecánico/Instrumental/Operativo) —
   * antes el paso "Mantenimiento" solo mostraba el detalle (diagnóstico,
   * actividades, nota) de las Operativo; las de Mecánico/Instrumental solo
   * aparecían mencionadas por código en el banner de advertencia, sin
   * ningún detalle, aunque también bloquean el avance (ver
   * `novedadesSinAtender`). El Supervisor no tenía forma de ver su avance
   * desde acá sin ir al módulo de Mantenimiento aparte.
   */
  protected readonly todasLasSubOrdenesDeLaUnidad = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return this.maintenanceOrders()
      .filter(o => o.unidad === t.unitCode)
      .flatMap(o => o.subOrders);
  });

  /** Todas las sub-órdenes Operativo de esta unidad están cerradas o no hay ninguna. */
  protected readonly allOperativoResolved = computed(() => {
    const subs = this.operativoSubOrders();
    if (subs.length === 0) return true;
    return subs.every(s => s.status === 'Cerrado');
  });

  /**
   * Todas las sub-órdenes (Mecánico/Instrumental/Operativo) de la unidad
   * están cerradas — antes solo se chequeaba Operativo acá; el backend ya
   * bloquea el PATCH de avance para las 3 (ver `PumpingDomainService.advance`),
   * esto solo evita el viaje redondo y explica por qué el botón está
   * deshabilitado.
   */
  protected readonly novedadesSinAtender = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return this.maintenanceOrders()
      .filter(o => o.unidad === t.unitCode)
      .flatMap(o => o.subOrders)
      .filter(s => s.status !== 'Cerrado');
  });
  protected readonly allNovedadesResolved = computed(
    () => !this.maintenanceOrdersLoading() && this.novedadesSinAtender().length === 0,
  );

  protected reviewOperativoMaintenance(sub: SubOrder): void {
    const order = this.maintenanceOrders().find(o => o.subOrders.some(s => s.id === sub.id));
    this.unitReportsService.list().subscribe(reports => {
      const report = order ? reports.find(r => r.id === order.unitReportId) : undefined;
      const novedadOriginal = report?.problemasOperaciones || '';
      const ref = this.dialog.open<SuborderReviewDialog, SuborderReviewDialogData>({
        title: 'Revisar mantenimiento operativo — ' + sub.code,
        content: SuborderReviewDialog,
        data: { subOrder: sub, novedadOriginal },
        footer: false,
      });
      ref.afterClose.subscribe(changed => {
        if (changed) this.loadMaintenanceOrders();
      });
    });
  }

  protected approveMaintenanceStep(): void {
    const t = this.ticket();
    if (!t) return;
    if (this.bloqueadoPorSwa()) return;
    this.submitting.set(true);
    const nextStep: PumpingStep = 'revision_reportes_llegada';
    this.pumpingService.advanceStep(t.id, nextStep).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        const nextRole = PUMPING_STEP_ROLE[nextStep];
        this.auth.switchRole(nextRole.roleName, nextRole.roleId);
        this.notify.success('Mantenimiento revisado', `Avanza a Revisar reportes de llegada. Ahora actúa como ${nextRole.roleName}.`);
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo avanzar el ticket.');
      },
    });
  }

  // ══════════════════════════════════════════════
  // Acciones
  // ══════════════════════════════════════════════

  protected saveSupervisor(): void {
    const supervisorId = this.selectedSupervisor();
    const t = this.ticket();
    if (!supervisorId || !t) return;
    if (this.bloqueadoPorSwa()) return;
    if (!this.coberturaOk()) {
      this.notify.error(
        'Matriz IPERC incompleta',
        `No se puede asignar ni notificar al Supervisor: HSE tiene pendiente aprobar ${this.actividadesPendientes()
          .map(a => a.nombre)
          .join(', ')} en la matriz maestra.`,
      );
      return;
    }
    this.submitting.set(true);
    this.pumpingService.assignSupervisor(t.id, supervisorId).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        this.notify.success('Guardado', 'Supervisor asignado correctamente.');
        this.advanceToNextStep(t);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo asignar el supervisor.');
      },
    });
  }

  protected saveAssignments(): void {
    const t = this.ticket();
    if (!t) return;

    const stockError = this.chemicalStockError();
    if (stockError) {
      this.notify.error('Químicos', stockError);
      return;
    }
    if (this.selectedChemicals().length > 0 && !this.chemicalMixtureDocument()) {
      this.notify.error('Documento requerido', 'Adjunte el documento de mezcla de químicos antes de continuar.');
      return;
    }

    this.submitting.set(true);

    this.validateTransporteUnits().subscribe(errorMessage => {
      if (errorMessage) {
        this.submitting.set(false);
        this.notify.error('Unidad no disponible', errorMessage);
        return;
      }

      this.withdrawChemicalsFromWarehouse(t).subscribe({
        next: () => this.persistAssignments(t),
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo registrar la salida de bodega de los químicos.');
        },
      });
    });
  }

  /**
   * Registra en Inventario (kardex del Bodeguero) la salida de cada
   * químico seleccionado — es lo que respalda que más adelante, al cerrar
   * la ejecución, el sobrante pueda devolverse contra stock real.
   */
  private withdrawChemicalsFromWarehouse(t: PumpingTicket): Observable<unknown> {
    const rows = this.selectedChemicalRows();
    if (rows.length === 0) return of(null);
    // `asignacion` ahora la actúa el Jefe de Base (Fase 1, D1) — el fallback
    // ya no debe caer en el Supervisor asignado al ticket.
    const responsable = this.auth.currentUser()?.name ?? 'Jefe de Base';
    return forkJoin(rows.map(articulo =>
      this.movimientosInventarioService.registrar({
        articuloId: articulo.id,
        tipo: 'salida',
        cantidad: this.chemicalQuantities().get(articulo.id)!,
        fecha: new Date().toISOString().slice(0, 10),
        motivo: `Asignación a Ticket ${t.code}`,
        responsable,
      }),
    ));
  }

  private persistAssignments(t: PumpingTicket): void {
    const chemicals = this.selectedChemicalRows().map(articulo => ({
      articuloId: articulo.id,
      name: articulo.nombre,
      unit: articulo.unidadStock,
      cantidad: this.chemicalQuantities().get(articulo.id)!,
    }));

    this.pumpingService.assignResources(t.id, {
      operatorIds: this.selectedOperators(),
      unitIds: this.selectedUnits(),
      assignments: this.operatorAssignments(),
      chemicals,
      chemicalMixtureDocument: this.chemicalMixtureDocument()?.name,
    }).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        this.notify.success('Guardado', 'Asignaciones guardadas correctamente.');
        this.advanceToNextStep(t);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudieron guardar las asignaciones.');
      },
    });
  }

  /**
   * Plan 2026, 5.3/5.4: ninguna unidad de Transporte puede salir a un
   * servicio sin una Inspección de Vehículos aprobada por el Supervisor y
   * sin el bloqueo de la Nota 1 (cinturón de seguridad). Devuelve el
   * motivo del bloqueo, o null si todas las unidades de Transporte
   * seleccionadas están en regla.
   */
  private validateTransporteUnits() {
    const selectedCodes = this.unitOptions
      .filter(o => this.selectedUnits().includes(o.value as number))
      .map(o => o.label);

    return forkJoin({
      unidades: this.unidadesService.list(),
      inspections: this.vehicleInspectionsService.list(),
    }).pipe(
      map(({ unidades, inspections }) => {
        const transporteCodes = unidades
          .filter(u => u.tipo === 'Transporte' && selectedCodes.includes(u.code))
          .map(u => u.code);

        for (const code of transporteCodes) {
          const forUnit = inspections
            .filter((i: VehicleInspection) => i.unidadCode === code)
            .sort((a: VehicleInspection, b: VehicleInspection) => b.fecha.localeCompare(a.fecha));
          const latest = forUnit[0];

          if (!latest) {
            return `${code} no tiene ninguna Inspección de Vehículos registrada.`;
          }
          if (!latest.supervisorApprovedBy) {
            return `${code} tiene una inspección pendiente de aprobación del Supervisor.`;
          }
          if (!vehicleInspectionIsUsable(latest)) {
            return `${code} está bloqueada por la inspección — falla en cinturón de seguridad (Nota 1, DYN-SGI-RE-068).`;
          }
        }
        return null;
      }),
    );
  }

  protected saveUnitReport(): void {
    const t = this.ticket();
    if (!t) return;
    if (this.bloqueadoPorSwa()) return;

    // Validar que la inspección esté realizada antes de enviar
    if (!this.allInspectionsCompleted()) {
      this.notify.error(
        'Inspección pendiente',
        'Debe realizar la inspección de vehículos antes de enviar el reporte de unidad.',
      );
      return;
    }

    // Las preguntas de operatividad ("¿unidad lista?", "¿hubo interrupción?")
    // solo se muestran en el Reporte de Unidad — Llegada (`traslado_llegada`,
    // ver ticket-detail-page.html:1035-1049) — exigirlas también al enviar el
    // de Salida bloqueaba ese envío pidiendo algo que no está en pantalla.
    if (this.currentStep() === 'traslado_llegada' && !this.operatividadCompleta()) {
      this.notify.error(
        'Operatividad sin confirmar',
        'Responda si la unidad está lista y operativa, y si algún problema interrumpió la operación, antes de enviar el reporte.',
      );
      return;
    }

    const report = {
      reportCode: `RU-${t.code.replace('PUMP-', '')}`,
      unitCode: this.reportUnitCode(),
      wellName: this.reportWellName(),
      baseName: this.reportBaseName(),
      blockName: this.reportBlockName(),
      headerCode: this.reportHeaderCode(),
      clientName: this.reportClientName(),
      departureDate: toIsoDateString(this.reportDepartureDate()),
      arrivalDate: toIsoDateString(this.reportArrivalDate()),
      fuelDeparture: toFuelReading(this.reportFuelDeparture()),
      fuelArrival: toFuelReading(this.reportFuelArrival()),
      hubodometroOrigen: this.hubodometroOrigen(),
      hubodometroDestino: this.hubodometroDestino(),
      tires: this.tires(),
      origin: this.reportOrigin(),
      destination: this.reportDestination(),
      chassisInspection: this.chassisItems(),
      motorInspection: this.motorItems(),
      arrivalEquipmentInspection: this.arrivalEquipmentItems(),
      instrumentationInspection: this.instrumentationItems(),
      novelties: {
        mecanica: this.noveltiesMecanica(),
        instrumentacion: this.noveltiesInstrumentacion(),
        operaciones: this.noveltiesOperaciones(),
      },
      unitReady: this.unitReadySelection()[0] === 'Sí' ? true : this.unitReadySelection()[0] === 'No' ? false : null,
      operationInterrupted: this.operationInterruptedSelection()[0] === 'Sí' ? true : this.operationInterruptedSelection()[0] === 'No' ? false : null,
      interruptionDetail: this.interruptionDetail(),
      // Nadie llenaba `departureOperatorName`/`arrivalOperatorName` (no había
      // campo editable para eso) — siempre se guardaban vacíos. Se toman del
      // operador que realmente hizo la inspección de vehículo de esa unidad
      // en cada tramo (bug reportado: "Operador salida/llegada" vacíos).
      departureOperatorName:
        this.inspectorDeUnidad(this.completedInspections(), this.reportUnitCode()) || this.departureOperatorName(),
      departureApprovalDate: this.departureApprovalDate(),
      arrivalOperatorName:
        this.inspectorDeUnidad(this.completedLlegadaInspections(), this.reportUnitCode()) || this.arrivalOperatorName(),
      arrivalApprovalDate: this.arrivalApprovalDate(),
    };

    this.submitting.set(true);
    this.pumpingService.saveUnitReport(t.id, report).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        this.notify.success('Guardado', 'Reporte de unidad guardado correctamente.');
        this.bridgeToMaintenance(t, report);
        this.advanceToNextStep(t);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar el reporte.');
      },
    });
  }

  /**
   * Cada acción de guardado (asignar supervisor, asignar recursos, enviar
   * reporte de unidad) persistía su propio paso pero nunca movía el ticket
   * al siguiente paso del wizard — el ticket se quedaba pegado donde
   * estaba aunque el toast dijera "Guardado".
   */
  private readonly NEXT_STEP: Partial<Record<PumpingStep, PumpingStep>> = {
    revision_inicial: 'asignacion',
    asignacion: 'traslado_salida',
    traslado_salida: 'revision_reportes_salida',
    revision_reportes_salida: 'ejecucion_operativa',
    ejecucion_operativa: 'traslado_llegada',
    traslado_llegada: 'mantenimiento',
    mantenimiento: 'revision_reportes_llegada',
  };

  private advanceToNextStep(t: PumpingTicket): void {
    const nextStep = this.NEXT_STEP[t.currentStep];
    if (!nextStep) return;

    this.pumpingService.advanceStep(t.id, nextStep).subscribe({
      next: updated => {
        this.ticket.set(updated);
        // Auto-switch role to the one responsible for the next step
        const nextRole = PUMPING_STEP_ROLE[nextStep];
        this.auth.switchRole(nextRole.roleName, nextRole.roleId);
        this.notify.success('Rol cambiado', `Ahora actúa como ${nextRole.roleName} para el paso: ${PUMPING_STEP_LABELS[nextStep]}.`);
        // Navigate back to the ticket list so the user sees the updated state
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: () => this.notify.error('Error', 'No se pudo avanzar el ticket al siguiente paso.'),
    });
  }

  /**
   * Puente automático y silencioso hacia Mantenimiento: si el reporte trae
   * novedades, crea (o actualiza, si ya existía uno para este ticket) un
   * UnitReport para que aparezca en la Bandeja del Jefe — sin pedirle un
   * paso extra al Operador de Pumping. No bloquea el guardado del reporte
   * de Pumping si algo falla acá.
   */
  private bridgeToMaintenance(t: PumpingTicket, report: PumpingUnitReport): void {
    if (!unitReportHasNovedades({
      problemasMecanica: report.novelties.mecanica,
      problemasInstrumentacion: report.novelties.instrumentacion,
      problemasOperaciones: report.novelties.operaciones,
    })) {
      return;
    }

    const unitCode = report.unitCode || t.unitCode;
    this.unidadesService.list().subscribe(unidades => {
      const unidad = unidades.find(u => u.code === unitCode);
      if (!unidad) {
        this.notify.error('No se sincronizó con Mantenimiento', `No se encontró la unidad '${unitCode}' — el reporte de Pumping sí quedó guardado.`);
        return;
      }

      const input: CreateUnitReportInput = {
        sourceModule: 'Pumping',
        originTicketId: t.id,
        reportNo: t.code.replace('PUMP-', ''),
        pozo: t.wellName,
        cliente: t.clientName,
        bloque: report.blockName,
        base: report.baseName,
        unidad: unitCode,
        unidadId: unidad.id,
        fechaSalida: report.departureDate || t.estimatedDate,
        fechaLlegada: report.arrivalDate || new Date().toISOString(),
        origen: report.origin,
        destino: report.destination,
        inspeccionChasis: [],
        inspeccionPlataforma: [],
        inspeccionInstrumentacion: [],
        problemasMecanica: report.novelties.mecanica,
        problemasInstrumentacion: report.novelties.instrumentacion,
        problemasOperaciones: report.novelties.operaciones,
        interrumpioOperacion: report.operationInterrupted ?? false,
        detalleInterrupcion: report.interruptionDetail,
        listaParaSiguienteOperacion: report.unitReady ?? true,
        operadorSalida: report.departureOperatorName,
        operadorLlegada: report.arrivalOperatorName,
        supervisorSalida: t.assignedSupervisor || '',
        supervisorLlegada: t.assignedSupervisor || '',
      };

      this.unitReportsService.list().subscribe(existingReports => {
        const existing = existingReports.find(r => r.originTicketId === t.id);
        const save$ = existing ? this.unitReportsService.update(existing.id, input) : this.unitReportsService.create(input);
        save$.subscribe({
          next: () => this.notify.success('Sincronizado', 'La novedad se envió a la Bandeja de Mantenimiento.'),
          error: () => this.notify.error('No se sincronizó con Mantenimiento', 'El reporte de Pumping sí quedó guardado, pero no se pudo enviar la novedad a la Bandeja.'),
        });
      });
    });
  }

  protected approveTicket(): void {
    const t = this.ticket();
    if (!t || this.decision() !== 'approved') return;
    if (this.bloqueadoPorSwa()) return;
    this.submitting.set(true);
    this.pumpingService.approveTicket(t.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.notify.success('Aprobado', 'Ticket aprobado — pasa a estado Finalizado.');
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo aprobar el ticket.');
      },
    });
  }

  protected rejectTicket(): void {
    const t = this.ticket();
    if (!t || this.decision() !== 'rejected') return;
    this.submitting.set(true);
    this.pumpingService.rejectTicket(t.id, this.ticketRejectionReason()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.notify.success('Rechazado', 'El ticket volvió a revisión de reportes de llegada.');
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo rechazar el ticket.');
      },
    });
  }

  protected readonly ticketRejectionReason = signal('');

  // ══════════════════════════════════════════════
  // Event handlers
  // ══════════════════════════════════════════════

  protected onSupervisorChange(value: unknown): void {
    this.selectedSupervisor.set(typeof value === 'number' ? value : null);
  }

  protected onOperatorsChange(value: unknown): void {
    this.selectedOperators.set(Array.isArray(value) ? value : []);
  }

  protected onUnitsChange(value: unknown): void {
    this.selectedUnits.set(Array.isArray(value) ? value : []);
  }

  /**
   * "Aprobar"/"Rechazar" de dynadrill-approval-actions ya no necesitan un
   * botón de confirmación aparte en el footer (se veía redundante, mismo
   * verbo repetido dos veces) — Aprobar dispara directo el modal de
   * confirmación con la consecuencia; Rechazar solo marca el estado para
   * mostrar el motivo (se confirma con el modal recién al escribirlo, ver
   * `confirmarRechazoTicket`).
   */
  protected onDecisionChange(decision: DynadrillApprovalDecision): void {
    this.decision.set(decision);
    if (decision === 'approved') this.confirmarAprobacionTicket();
  }

  private async confirmarAprobacionTicket(): Promise<void> {
    const confirmado = await this.dialog.confirm({
      title: 'Aprobar ticket',
      content: 'El ticket será aprobado y pasará a estado cierre.',
      okText: 'Aprobar',
    });
    if (confirmado) {
      this.approveTicket();
    } else {
      this.decision.set(null);
    }
  }

  protected async confirmarRechazoTicket(): Promise<void> {
    if (!this.ticketRejectionReason().trim()) return;
    const confirmado = await this.dialog.confirm({
      title: 'Rechazar ticket',
      content: 'El ticket será devuelto a revisión de reportes de llegada para correcciones.',
      okText: 'Rechazar',
      danger: true,
    });
    if (confirmado) this.rejectTicket();
  }

  protected onInspectionChange(
    section: 'chassisItems' | 'motorItems' | 'arrivalEquipmentItems' | 'instrumentationItems',
    updated: DynadrillInspectionItem,
  ): void {
    this[section].update(items =>
      items.map(item => (item.id === updated.id ? updated : item)),
    );
  }

  protected markAllInspectionItems(
    section: 'chassisItems' | 'motorItems' | 'arrivalEquipmentItems' | 'instrumentationItems',
    mode: 'salida' | 'llegada',
    value: 'ok' | 'defectuoso',
  ): void {
    this[section].update(items =>
      items.map(item => ({ ...item, [mode]: value })),
    );
  }

  protected goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  protected formatDate(iso: string): string {
    return iso.slice(0, 10);
  }

  /**
   * Abre el dialog de inspección de vehículos (DYN-SGI-RE-068)
   * para el operador seleccionado en la tabla de personal asignado.
   * mode 'salida' guarda en completedInspections, 'llegada' en completedLlegadaInspections.
   */
  protected openInspection(row: Record<string, unknown>, mode: 'salida' | 'llegada' = 'salida'): void {
    const operatorId = row['id'] as number;
    const supervisorNombre = this.ticket()?.assignedSupervisor || undefined;

    // Llegada: se parte de la inspección de salida ya registrada — no se
    // vuelve a elegir la unidad (ya se sabe cuál se asignó) y los datos
    // quedan editables. Se pasa con id <= 0 para que el diálogo guarde un
    // registro nuevo de llegada, no un PUT sobre el de salida.
    const salidaInspection = mode === 'llegada'
      ? (this.completedInspections().get(operatorId) as VehicleInspection | undefined)
      : undefined;
    const prefill: VehicleInspection | undefined = salidaInspection
      ? { ...salidaInspection, id: 0, kmInicial: salidaInspection.kmFinal || salidaInspection.kmInicial, kmFinal: 0 }
      : undefined;

    const ref = this.dialog.open<VehicleInspectionDialog, VehicleInspectionDialogData>({
      title: mode === 'llegada'
        ? 'Inspección de Vehículos (Llegada) — DYN-SGI-RE-068'
        : 'Inspección de Vehículos — DYN-SGI-RE-068',
      content: VehicleInspectionDialog,
      data: {
        existing: prefill,
        // La unidad ya se la asignó el Supervisor al operador: se precarga y se fija.
        unidadCodeAsignada: row['unitCode'] as string,
        lockUnidad: !!(row['unitCode'] as string) || (mode === 'llegada' && !!prefill),
        supervisorNombre,
        modo: mode,
        // Sin esto, "¿ya se hizo la inspección?" se resolvía buscando
        // CUALQUIER inspección alguna vez registrada para esa unidad —
        // con unidades reutilizadas entre servicios, un ticket nuevo
        // heredaba una inspección de un ticket anterior (bug reportado:
        // aparecía "Inspección realizada" sin haberla hecho todavía).
        ticketId: this.ticket()?.id,
      },
      size: 'large',
      footer: false,
    });
    ref.afterClose.subscribe(result => {
      if (result) {
        if (mode === 'llegada') {
          this.completedLlegadaInspections.update(map => {
            const updated = new Map(map);
            updated.set(operatorId, result);
            return updated;
          });
        } else {
          this.completedInspections.update(map => {
            const updated = new Map(map);
            updated.set(operatorId, result);
            return updated;
          });
          // La inspección de salida ya pide Origen/Destino — se precargan acá
          // para no volver a tipearlos en "Fecha, ruta y combustible". No pisa
          // un valor que el usuario ya haya escrito a mano en esa sección.
          if (!this.reportOrigin() && result.puntoPartida) this.reportOrigin.set(result.puntoPartida);
          if (!this.reportDestination() && result.destino) this.reportDestination.set(result.destino);
        }
        this.notify.success('Inspección guardada', `Inspección de ${mode} realizada por ${row['name']}.`);
      }
    });
  }

  /**
   * Abre el dialog de inspección en modo lectura para ver el detalle
   * de la inspección ya realizada.
   */
  protected viewInspection(row: Record<string, unknown>): void {
    const operatorId = row['id'] as number;
    const existing = this.completedInspections().get(operatorId) as VehicleInspection | undefined;
    if (!existing) return;
    this.dialog.open<VehicleInspectionDialog, VehicleInspectionDialogData>({
      title: 'Detalle de Inspección — DYN-SGI-RE-068',
      content: VehicleInspectionDialog,
      data: { existing, readonly: true },
      size: 'large',
      footer: false,
    });
  }

  /** Abre el dialog de inspección de llegada en modo lectura */
  protected viewLlegadaInspection(row: Record<string, unknown>): void {
    const operatorId = row['id'] as number;
    const existing = this.completedLlegadaInspections().get(operatorId) as VehicleInspection | undefined;
    if (!existing) return;
    this.dialog.open<VehicleInspectionDialog, VehicleInspectionDialogData>({
      title: 'Detalle de Inspección (Llegada) — DYN-SGI-RE-068',
      content: VehicleInspectionDialog,
      data: { existing, readonly: true },
      size: 'large',
      footer: false,
    });
  }

  // ══════════════════════════════════════════════
  // Init
  // ══════════════════════════════════════════════

  /**
   * Hidrata la inspección de salida de cada operador desde el paso de revisión
   * en adelante (la tabla ya la da por "Realizada"). Prioridad:
   *  1. la inspección real que el operador registró (en sesión o en el backend),
   *     de donde sale el conductor elegido;
   *  2. si no hay ninguna, una de EJEMPLO (id 0, solo lectura) con la Unidad
   *     real y un conductor con permisos.
   * Se re-ejecuta al llegar cada catálogo para no perder una carrera de red.
   */
  /**
   * Restaura `completedInspections` con las inspecciones REALES ya guardadas
   * en el backend (`realInspections`) — antes se saltaba por completo hasta
   * llegar al paso "revision_reportes_salida", así que al recargar la página
   * en "traslado_salida" (justo donde el operador hace "Realizar inspección")
   * la inspección recién guardada desaparecía de la vista aunque sí estaba
   * persistida. El mock de relleno (`createMockCompletedInspection`, para
   * demo/operadores sin inspección real) sigue reservado a partir de
   * "revision_reportes_salida", que es cuando el Supervisor la revisa.
   */
  private syncMockInspections(): void {
    const t = this.ticket();
    if (!t) return;
    const pasadoRevisionSalida = STEP_KEYS.indexOf(t.currentStep) >= STEP_KEYS.indexOf('revision_reportes_salida');
    this.completedInspections.update(map => {
      const updated = new Map(map);
      for (const op of t.operators) {
        const actual = updated.get(op.id) as VehicleInspection | undefined;
        if (actual && actual.id !== 0) continue; // inspección real hecha en esta sesión
        const real = this.ultimaInspeccionReal(op.unitCode);
        if (real) {
          updated.set(op.id, real);
        } else if (pasadoRevisionSalida) {
          updated.set(op.id, createMockCompletedInspection(op.name, op.unitCode, this.unidadPorCodigo(op.unitCode), this.conductorParaOperador(op.id)));
        }
      }
      return updated;
    });
  }

  private initFromTicket(ticket: PumpingTicket): void {
    if (ticket.assignedSupervisor) {
      const opt = this.supervisorOptions.find(o => o.label === ticket.assignedSupervisor);
      if (opt) this.selectedSupervisor.set(opt.value as number);
    }

    // Pre-fill report general info from ticket
    this.reportWellName.set(ticket.wellName);
    this.reportClientName.set(ticket.clientName);
    this.reportUnitCode.set(ticket.unitCode || '');

    // Gerenciamientos de viaje ya completados — restaurados del ticket (no
    // solo de la memoria del componente) para que sobrevivan a un recargo
    // de página y para que el de retorno pueda heredar del de ida.
    if (ticket.travelManagements) {
      this.travelManagements.set(new Map(Object.entries(ticket.travelManagements).map(([k, v]) => [Number(k), v])));
    }
    if (ticket.returnTravelManagements) {
      this.returnTravelManagements.set(new Map(Object.entries(ticket.returnTravelManagements).map(([k, v]) => [Number(k), v])));
    }

    // Desde `traslado_llegada` en adelante (llegada, mantenimiento, revisar
    // reportes de llegada, revisión, cierre) la inspección de salida ya
    // fue realizada y aprobada por el supervisor. Antes solo se hidrataba en
    // `traslado_llegada` exacto, por lo que la sección "Inspección de
    // salida" del paso `revision_reportes_llegada` siempre mostraba
    // "el operador no registró inspección de salida".
    this.syncMockInspections();

    if (ticket.unitReport) {
      const r = ticket.unitReport;
      this.reportBaseName.set(r.baseName);
      this.reportBlockName.set(r.blockName);
      this.reportHeaderCode.set(r.headerCode);
      this.reportDepartureDate.set(r.departureDate ? parseLocalDateString(r.departureDate) : null);
      this.reportArrivalDate.set(r.arrivalDate ? parseLocalDateString(r.arrivalDate) : null);
      this.reportFuelDeparture.set(r.fuelDeparture != null ? String(r.fuelDeparture) : '');
      this.reportFuelArrival.set(r.fuelArrival != null ? String(r.fuelArrival) : '');
      this.reportOrigin.set(r.origin);
      this.reportDestination.set(r.destination);
      this.hubodometroOrigen.set(r.hubodometroOrigen);
      this.hubodometroDestino.set(r.hubodometroDestino);
      if (r.tires) this.tires.set(r.tires);
      this.chassisItems.set(r.chassisInspection);
      this.motorItems.set(r.motorInspection);
      this.arrivalEquipmentItems.set(r.arrivalEquipmentInspection);
      this.instrumentationItems.set(r.instrumentationInspection);
      this.noveltiesMecanica.set(r.novelties.mecanica);
      this.noveltiesInstrumentacion.set(r.novelties.instrumentacion);
      this.noveltiesOperaciones.set(r.novelties.operaciones);
      this.hayNovedades.set(!!(r.novelties.mecanica || r.novelties.instrumentacion || r.novelties.operaciones));
      this.unitReadySelection.set(r.unitReady === true ? ['Sí'] : r.unitReady === false ? ['No'] : []);
      this.operationInterruptedSelection.set(r.operationInterrupted === true ? ['Sí'] : r.operationInterrupted === false ? ['No'] : []);
      this.interruptionDetail.set(r.interruptionDetail);
      this.departureOperatorName.set(r.departureOperatorName);
      this.departureApprovalDate.set(r.departureApprovalDate || '');
      this.arrivalOperatorName.set(r.arrivalOperatorName);
      this.arrivalApprovalDate.set(r.arrivalApprovalDate || '');
    }
  }
}
