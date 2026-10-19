import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet, formatDate } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillApprovalActionsComponent,
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDatetimePickerComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSkeletonComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
  type DynadrillApprovalDecision,
  type DynadrillContextCardItem,
  type DynadrillContextCardTag,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  FcrTicket,
  FcrTool,
  FCR_PHASE_LABELS,
  FCR_PHASE_ROLE,
  FCR_TOOL_DAILY_STATUS_CODE,
  FCR_TOOL_DAILY_STATUS_LABELS,
  FCR_TOOL_ESTADO_LABELS,
  FCR_TOOL_ESTADO_VARIANT,
  FCR_TOOL_STATUS_LABELS,
  estadoDeHerramienta,
  type FcrPhase,
  type FcrPhaseApproval,
  type FcrToolDailyStatus,
  type FcrToolStatus,
} from '../../models/fcr.model';
import { fcrPhaseKeys, fcrResponsibleRole } from '../../models/fcr-flow';
import { FcrService, type CampoDocumentoFcr } from '../../services/fcr.service';
import type { DocumentosQhseTicket } from '../../../pumping/services/pumping.service';
import { PedidoService } from '../../../../facturacion/services/pedido.service';
import {
  itemsEstimadosDe,
  TIPO_OT_LABELS,
  TIPO_SERVICIO_LABELS,
  type Pedido,
} from '../../../../facturacion/models/pedido.model';
import {
  calcDurationHours,
  capitalize,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  parseLocalDateString,
  toLocalDateString,
} from '../../../../../shared/utils';
import {
  MACRO_ESTADO_LABELS,
  MACRO_ESTADO_TONE,
} from '../../../../../shared/models/timeline.model';
import { FcrToolInspeccionesService } from '../../services/fcr-tool-inspecciones.service';
import {
  FCR_TOOL_INSPECTION_FIRMA_ROLES,
  FCR_TOOL_INSPECTION_FIRMA_ROLES_REQUERIDOS,
  FCR_TOOL_INSPECTION_FIRMA_ROL_ANTERIOR,
  type FcrToolInspection,
} from '../../models/fcr-tool-inspeccion.model';
import {
  TIPO_COMPLETACION_LABELS,
  TIPO_OPERADOR_LABELS,
  TIPO_PICKER_LABELS,
  TIPO_TRABAJO_LABELS,
  type TipoCompletacion,
  type TipoOperador,
  type TipoPicker,
  type TipoTrabajo,
} from '../../models/fcr-catalogos.model';
import { ArticulosService } from '../../../../inventario/services/articulos.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { TicketQhseBanner } from '../../../shared/ticket-qhse-banner/ticket-qhse-banner';
import {
  QHSE_VIEWER_ROLES,
  actividadesPendientesTexto,
  coberturaOk,
  emergenciaActiva,
  ptwFaseLabel,
  ptwFirmadoOk,
  swaActivo,
} from '../../../shared/ticket-qhse.util';
import {
  SolicitarCorreccionDialog,
  SolicitarCorreccionDialogData,
  SolicitarCorreccionDialogResult,
} from '../../components/solicitar-correccion-dialog';
import {
  ObservacionesTimelineDialog,
  ObservacionesTimelineDialogData,
  ObservacionesTimelineDialogResult,
} from '../../components/observaciones-timeline-dialog';
import {
  AsignarOperadorDialog,
  AsignarOperadorDialogData,
  AsignarOperadorDialogResult,
} from '../../components/asignar-operador-dialog';
import {
  ChecklistHerramientaDialog,
  ChecklistHerramientaDialogData,
} from '../../components/checklist-herramienta-dialog';
import {
  HerramientaFaltanteDialog,
  HerramientaFaltanteDialogData,
  HerramientaFaltanteDialogResult,
} from '../../components/herramienta-faltante-dialog';
import {
  GuiaSalidaBodegaDialog,
  GuiaSalidaBodegaDialogData,
  GuiaSalidaBodegaDialogResult,
} from '../../components/guia-salida-bodega-dialog';
import { TicketPrefacturaFirma } from '../../../../../shared/components/ticket-prefactura-firma/ticket-prefactura-firma';
import { TicketPrefacturaService } from '../../../../../shared/services/ticket-prefactura.service';
import {
  TicketPrefacturaDialog,
  type TicketPrefacturaDialogData,
} from '../../../../../shared/components/ticket-prefactura-dialog/ticket-prefactura-dialog';
import {
  CierreTicketDialog,
  CierreTicketDialogData,
  CierreTicketDialogResult,
} from '../../components/cierre-ticket-dialog';
import {
  ReporteCierrePdfDialog,
  ReporteCierrePdfDialogData,
  type ReporteCierrePdfPhaseRow,
  OperativoDocsBridgeService,
  descargarCsv,
  parseCsvFile,
  normalizeFechaCsv,
} from '../../../../../shared/index';
import { TicketProgress } from '../../../shared/ticket-progress/ticket-progress';
import { useDetailChrome } from '../../../../../layout/page-chrome.service';

/** RN de negocio (fcr-adjuntos-reales): el backend es la fuente de verdad, esto es solo UX para no esperar el round-trip. */
const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;

/** Fila de la tabla de operadores de 'tipo_operador' — antes vivía en `AsignarOperadorMecanicoDialog` (modal ya eliminado). */
interface MechanicOperator {
  name: string;
  tipo: TipoOperador;
  disponible: boolean;
}

/** Mapea las 3 claves cortas históricas de la rama SERVICIOS al nombre de campo real de `CAMPOS_DOCUMENTO_FCR` (backend). */
const CAMPO_DOCUMENTO_SERVICIO: Record<
  'formularioExterno' | 'dimensionamiento' | 'dureza',
  CampoDocumentoFcr
> = {
  formularioExterno: 'formularioInspeccionExterno',
  dimensionamiento: 'formatoDimensionamientoServicio',
  dureza: 'formatoDurezaServicio',
};

/** Día del calendario en hora LOCAL — `toISOString()` es UTC y en Ecuador (UTC-5) después de las 19:00 ya daba el día siguiente. */
function toIso(date: Date): string {
  return toLocalDateString(date);
}

function todayIso(): string {
  return toIso(new Date());
}

/**
 * FCR nunca tiene un paso explícito de "asignar supervisor" (a diferencia de
 * Pumping): el ticket nace con `assignedSupervisor` vacío desde el puente
 * Facturación → FCR y nada lo llena después. El nombre real sí queda
 * registrado en `phaseHistory` cada vez que un Supervisor aprueba un avance
 * de fase — se usa como respaldo para no mostrar "—" cuando ese dato existe.
 */
function resolveSupervisorName(t: FcrTicket): string {
  if (t.assignedSupervisor) return t.assignedSupervisor;
  return t.phaseHistory.find((p) => p.approvedByRole === 'Supervisor')?.approvedBy ?? '';
}

import { DocumentoPdfService } from '../../../../../shared/documentos';
import {
  fechaDiaDoc,
  fechaDoc,
  fechaHoraDoc,
} from '../../../../../shared/documentos/documento-format.util';
import {
  agruparBitacoraPorDia,
  agruparPorFecha,
  estadoDiaBitacora,
  fechaSugeridaEnServicio,
  fueraDelServicio,
  type FcrBitacoraDia,
  type RangoServicio,
} from '../../models/fcr-bitacora-dias';
import {
  agruparActividadesDelPedido,
  ETIQUETA_AVISO_PRECARGA,
  notaPrecarga,
} from '../../models/fcr-actividades-pedido';
import { HttpErrorResponse } from '@angular/common/http';
import { EncuestaSatisfaccionHoja } from '../../../../../shared/documentos/formatos/encuesta-satisfaccion-hoja';
import { ReporteJobHoja } from '../../../../../shared/documentos/formatos/reporte-job-hoja';
import { ReporteHerramientasHoja } from '../../../../../shared/documentos/formatos/reporte-herramientas-hoja';
import { PedidoDatos } from '../../../../../shared/components/pedido-datos/pedido-datos';
import { PedidoItems } from '../../../../../shared/components/pedido-items/pedido-items';

@Component({
  selector: 'app-fcr-ticket-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TicketPrefacturaFirma,
    PedidoDatos,
    PedidoItems,
    DatePipe,
    NgTemplateOutlet,
    DynadrillScreenHeaderComponent,
    DynadrillContextCardComponent,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillDatetimePickerComponent,
    DynadrillIconButtonComponent,
    DynadrillIconComponent,
    DynadrillInputComponent,
    DynadrillSkeletonComponent,
    DynadrillTextComponent,
    DynadrillTagComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillUploadZoneComponent,
    DynadrillApprovalActionsComponent,
    TicketQhseBanner,
    TicketProgress,
  ],
  templateUrl: './ticket-detail-page.html',
  styleUrl: './ticket-detail-page.scss',
})
export class FcrTicketDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fcrService = inject(FcrService);
  private readonly toolInspeccionesService = inject(FcrToolInspeccionesService);
  private readonly articulosService = inject(ArticulosService);
  private readonly pedidoService = inject(PedidoService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly ticketPrefactura = inject(TicketPrefacturaService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly documentoPdf = inject(DocumentoPdfService);
  private readonly docsBridge = inject(OperativoDocsBridgeService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  protected readonly loading = signal(true);
  protected readonly ticket = signal<FcrTicket | null>(null);

  // ── Documentos QHSE (ART / PT del día) — réplica del circuito de Pumping ──
  protected readonly documentosQhse = signal<DocumentosQhseTicket | null>(null);
  protected readonly artFechaEmision = signal<Date | null>(new Date());
  protected readonly artArchivo = signal<File | null>(null);
  protected readonly ptArchivo = signal<File | null>(null);
  protected readonly documentosQhseSubmitting = signal(false);
  /** El ticket no se cierra sin el Acta de Entrega de Locación (el PTW sí se cierra sin ella). `false` mientras carga el estado documental. */
  protected readonly faltaActaEntrega = computed(
    () => this.documentosQhse()?.formatoEntrega === false,
  );

  /** Al tocar el ícono de subir de ART / PT se despliega el formulario de carga (fecha + archivo). */
  protected readonly subidaArtAbierta = signal(false);
  protected readonly subidaPtAbierta = signal(false);

  private loadDocumentosQhse(ticketId: number): void {
    this.fcrService.documentosQhse(ticketId).subscribe({
      next: (d) => this.documentosQhse.set(d),
      error: () => this.documentosQhse.set(null),
    });
  }

  protected onArtArchivoSeleccionado(file: NzUploadFile): void {
    this.artArchivo.set((file.originFileObj as File | undefined) ?? (file as unknown as File));
  }

  protected onPtArchivoSeleccionado(file: NzUploadFile): void {
    this.ptArchivo.set((file.originFileObj as File | undefined) ?? (file as unknown as File));
  }

  protected subirArtQhse(): void {
    const t = this.ticket();
    const archivo = this.artArchivo();
    const fecha = this.artFechaEmision();
    if (!t || !archivo || !fecha) {
      this.notify.error('ART', 'Elegí la fecha de emisión y el archivo del ART.');
      return;
    }
    this.documentosQhseSubmitting.set(true);
    this.fcrService.subirArtQhse(t.id, toLocalDateString(fecha), archivo).subscribe({
      next: () => {
        this.documentosQhseSubmitting.set(false);
        this.artArchivo.set(null);
        this.subidaArtAbierta.set(false);
        this.notify.success('ART guardado', 'El ART quedó registrado para este pedido.');
        this.loadDocumentosQhse(t.id);
      },
      error: () => {
        this.documentosQhseSubmitting.set(false);
        this.notify.error('Error', 'No se pudo subir el ART.');
      },
    });
  }

  protected subirPtQhse(): void {
    const t = this.ticket();
    const archivo = this.ptArchivo();
    const ptwCode = this.documentosQhse()?.ptwAbierto?.code;
    if (!t || !archivo || !ptwCode) {
      this.notify.error('PT', 'No hay un PTW abierto contra el cual subir el PT de hoy.');
      return;
    }
    this.documentosQhseSubmitting.set(true);
    this.fcrService.subirPtQhse(t.id, ptwCode, archivo).subscribe({
      next: () => {
        this.documentosQhseSubmitting.set(false);
        this.ptArchivo.set(null);
        this.subidaPtAbierta.set(false);
        this.notify.success('PT guardado', 'El Permiso de Trabajo de hoy quedó registrado.');
        this.loadDocumentosQhse(t.id);
      },
      error: () => {
        this.documentosQhseSubmitting.set(false);
        this.notify.error('Error', 'No se pudo subir el PT.');
      },
    });
  }

  /** Acta de Entrega de Locación (DYN-PMP-RE-027): la sube el Supervisor al finalizar el ticket y el ticket no se puede cerrar sin ella (el PTW sí). */
  protected readonly entregaArchivo = signal<File | null>(null);
  protected readonly subidaEntregaAbierta = signal(false);

  protected onEntregaArchivoSeleccionado(file: NzUploadFile): void {
    this.entregaArchivo.set((file.originFileObj as File | undefined) ?? (file as unknown as File));
  }

  protected subirEntregaQhse(): void {
    const t = this.ticket();
    const archivo = this.entregaArchivo();
    if (!t || !archivo) {
      this.notify.error('Acta de entrega', 'Elegí el archivo del Acta de Entrega de Locación.');
      return;
    }
    this.documentosQhseSubmitting.set(true);
    this.fcrService.subirEntregaQhse(t.id, archivo).subscribe({
      next: () => {
        this.documentosQhseSubmitting.set(false);
        this.entregaArchivo.set(null);
        this.subidaEntregaAbierta.set(false);
        this.notify.success('Acta de entrega guardada', 'Ya puedes cerrar el ticket.');
        this.loadDocumentosQhse(t.id);
      },
      error: () => {
        this.documentosQhseSubmitting.set(false);
        this.notify.error('Error', 'No se pudo subir el Acta de Entrega.');
      },
    });
  }

  protected descargarDocumentoQhse(tipo: string, referencia: string): void {
    const t = this.ticket();
    if (!t) return;
    this.fcrService.descargarDocumentoQhse(t.id, tipo, referencia).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el documento.'),
    });
  }

  /** ART y PT los sube el Supervisor de FCR (Jefe de Base y Superadmin de respaldo) — QHSE los ve en "Documentos por pedido". */
  protected readonly puedeSubirQhse = computed(() =>
    ['Supervisor', 'Jefe de Base', 'Superadmin'].includes(this.roleName()),
  );
  /** ART y PT del día son de la operación en curso: con el ticket cerrado ya no se suben. El Acta de Entrega sí, se carga al finalizar. */
  protected readonly puedeSubirQhseEnCurso = computed(
    () => this.puedeSubirQhse() && !this.ticketCerrado(),
  );

  // ── Gates QHSE (HSE-PLAN-001 cobertura IPERC + HSE-SITIO-001 PTW + HSE-SEGUIMIENTO-003 SWA + HSE-TRIAGE-001 Emergencia) ──
  protected readonly qhseVinculo = computed(() => this.ticket()?.qhse ?? null);
  protected readonly coberturaOk = computed(() => coberturaOk(this.qhseVinculo()));
  protected readonly ptwFirmadoOk = computed(() => ptwFirmadoOk(this.qhseVinculo()));
  protected readonly swa = computed(() => swaActivo(this.qhseVinculo()));
  protected readonly emergencia = computed(() => emergenciaActiva(this.qhseVinculo()));
  protected readonly puedeVerQhse = computed(() => QHSE_VIEWER_ROLES.includes(this.roleName()));

  // ── Tracker de fases (la secuencia depende de tipoOt — dos entradas, un tronco común) ──

  protected readonly phaseKeys = computed(() => fcrPhaseKeys(this.ticket()?.tipoOt));
  protected readonly phaseLabels = computed(() => this.phaseKeys().map((p) => FCR_PHASE_LABELS[p]));

  protected readonly currentPhaseIndex = computed(() => {
    const t = this.ticket();
    return t ? this.phaseKeys().indexOf(t.currentPhase) : 0;
  });

  /** Cerrado = finalizado: todo en solo lectura (imprimibles y descargas siguen disponibles). */
  protected readonly ticketCerrado = computed(() => this.ticket()?.status === 'cerrado');
  /** Para la línea de avance: con el ticket cerrado todas las fases quedan completadas (incluida Cierre). */
  protected readonly progressIndex = computed(() =>
    this.ticketCerrado() ? this.phaseKeys().length : this.currentPhaseIndex(),
  );

  /**
   * Pantalla acumulativa: 'aprobacion_supervisor_operaciones' (solo SERVICIOS),
   * 'asignacion' y 'reunion_operativa' son 3 secciones grandes que, una vez
   * completas, solo aportan un dato cada una — se muestran como una sola
   * tabla de 3 filas en vez de 3 secciones apiladas. Se renderiza en la
   * posición de la que aparece primero en `phaseKeys()` (VENTA no tiene la
   * fase de aprobación, así que ahí "primera" es 'asignacion').
   */
  private readonly FASES_RESUMEN_TRIADA: FcrPhase[] = [
    'aprobacion_supervisor_operaciones',
    'asignacion',
    'reunion_operativa',
  ];
  protected readonly primeraFaseTriada = computed<FcrPhase | null>(
    () => this.FASES_RESUMEN_TRIADA.find((f) => this.phaseKeys().includes(f)) ?? null,
  );
  protected readonly resumenTriada = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const idx = (f: FcrPhase) => this.phaseKeys().indexOf(f);
    const rows: { label: string; estado: string; variant: 'success' | 'warning' | 'neutral' }[] =
      [];
    if (
      this.phaseKeys().includes('aprobacion_supervisor_operaciones') &&
      idx('aprobacion_supervisor_operaciones') < this.currentPhaseIndex()
    ) {
      rows.push({
        label: 'Aprobación de Supervisor de Operaciones',
        estado: t.inspeccionAprobada ? 'Aprobado' : 'Rechazado',
        variant: t.inspeccionAprobada ? 'success' : 'warning',
      });
    }
    if (this.phaseKeys().includes('asignacion') && idx('asignacion') < this.currentPhaseIndex()) {
      rows.push({
        label: 'Asignación de Operador',
        estado: t.assignedOperator || '—',
        variant: 'neutral',
      });
    }
    if (
      this.phaseKeys().includes('reunion_operativa') &&
      idx('reunion_operativa') < this.currentPhaseIndex()
    ) {
      rows.push({
        label: 'Reunión Operativa',
        estado: t.operationalActaSigned
          ? `Acta firmada — ${this.formatDate(t.operationalMeetingDate)}`
          : 'Pendiente',
        variant: t.operationalActaSigned ? 'success' : 'neutral',
      });
    }
    return rows;
  });

  /** `null` = sin selección manual → se muestra el detalle de la fase actual. Clic en una fase ya alcanzada la selecciona. */
  private readonly manualPhaseIndex = signal<number | null>(null);
  protected readonly selectedPhaseIndex = computed(
    () => this.manualPhaseIndex() ?? this.currentPhaseIndex(),
  );

  protected seleccionarFase(index: number): void {
    if (index > this.currentPhaseIndex()) return;
    this.manualPhaseIndex.set(index);
  }

  protected readonly currentPhase = computed<FcrPhase>(
    () => this.ticket()?.currentPhase ?? 'revision_inicial',
  );

  /** Misma regla que la lista y el tablero (sub-pasos de Revisión inicial y Preparación de Herramientas incluidos). */
  protected readonly responsibleRole = computed(() => {
    const t = this.ticket();
    return t ? fcrResponsibleRole(t) : FCR_PHASE_ROLE[this.currentPhase()].roleName;
  });
  protected readonly isMyTurn = computed(
    () => !this.ticketCerrado() && this.responsibleRole() === this.roleName(),
  );

  /** Accesible desde cualquier fase — a diferencia de "Solicitar corrección" (atado a rechazar 'revision_inicial'), esto no dispara ninguna otra acción de negocio. */
  protected openObservaciones(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<ObservacionesTimelineDialog, ObservacionesTimelineDialogData>({
      title: 'Observaciones',
      content: ObservacionesTimelineDialog,
      data: { ticketCode: t.code, observations: t.observations },
      footer: false,
    });
    ref.afterClose.subscribe((result: ObservacionesTimelineDialogResult | undefined) => {
      if (!result?.added || !result.message) return;
      this.fcrService.addObservation(t.id, result.message, this.roleName()).subscribe({
        next: (updated) => {
          this.ticket.set(updated);
          this.notify.success('Observación agregada.');
        },
        error: () => this.notify.error('Error', 'No se pudo agregar la observación.'),
      });
    });
  }

  /** Quién confirmó el avance hacia la fase actual — mostrado en el encabezado. */
  protected readonly previousPhaseApproval = computed<FcrPhaseApproval | undefined>(() => {
    const t = this.ticket();
    if (!t) return undefined;
    const phase = t.currentPhase;
    for (let i = t.phaseHistory.length - 1; i >= 0; i--) {
      if (t.phaseHistory[i].phase === phase) return t.phaseHistory[i];
    }
    return undefined;
  });

  /**
   * Confirmación previa a un paso crítico (RN-FCR-008C y equivalentes):
   * una vez confirmado, el paso queda bloqueado — no hay edición posterior,
   * solo el botón puntual de "Corregir" en los 2 pasos donde el error
   * humano es más probable (preparación de herramientas, asignación de
   * operador).
   */
  private confirmStep(title: string, content: string, danger = false): Promise<boolean> {
    return this.dialog.confirm({
      title,
      content,
      okText: 'Confirmar',
      cancelText: 'Cancelar',
      danger,
    });
  }

  // ── Pedido vinculado (solo lectura, fase 'revision_inicial') ──

  /** Detalle completo del Pedido de Facturación que originó este ticket — `null` si el ticket no tiene uno vinculado (tickets legado sembrados sin puente). */
  protected readonly pedido = signal<Pedido | null>(null);
  protected readonly pedidoTipoServicioLabels = computed(() => {
    const p = this.pedido();
    return p ? p.tipoServicio.map((t) => TIPO_SERVICIO_LABELS[t]) : [];
  });
  protected readonly pedidoItems = computed(() => {
    const p = this.pedido();
    return p ? itemsEstimadosDe(p) : [];
  });
  /** Preparación de Herramientas: qué línea trajo herramientas para Bodega, cuál es movilización (informativa) y el resto. */
  protected readonly actividadesPedido = computed(() =>
    agruparActividadesDelPedido(
      this.pedidoItems(),
      this.ticket()?.tools ?? [],
      this.ticket()?.movilizaciones,
      this.ticket()?.avisosPrecarga ?? [],
    ),
  );
  /** Lo que la precarga no pudo traer — el Supervisor lo completa a mano con "Agregar herramienta adicional". */
  protected readonly notaPrecarga = computed(() =>
    notaPrecarga(this.ticket()?.avisosPrecarga ?? []),
  );
  protected readonly etiquetaAviso = ETIQUETA_AVISO_PRECARGA;

  // ── Contexto ──

  protected readonly contextCardTags = computed<DynadrillContextCardTag[]>(() => {
    const t = this.ticket();
    const macro = t?.timelineResumen?.macroEstadoActual;
    const tags: DynadrillContextCardTag[] = [];
    // Cerrado manda sobre el macroestado del timeline (queda en "Aprobado", el de la fase Cierre).
    if (this.ticketCerrado()) tags.push({ label: 'Finalizado', variant: 'success' });
    else if (macro)
      tags.push({ label: MACRO_ESTADO_LABELS[macro], variant: MACRO_ESTADO_TONE[macro] });
    // Tickets sembrados antes de este campo no traen tipoOt — mismo default que ticket-list-page.ts ('venta').
    if (t) tags.push({ label: TIPO_OT_LABELS[t.tipoOt ?? 'venta'], variant: 'info' });
    return tags;
  });

  protected readonly contextCardGroups = computed<DynadrillContextCardItem[][]>(() => {
    const t = this.ticket();
    if (!t) return [];
    const herramientasRecibidas = t.tools.filter((tool) => tool.status === 'recibida').length;
    const ruc = this.pedido()?.clienteRuc;
    // El primer grupo (cliente) ocupa toda la fila — ver `.dyn-context-card--cliente-fila` en styles.scss.
    // Debajo, una columna por tema: dónde y cuándo / responsables / estado.
    return [
      [
        {
          label: 'Cliente',
          value: t.clientName,
          icon: 'users',
          caption: ruc ? `RUC ${ruc}` : undefined,
        },
      ],
      [
        { label: 'Pozo', value: t.wellName, icon: 'location' },
        {
          label: 'Fecha estimada',
          value: t.estimatedDate || '—',
          icon: 'calendar',
          caption: t.estimatedDate
            ? capitalize(
                formatDate(parseLocalDateString(t.estimatedDate), "EEEE, d 'de' MMMM y", 'es'),
              )
            : undefined,
        },
      ],
      [
        { label: 'Supervisor', value: resolveSupervisorName(t) || '—', icon: 'users' },
        { label: 'Operador asignado', value: t.assignedOperator || 'Sin asignar', icon: 'users' },
      ],
      [
        { label: 'Propuesta', value: `V${t.proposalVersion} · aprobada`, icon: 'file-text' },
        {
          label: 'Herramientas',
          value: `${herramientasRecibidas} de ${t.tools.length} recibidas`,
          icon: 'box',
          badgeVariant:
            t.tools.length > 0 && herramientasRecibidas === t.tools.length ? 'success' : undefined,
        },
      ],
    ];
  });

  protected readonly contextCardFooterStatus = computed<DynadrillContextCardTag>(() => {
    const cerrado = this.ticket()?.status === 'cerrado' || this.ticket()?.status === 'aprobado';
    return cerrado
      ? { label: 'Finalizado', variant: 'neutral' }
      : { label: 'Activo', variant: 'success' };
  });

  // ══════════════════════════════════════════════
  // FASE: Preparación de Herramientas
  // ══════════════════════════════════════════════

  protected readonly toolStatusLabel = (status: FcrToolStatus): string =>
    FCR_TOOL_STATUS_LABELS[status];

  /** Estado general de la herramienta (columna "Estado", chip de color) — derivado de los 3 checks, nunca se guarda. */
  protected readonly estadoTag = (
    tool: FcrTool,
  ): {
    label: string;
    variant: (typeof FCR_TOOL_ESTADO_VARIANT)[keyof typeof FCR_TOOL_ESTADO_VARIANT];
  } => {
    const estado = estadoDeHerramienta(tool);
    return { label: FCR_TOOL_ESTADO_LABELS[estado], variant: FCR_TOOL_ESTADO_VARIANT[estado] };
  };

  /** Separa las herramientas de la tanda original de las agregadas después de que el proceso ya había avanzado — se muestran en secciones distintas sin duplicar la lógica de fila. */
  protected readonly originalTools = computed(() =>
    (this.ticket()?.tools ?? []).filter((tool) => !tool.addedLate),
  );
  protected readonly lateTools = computed(() =>
    (this.ticket()?.tools ?? []).filter((tool) => tool.addedLate),
  );

  /**
   * Catálogo real de Inventario (RN-FCR-008A: no se permite seleccionar fuera de él),
   * `categoria='HERRAMIENTAS'` — reemplaza el mock hardcodeado que existía antes.
   * No es `'FISHING & TOOLS'` (151 ítems, con precio real, el catálogo que usa el
   * selector de herramientas del Pedido en `nuevo-pedido-dialog.ts`) a propósito:
   * `HERRAMIENTAS` es el único catálogo con partes/BOM cargado (`ArticuloParte`) —
   * el checklist de inspección de FCR se rompe (queda vacío) si se agrega al ticket
   * una herramienta sin BOM.
   *
   * Ya NO es el flujo primario para agregar herramientas — el ticket ya nace
   * con las que el Pedido pidió (`itemsEstimados` con `esHerramienta`,
   * resueltas por el backend al crear el ticket). Este select solo sirve
   * para la excepción: agregar algo que el Pedido no contempló, o sustituir
   * una herramienta dañada (`origen: 'manual'` en la que se agrega).
   */
  protected readonly herramientasCatalogo = toSignal(
    this.articulosService.list({ categoria: 'HERRAMIENTAS', activo: true }),
    { initialValue: [] },
  );

  protected readonly availableToAdd = computed<DynadrillSelectOption[]>(() => {
    const currentArticuloIds = new Set(
      this.ticket()
        ?.tools.map((t) => t.articuloId)
        .filter((id): id is number => id !== undefined) ?? [],
    );
    return this.herramientasCatalogo()
      .filter((articulo) => !currentArticuloIds.has(articulo.id))
      .map((articulo) => ({
        label: `${articulo.codigo} — ${articulo.nombre}`,
        value: articulo.id,
      }));
  });

  protected readonly toolToAdd = signal<number | null>(null);

  /** Herramienta+columna con el textarea de novedad abierto — a la vez solo una, porque en cualquier momento cada herramienta tiene un único check activo (ver `estadoDeHerramienta`). */
  protected readonly novedadDraftToolId = signal<number | null>(null);
  protected readonly novedadDraftText = signal('');

  protected toggleNovedadDraft(toolId: number): void {
    this.novedadDraftToolId.set(this.novedadDraftToolId() === toolId ? null : toolId);
    this.novedadDraftText.set('');
  }

  protected readonly allToolsReceived = computed(() => {
    const tools = this.ticket()?.tools ?? [];
    return tools.length > 0 && tools.every((t) => t.status === 'recibida');
  });

  /** RN-FCR-005 / SP7: solo se puede declarar la lista completa cuando todo lo agregado ya fue recibido. */
  protected readonly canConfirmToolList = computed(
    () => this.allToolsReceived() && !this.ticket()?.toolListConfirmed,
  );

  protected async confirmToolListComplete(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Enviar a documento de inspección',
      'Declara que no quedan herramientas por agregar. La lista quedará cerrada y podrá subir el documento de inspección.',
    );
    if (!ok) return;
    this.updateTicket(
      this.fcrService.setToolListConfirmed(t.id, true),
      'Lista de herramientas confirmada.',
    );
  }

  /** Corrección puntual: reabre la lista para agregar una herramienta olvidada, antes de continuar a la siguiente fase. */
  protected async reopenToolList(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Reabrir lista de herramientas',
      'Esto permite agregar más herramientas antes de subir el documento de inspección. ¿Continuar?',
      true,
    );
    if (!ok) return;
    this.updateTicket(
      this.fcrService.setToolListConfirmed(t.id, false),
      'Lista de herramientas reabierta.',
    );
  }

  /** Botón embebido en la fila (columna Bodega) — envío de un solo sentido, por herramienta: no existe "reabrir" para volver a quitar una ya enviada. */
  protected sendToolToBodega(toolId: number): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(
      this.fcrService.sendToolToBodega(t.id, toolId),
      'Herramienta enviada a Bodega.',
    );
  }

  protected onToolToAddChange(value: unknown): void {
    this.toolToAdd.set(value as number | null);
  }

  protected addTool(): void {
    const articuloId = this.toolToAdd();
    const t = this.ticket();
    if (!articuloId || !t) return;
    this.fcrService.addTool(t.id, articuloId).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.toolToAdd.set(null);
        this.notify.success('Herramienta agregada a la lista.');
      },
      error: () => this.notify.error('Error', 'No se pudo agregar la herramienta.'),
    });
  }

  /**
   * Para tickets creados antes de configurar los kits, o cuando cambió el Pedido. Muestra el motivo del backend
   * si no se puede (fuera de la fase, lista cerrada…) en vez de un error genérico.
   */
  protected async recargarDesdePedido(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Recargar desde el Pedido',
      'Vuelve a cargar las herramientas de los kits del Pedido. Solo se reemplazan las del Pedido que todavía no se solicitaron a Bodega; las agregadas a mano y las ya enviadas se conservan. ¿Continuar?',
    );
    if (!ok) return;
    this.fcrService.recargarDesdePedido(t.id).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        if (updated.pedidoId) this.cargarPedido(updated.pedidoId);
        this.notify.success('Herramientas recargadas desde el Pedido.');
      },
      error: (err: HttpErrorResponse) =>
        this.notify.error('No se pudo recargar', err.error?.message ?? 'Inténtalo de nuevo.'),
    });
  }

  /** Quita una herramienta agregada por error, antes de que Bodega la prepare. */
  protected async removeTool(toolId: number): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Quitar herramienta',
      'Esta acción no se puede deshacer. ¿Quitar la herramienta de la lista?',
      true,
    );
    if (!ok) return;
    this.updateTicket(this.fcrService.removeTool(t.id, toolId), 'Herramienta quitada de la lista.');
  }

  /** Bodega marca la herramienta como preparada físicamente (FCR-002) — o con novedad, si algo no está bien. */
  protected marcarBodega(toolId: number, novedad?: string): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(
      this.fcrService.setBodegaCheck(t.id, toolId, novedad),
      novedad ? 'Check de Bodega guardado con novedad.' : 'Check de Bodega guardado.',
    );
    this.novedadDraftToolId.set(null);
  }

  /** Botón embebido en la fila (columna Recepción) — Bodega envía formalmente al Supervisor una herramienta ya preparada sin novedad. */
  protected sendToolToSupervisor(toolId: number): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(
      this.fcrService.sendToolToSupervisor(t.id, toolId),
      'Herramienta enviada al Supervisor.',
    );
  }

  /** Supervisor recibe formalmente la herramienta preparada por Bodega (RN-FCR-008C) — o con novedad. El `status` todavía no cambia: falta la revisión del Mecánico. */
  protected marcarRecepcion(toolId: number, novedad?: string): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(
      this.fcrService.setRecepcionCheck(t.id, toolId, novedad),
      novedad ? 'Recepción registrada con novedad.' : 'Recepción registrada.',
    );
    this.novedadDraftToolId.set(null);
  }

  /**
   * Columna Mecánico — 100% automática, derivada del checklist real de
   * inspección (`FcrToolInspection`/`toolInspectionByToolId`, ver más abajo)
   * que se llena en la fase 'inspeccion', posterior a esta. No hay check
   * manual acá: el Mecánico/Soldador todavía ni está asignado en este punto
   * del ticket (RN del usuario — "no se puede pedir que ponga check sin que
   * el Supervisor lo haya asignado"). Solo aplica a la entrada SERVICIOS
   * (VENTA no tiene fase 'inspeccion' ni operador mecánico).
   */
  protected mecanicoInfo(tool: FcrTool): {
    label: string;
    variant: 'success' | 'warning' | 'neutral';
    novedad?: string;
  } {
    if (this.ticket()?.tipoOt !== 'servicio') return { label: 'No aplica', variant: 'neutral' };
    const inspection = this.toolInspectionByToolId().get(tool.id);
    if (!inspection || inspection.estado === 'borrador')
      return { label: 'Se define en Inspección', variant: 'neutral' };
    if (inspection.estado === 'rechazado') {
      return {
        label: 'Con novedad',
        variant: 'warning',
        novedad: inspection.observaciones || 'Checklist rechazado.',
      };
    }
    const defectuosas = inspection.partes.filter(
      (p) => p.visualResultado === 'defectuoso' || p.endResultado === 'defectuoso',
    );
    if (defectuosas.length > 0) {
      return {
        label: 'Con novedad',
        variant: 'warning',
        novedad: `${defectuosas.length} parte(s) con defecto: ${defectuosas.map((p) => p.descripcion).join(', ')}`,
      };
    }
    if (inspection.observaciones.trim()) {
      return { label: 'Con novedad', variant: 'warning', novedad: inspection.observaciones };
    }
    return { label: 'OK', variant: 'success' };
  }

  /**
   * Corrige el check de UN solo paso, sin afectar a otras herramientas ni a
   * envíos/checks de otros pasos de la MISMA herramienta — cada actor
   * deshace solo lo suyo (antes esto revertía `status` en cascada y la
   * herramienta "desaparecía" de la cola del actor que la corregía).
   */
  protected clearBodegaCheck(toolId: number): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(this.fcrService.clearBodegaCheck(t.id, toolId), 'Check de Bodega corregido.');
  }

  protected clearRecepcionCheck(toolId: number): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(
      this.fcrService.clearRecepcionCheck(t.id, toolId),
      'Check de Recepción corregido.',
    );
  }

  protected readonly inspectionUploadState = computed(() =>
    this.ticket()?.inspectionDocumentUploaded ? 'uploaded' : 'idle',
  );

  /**
   * Sube el archivo real del documento de inspección y, recién si eso sale
   * bien, confirma el paso que genera la Guía de Movimiento y la Guía de
   * Revisión (`markInspectionUploaded` — efecto colateral fuera del alcance
   * de fcr-adjuntos-reales, ver comentario en `FcrDomainService.uploadInspectionDocument`).
   */
  protected async onInspectionUploaded(file: NzUploadFile): Promise<void> {
    const t = this.ticket();
    const archivo = this.extraerArchivoValido(file);
    if (!t || !archivo) return;
    const ok = await this.confirmStep(
      'Confirmar documento de inspección',
      'Al confirmar se generan la Guía de Movimiento y la Guía de Revisión. Esta acción no se puede deshacer.',
    );
    if (!ok) return;
    this.fcrService.subirDocumento(t.id, 'inspectionDocument', archivo).subscribe({
      next: () => {
        this.fcrService.markInspectionUploaded(t.id).subscribe({
          next: (updated) => {
            this.ticket.set(updated);
            this.notify.success('Guía de Movimiento y Guía de Revisión generadas.');
          },
          error: () =>
            this.notify.error(
              'Error',
              'El documento se subió, pero no se pudieron generar las guías.',
            ),
        });
      },
      error: () => this.notify.error('Error', 'No se pudo subir el documento de inspección.'),
    });
  }

  /** Documentos de VENTA que el diagrama pide junto al de inspección (Registro de dureza / Registro firmado de QAQC). */
  protected readonly durezaUploadState = computed(() =>
    this.ticket()?.registroDurezaUploaded ? 'uploaded' : 'idle',
  );
  protected readonly qaqcUploadState = computed(() =>
    this.ticket()?.registroQaqcUploaded ? 'uploaded' : 'idle',
  );

  protected onRegistroDurezaUploaded(file: NzUploadFile): void {
    const t = this.ticket();
    const archivo = this.extraerArchivoValido(file);
    if (!t || !archivo) return;
    this.updateTicket(
      this.fcrService.subirDocumento(t.id, 'registroDureza', archivo),
      'Registro de dureza subido.',
    );
  }

  protected onEliminarRegistroDureza(): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(
      this.fcrService.eliminarDocumento(t.id, 'registroDureza'),
      'Registro de dureza eliminado.',
    );
  }

  protected onRegistroQaqcUploaded(file: NzUploadFile): void {
    const t = this.ticket();
    const archivo = this.extraerArchivoValido(file);
    if (!t || !archivo) return;
    this.updateTicket(
      this.fcrService.subirDocumento(t.id, 'registroQaqc', archivo),
      'Registro firmado de QAQC subido.',
    );
  }

  protected onEliminarRegistroQaqc(): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(
      this.fcrService.eliminarDocumento(t.id, 'registroQaqc'),
      'Registro firmado de QAQC eliminado.',
    );
  }

  // ══════════════════════════════════════════════
  // FASE: Asignación de Operador
  // ══════════════════════════════════════════════

  protected openAsignarOperador(): void {
    const t = this.ticket();
    if (!t) return;
    if (!this.coberturaOk()) {
      this.notify.error(
        'Matriz IPERC incompleta',
        `No se puede asignar ni notificar al operador: HSE tiene pendiente aprobar ${actividadesPendientesTexto(
          this.qhseVinculo(),
        )} en la matriz maestra.`,
      );
      return;
    }
    const ref = this.dialog.open<AsignarOperadorDialog, AsignarOperadorDialogData>({
      title: 'Asignar operador',
      content: AsignarOperadorDialog,
      data: { ticketCode: t.code, estimatedDate: t.estimatedDate },
      footer: false,
    });
    ref.afterClose.subscribe((result: AsignarOperadorDialogResult | undefined) => {
      if (!result?.assigned || !result.operatorName) return;
      this.updateTicket(
        this.fcrService.assignOperator(t.id, result.operatorName),
        `Operador asignado: ${result.operatorName}.`,
      );
    });
  }

  // ══════════════════════════════════════════════
  // FASE: Reunión Operativa
  // ══════════════════════════════════════════════

  /** Un solo clic — antes abría un modal con date-picker (precargado a "ahora" igual) + checkbox de confirmación, sin dato adicional real. */
  protected firmarActa(): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(
      this.fcrService.confirmActa(t.id, new Date().toISOString()),
      'Acta de reunión firmada.',
    );
  }

  // ══════════════════════════════════════════════
  // FASE: Ejecución de Campo — bitácora de actividades (Reporte Job)
  // ══════════════════════════════════════════════

  protected readonly activityStart = signal('');
  protected readonly activityEnd = signal('');
  protected readonly activityDetail = signal('');

  // Dos selects (hora/minuto) en vez de un datetime-picker — ese componente solo existe combinado con
  // fecha, y aquí la fecha no aplica (siempre es "hoy"); esto evita mostrar un calendario de más.
  protected readonly hourOptions = HOUR_OPTIONS;
  protected readonly minuteOptions = MINUTE_OPTIONS;

  protected readonly activityStartHour = computed(() => this.activityStart().split(':')[0] || null);
  protected readonly activityStartMinute = computed(
    () => this.activityStart().split(':')[1] || null,
  );
  protected readonly activityEndHour = computed(() => this.activityEnd().split(':')[0] || null);
  protected readonly activityEndMinute = computed(() => this.activityEnd().split(':')[1] || null);

  protected onActivityStartHourChange(hour: string): void {
    this.activityStart.set(`${hour}:${this.activityStartMinute() ?? '00'}`);
  }

  protected onActivityStartMinuteChange(minute: string): void {
    this.activityStart.set(`${this.activityStartHour() ?? '00'}:${minute}`);
  }

  protected onActivityEndHourChange(hour: string): void {
    this.activityEnd.set(`${hour}:${this.activityEndMinute() ?? '00'}`);
  }

  protected onActivityEndMinuteChange(minute: string): void {
    this.activityEnd.set(`${this.activityEndHour() ?? '00'}:${minute}`);
  }

  /** Nunca se captura a mano — se deriva de la hora de inicio/fin, igual que hace el servidor al guardar. */
  protected readonly activityDuration = computed<number | null>(() => {
    const start = this.activityStart();
    const end = this.activityEnd();
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
    return calcDurationHours(start, end);
  });

  /** Fechas del servicio del Pedido: la bitácora no se sale de ahí (el backend también lo valida). */
  protected readonly rangoServicio = computed<RangoServicio>(() => {
    const p = this.pedido();
    const dia = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
    return { desde: dia(p?.fechaInicioServicio), hasta: dia(p?.fechaFinServicio) };
  });
  protected readonly hayRangoServicio = computed(
    () => !!this.rangoServicio().desde || !!this.rangoServicio().hasta,
  );
  protected readonly textoRangoServicio = computed(() => {
    const { desde, hasta } = this.rangoServicio();
    return `del ${desde ? fechaDoc(desde) : '…'} al ${hasta ? fechaDoc(hasta) : '…'}`;
  });

  /**
   * Fecha elegida, o la sugerida: hoy (o el día más cercano dentro del servicio). `todayIso()` no es
   * reactivo, así que al guardar se vuelve a llamar acá — si la página quedó abierta pasada la
   * medianoche, el `computed` todavía tendría "ayer".
   */
  private fechaEfectiva(elegida: Date | null): string {
    return elegida ? toIso(elegida) : fechaSugeridaEnServicio(todayIso(), this.rangoServicio());
  }

  /** Día al que pertenece la actividad. `null` = no se eligió: se sugiere hoy, o el día más cercano dentro del servicio. */
  private readonly activityDateElegida = signal<Date | null>(null);
  private readonly activityFecha = computed(() => this.fechaEfectiva(this.activityDateElegida()));
  protected readonly activityDate = computed(() => parseLocalDateString(this.activityFecha()));
  protected readonly activityFueraDelServicio = computed(() =>
    fueraDelServicio(this.activityFecha(), this.rangoServicio()),
  );
  /** El calendario deshabilita los días fuera del servicio del Pedido. */
  protected readonly diaFueraDelServicio = (dia: Date): boolean =>
    fueraDelServicio(toIso(dia), this.rangoServicio());

  protected onActivityDateChange(value: Date | null): void {
    if (value) this.activityDateElegida.set(value);
  }

  protected readonly canAddActivity = computed(
    () =>
      this.activityDuration() !== null &&
      this.activityDetail().trim().length > 0 &&
      !this.activityFueraDelServicio(),
  );

  protected readonly sortedActivityLog = computed(() =>
    [...(this.ticket()?.activityLog ?? [])].sort((a, b) =>
      (a.date + a.startTime).localeCompare(b.date + b.startTime),
    ),
  );

  /** Bitácora agrupada por día — cada día se envía a Facturación por separado (specs/fcr-bitacora-envio-diario). */
  protected readonly bitacoraDias = computed(() => {
    const t = this.ticket();
    return agruparBitacoraPorDia(t?.activityLog ?? [], t?.diasBitacoraEnviados ?? []);
  });

  protected readonly fechaDia = fechaDoc;
  protected readonly fechaHoraEnvio = fechaHoraDoc;
  protected readonly estadoDia = estadoDiaBitacora;

  protected async enviarDiaBitacora(dia: FcrBitacoraDia): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Enviar día a Facturación',
      `Se enviará el Reporte Job del ${fechaDoc(dia.fecha)} (${dia.actividades.length} actividad(es), ${dia.totalHoras} h) al Pedido ${t.pedidoCode ?? ''}. Facturación podrá revisarlo y corregirlo.`,
    );
    if (!ok) return;
    this.fcrService.enviarDiaBitacora(t.id, dia.fecha).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.notify.success(
          'Día enviado a Facturación',
          `Reporte Job del ${fechaDoc(dia.fecha)} vinculado al Pedido ${t.pedidoCode ?? ''}.`,
        );
      },
      error: (err: HttpErrorResponse) =>
        this.notify.error('Error', err.error?.message ?? 'No se pudo enviar el día a Facturación.'),
    });
  }

  protected async addActivityLogEntry(): Promise<void> {
    const t = this.ticket();
    if (!t || !this.canAddActivity()) return;
    const fecha = this.fechaEfectiva(this.activityDateElegida());
    if (!(await this.confirmarCambioEnDiaEnviado(fecha))) return;
    const author = this.auth.currentUser()?.name ?? this.roleName();
    this.fcrService
      .addActivityLogEntry(t.id, {
        date: fecha,
        startTime: this.activityStart(),
        endTime: this.activityEnd(),
        detail: this.activityDetail(),
        author,
      })
      .subscribe({
        next: (updated) => {
          this.ticket.set(updated);
          this.activityStart.set('');
          this.activityEnd.set('');
          this.activityDetail.set('');
          this.notify.success('Actividad registrada en la bitácora.');
        },
        error: (err: HttpErrorResponse) =>
          this.notify.error('Error', err.error?.message ?? 'No se pudo registrar la actividad.'),
      });
  }

  protected async removeActivityLogEntry(entryId: number): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const fecha = t.activityLog.find((e) => e.id === entryId)?.date;
    const aviso = fecha ? this.avisoDiaEnviado(fecha) : '';
    const ok = await this.confirmStep(
      'Quitar actividad',
      `Esta acción no se puede deshacer. ¿Quitar esta entrada de la bitácora?${aviso}`,
      true,
    );
    if (!ok) return;
    this.updateTicket(
      this.fcrService.removeActivityLogEntry(t.id, entryId),
      'Actividad eliminada de la bitácora.',
    );
  }

  /** Agregar a un día ya enviado cambia el Reporte Job que Facturación tiene — se avisa antes (specs/fcr-bitacora-envio-diario, F3). */
  private async confirmarCambioEnDiaEnviado(fecha: string): Promise<boolean> {
    const aviso = this.avisoDiaEnviado(fecha);
    if (!aviso) return true;
    return this.confirmStep(
      'Modificar día enviado',
      `Vas a agregar una actividad al ${fechaDoc(fecha)}.${aviso}`,
    );
  }

  /** '' si el día no fue enviado; si lo fue, el texto que explica qué pasa en Facturación. */
  private avisoDiaEnviado(fecha: string): string {
    const envio = this.ticket()?.diasBitacoraEnviados?.find((d) => d.fecha === fecha) ?? null;
    switch (estadoDiaBitacora(envio)) {
      case 'pendiente':
        return '';
      case 'corregido_facturacion':
        return ' Este día ya fue corregido por Facturación: tu cambio se aplica sobre su corrección y actualiza el Reporte Job del Pedido.';
      case 'enviado':
        return ' Este día ya está en Facturación: su Reporte Job se actualizará.';
    }
  }

  /** Plantilla CSV (se abre en Excel) con las mismas columnas que ya captura el formulario manual de arriba. */
  protected descargarPlantillaActividades(): void {
    descargarCsv('plantilla-actividades-diarias.csv', [
      ['Fecha', 'Hora inicio', 'Hora fin', 'Detalle de actividad'],
      [
        '2026-09-21',
        '06:00',
        '14:00',
        'Ejemplo: jornada de operación en pozo — reemplace por sus filas reales',
      ],
    ]);
  }

  /**
   * Carga masiva de actividades diarias: parsea el CSV subido y crea una
   * entrada de `activity-log` por fila, reusando el mismo endpoint que ya usa
   * "+ Agregar actividad" — fila por fila y en orden, para no perder ninguna
   * si una falla a mitad de camino.
   */
  protected async onActividadesFileSelected(file: NzUploadFile): Promise<void> {
    const t = this.ticket();
    const archivo = this.extraerArchivoValido(file);
    if (!t || !archivo) return;
    const author = this.auth.currentUser()?.name ?? this.roleName();
    let filas: string[][];
    try {
      filas = await parseCsvFile(archivo);
    } catch {
      this.notify.error('Error', 'No se pudo leer el archivo. Verifica que sea un CSV válido.');
      return;
    }
    const dataRows = filas.slice(1).filter((row) => row.some((cell) => cell.trim().length > 0));
    if (dataRows.length === 0) {
      this.notify.error('Error', 'El archivo no tiene filas de actividades para cargar.');
      return;
    }

    let cargadas = 0;
    const errores: string[] = [];
    for (const [fechaCelda, horaInicio, horaFin, ...detalleParts] of dataRows) {
      const detalle = detalleParts.join(',').trim();
      const fecha = normalizeFechaCsv(fechaCelda);
      if (!fecha || !horaInicio?.trim() || !horaFin?.trim() || !detalle) {
        errores.push(
          fechaCelda?.trim() && !fecha
            ? `Fecha inválida "${fechaCelda.trim()}" — use el formato AAAA-MM-DD.`
            : `Fila incompleta: ${[fechaCelda, horaInicio, horaFin, detalle].join(' / ')}`,
        );
        continue;
      }
      if (fueraDelServicio(fecha, this.rangoServicio())) {
        errores.push(
          `${fechaDoc(fecha)} está fuera del servicio del Pedido (${this.textoRangoServicio()}).`,
        );
        continue;
      }
      try {
        const actualizado = await firstValueFrom(
          this.fcrService.addActivityLogEntry(t.id, {
            date: fecha,
            startTime: horaInicio.trim(),
            endTime: horaFin.trim(),
            detail: detalle,
            author,
          }),
        );
        this.ticket.set(actualizado);
        cargadas++;
      } catch {
        errores.push(`No se pudo cargar: ${fechaCelda} ${horaInicio}-${horaFin}`);
      }
    }

    if (cargadas > 0)
      this.notify.success('Carga masiva completada', `${cargadas} actividad(es) cargada(s).`);
    if (errores.length > 0) this.notify.error('Algunas filas no se cargaron', errores.join(' · '));
  }

  // ══════════════════════════════════════════════
  // FASE: Ejecución de Campo — registro de uso de herramientas (Reporte de Htas.)
  // ══════════════════════════════════════════════

  protected readonly usageToolId = signal<number | null>(null);
  /** Mismo criterio que la bitácora: `null` = no se eligió, se sugiere hoy o el día más cercano dentro del servicio del Pedido. */
  private readonly usageDateElegida = signal<Date | null>(null);
  private readonly usageFecha = computed(() => this.fechaEfectiva(this.usageDateElegida()));
  protected readonly usageDate = computed(() => parseLocalDateString(this.usageFecha()));
  protected readonly usageFueraDelServicio = computed(() =>
    fueraDelServicio(this.usageFecha(), this.rangoServicio()),
  );
  protected readonly usageStatus = signal<FcrToolDailyStatus | null>(null);
  // Completación/trabajo + picker + presión/peso/observación — por herramienta, junto al resto del registro de uso.
  protected readonly usageTipoCompletacion = signal<TipoCompletacion | null>(null);
  protected readonly usageTipoTrabajo = signal<TipoTrabajo | null>(null);
  protected readonly usageTipoPicker = signal<TipoPicker | null>(null);
  protected readonly usagePresion = signal('');
  protected readonly usagePeso = signal('');
  protected readonly usageObservacion = signal('');

  protected readonly usageToolOptions = computed<DynadrillSelectOption[]>(() =>
    (this.ticket()?.tools ?? []).map((tool) => ({ label: tool.name, value: tool.id })),
  );
  protected readonly usageStatusOptions: DynadrillSelectOption[] = (
    Object.entries(FCR_TOOL_DAILY_STATUS_LABELS) as [FcrToolDailyStatus, string][]
  ).map(([value, label]) => ({ label: `${FCR_TOOL_DAILY_STATUS_CODE[value]} — ${label}`, value }));

  protected readonly canAddToolUsage = computed(() => {
    const t = this.ticket();
    if (!t || this.usageToolId() === null || !this.usageStatus()) return false;
    if (
      !this.usageTipoPicker() ||
      !this.usagePresion().trim() ||
      !this.usagePeso().trim() ||
      this.usageFueraDelServicio()
    )
      return false;
    return t.tipoOt === 'servicio' ? !!this.usageTipoTrabajo() : !!this.usageTipoCompletacion();
  });

  protected readonly sortedToolUsageLog = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return [...t.toolUsageLog]
      .sort((a, b) => (a.date + a.toolId).localeCompare(b.date + b.toolId))
      .map((entry) => ({
        ...entry,
        toolName: t.tools.find((tool) => tool.id === entry.toolId)?.name ?? `#${entry.toolId}`,
      }));
  });
  /** Uso de herramientas agrupado por día, igual que la bitácora. */
  protected readonly toolUsagePorDia = computed(() => agruparPorFecha(this.sortedToolUsageLog()));

  protected readonly toolDailyStatusLabel = (status: FcrToolDailyStatus): string =>
    `${FCR_TOOL_DAILY_STATUS_CODE[status]} — ${FCR_TOOL_DAILY_STATUS_LABELS[status]}`;
  protected readonly tipoTrabajoLabel = (value: TipoTrabajo): string => TIPO_TRABAJO_LABELS[value];
  protected readonly tipoCompletacionLabel = (value: TipoCompletacion): string =>
    TIPO_COMPLETACION_LABELS[value];

  protected onUsageDateChange(value: Date | null): void {
    if (value) this.usageDateElegida.set(value);
  }

  protected onUsageToolChange(value: unknown): void {
    this.usageToolId.set(value as number);
  }

  protected onUsageStatusChange(value: unknown): void {
    this.usageStatus.set(value as FcrToolDailyStatus);
  }

  protected async addToolUsageEntry(): Promise<void> {
    const t = this.ticket();
    const toolId = this.usageToolId();
    const status = this.usageStatus();
    if (!t || toolId === null || !status || !this.canAddToolUsage()) return;
    const fecha = this.fechaEfectiva(this.usageDateElegida());
    // Hay un solo registro por herramienta y día: registrar de nuevo lo reemplaza — antes pasaba en silencio.
    const existente = this.sortedToolUsageLog().find(
      (e) => e.toolId === toolId && e.date === fecha,
    );
    if (existente) {
      const ok = await this.confirmStep(
        'Reemplazar registro',
        `${existente.toolName} ya tiene un registro el ${fechaDoc(fecha)} (${this.toolDailyStatusLabel(existente.status)}). Hay un solo registro por herramienta y día: ¿reemplazarlo? Para otro día, cambie la fecha.`,
      );
      if (!ok) return;
    }
    this.fcrService
      .addToolUsageEntry(t.id, {
        toolId,
        date: fecha,
        status,
        // Tickets sembrados antes de tipoOt no lo traen — se tratan como venta (mismo default que en el resto de la página).
        tipoCompletacion:
          t.tipoOt !== 'servicio' ? (this.usageTipoCompletacion() ?? undefined) : undefined,
        tipoTrabajo: t.tipoOt === 'servicio' ? (this.usageTipoTrabajo() ?? undefined) : undefined,
        tipoPicker: this.usageTipoPicker() ?? undefined,
        presion: this.usagePresion().trim(),
        peso: this.usagePeso().trim(),
        observacion: this.usageObservacion().trim() || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.ticket.set(updated);
          this.usageToolId.set(null);
          this.usageStatus.set(null);
          this.usageTipoCompletacion.set(null);
          this.usageTipoTrabajo.set(null);
          this.usageTipoPicker.set(null);
          this.usagePresion.set('');
          this.usagePeso.set('');
          this.usageObservacion.set('');
          this.notify.success('Uso de herramienta registrado.');
        },
        error: (err: HttpErrorResponse) =>
          this.notify.error(
            'Error',
            err.error?.message ?? 'No se pudo registrar el uso de la herramienta.',
          ),
      });
  }

  protected async removeToolUsageEntry(entryId: number): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Quitar registro',
      'Esta acción no se puede deshacer. ¿Quitar este registro de uso?',
      true,
    );
    if (!ok) return;
    this.updateTicket(
      this.fcrService.removeToolUsageEntry(t.id, entryId),
      'Registro de uso eliminado.',
    );
  }

  // ══════════════════════════════════════════════
  // FASE: Ejecución de Campo — tronco compartido: catálogos de completación/trabajo/picker (por herramienta)
  // ══════════════════════════════════════════════

  protected readonly tipoCompletacionOptions: DynadrillSelectOption[] = (
    Object.entries(TIPO_COMPLETACION_LABELS) as [TipoCompletacion, string][]
  ).map(([value, label]) => ({ value, label }));
  protected readonly tipoTrabajoOptions: DynadrillSelectOption[] = (
    Object.entries(TIPO_TRABAJO_LABELS) as [TipoTrabajo, string][]
  ).map(([value, label]) => ({ value, label }));
  protected readonly tipoPickerOptions: DynadrillSelectOption[] = (
    Object.entries(TIPO_PICKER_LABELS) as [TipoPicker, string][]
  ).map(([value, label]) => ({ value, label }));

  /** "Todo el listado está completo" (venta) / "El listado está completo de uso" (servicio). */
  protected async togglePickerUsageListConfirmed(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const confirming = !t.pickerUsageListConfirmed;
    const ok = await this.confirmStep(
      confirming ? 'Confirmar listado completo' : 'Reabrir listado',
      confirming
        ? 'Declara que no queda nada pendiente por registrar.'
        : 'Permite seguir editando antes de finalizar.',
    );
    if (!ok) return;
    this.updateTicket(
      this.fcrService.confirmPickerUsageList(t.id, confirming),
      confirming ? 'Listado de uso declarado completo.' : 'Listado de uso reabierto.',
    );
  }

  // ══════════════════════════════════════════════
  // FASE: Ejecución de Campo — cierre
  // ══════════════════════════════════════════════

  protected async submitFieldReports(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Finalizar ejecución',
      'Confirma que el trabajo de campo finalizó y desea subir los reportes operativos. No podrá modificarlos después.',
    );
    if (!ok) return;
    this.fcrService.submitReports(t.id).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.notify.success('Reportes de campo subidos. Pendientes de revisión del Supervisor.');
        this.advancePhase('revision_reportes');
      },
      error: () => this.notify.error('Error', 'No se pudieron subir los reportes de campo.'),
    });
  }

  // ══════════════════════════════════════════════
  // FASE: Revisión de Reportes
  // ══════════════════════════════════════════════

  protected openReporteJob(): void {
    const t = this.ticket();
    if (!t) return;
    this.documentoPdf.abrir({
      titulo: 'Reporte de Trabajo — Vista de impresión',
      component: ReporteJobHoja,
      inputs: {
        header: {
          code: t.code,
          cliente: t.clientName,
          pozo: t.wellName,
          supervisor: resolveSupervisorName(t),
          operador: t.assignedOperator,
        },
        log: t.activityLog,
      },
      nombreArchivo: `Reporte diario de actividades ${t.code}`,
    });
  }

  /** Encuesta de satisfacción con los datos del servicio; calificaciones, nombres y firmas van en blanco (la llena el cliente). */
  protected descargarEncuesta(): void {
    const t = this.ticket();
    if (!t) return;
    this.documentoPdf.abrir({
      titulo: `Encuesta de satisfacción — ${t.code}`,
      component: EncuestaSatisfaccionHoja,
      inputs: {
        datos: {
          numeroOtq: t.pedidoCode ?? t.code,
          cliente: t.clientName,
          fecha: new Date().toLocaleDateString('es-EC'),
          pozo: t.wellName,
          bloque: '',
        },
      },
      nombreArchivo: `Encuesta de satisfacción ${t.code}`,
    });
  }

  protected openReporteHerramientas(): void {
    const t = this.ticket();
    if (!t) return;
    this.documentoPdf.abrir({
      titulo: 'Reporte de Herramientas — Vista de impresión',
      component: ReporteHerramientasHoja,
      inputs: {
        header: {
          code: t.code,
          cliente: t.clientName,
          pozo: t.wellName,
          supervisor: resolveSupervisorName(t),
          operador: t.assignedOperator,
        },
        tools: t.tools.map((tool) => ({ id: tool.id, name: tool.name })),
        usageLog: t.toolUsageLog,
      },
      orientacion: 'landscape',
      nombreArchivo: `Reporte de Herramientas ${t.code}`,
    });
  }

  protected readonly reportsDecision = signal<DynadrillApprovalDecision>(null);
  protected readonly rejectionNote = signal('');

  protected async onReportsDecisionChange(decision: DynadrillApprovalDecision): Promise<void> {
    if (decision === 'approved') {
      const ok = await this.confirmStep(
        'Aprobar reportes',
        'El ticket continuará a Control de Retorno de Herramientas. Esta acción no se puede deshacer.',
      );
      if (!ok) return;
      this.reportsDecision.set(decision);
      this.confirmReportsReview('approved');
      return;
    }
    this.reportsDecision.set(decision);
  }

  protected async confirmRejection(): Promise<void> {
    if (!this.rejectionNote().trim()) return;
    const ok = await this.confirmStep(
      'Solicitar corrección',
      'Se notificará al Operador para corregir los reportes.',
    );
    if (!ok) return;
    this.confirmReportsReview('rejected', this.rejectionNote());
  }

  private confirmReportsReview(decision: 'approved' | 'rejected', observation?: string): void {
    const t = this.ticket();
    if (!t) return;
    this.fcrService.reviewReports(t.id, decision, observation).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.reportsDecision.set(null);
        this.rejectionNote.set('');
        if (decision === 'approved') {
          this.enviarReportesAFacturacion(updated);
          this.advancePhase('control_retorno');
        } else {
          this.notify.success('Corrección solicitada al Operador.');
        }
      },
      // Si falla, `reportsDecision` vuelve a null — sin esto, el aviso "El ticket
      // continúa a..." (que es solo la vista previa de la consecuencia, ligada
      // a la opción marcada) se quedaba pegado en pantalla como si algo se
      // hubiera completado, aunque la acción real nunca se haya guardado.
      error: () => {
        this.reportsDecision.set(null);
        this.notify.error('Error', 'No se pudo registrar la revisión de reportes.');
      },
    });
  }

  /** Puente FCR → Facturación: al aprobar los reportes, se empujan al Pedido vinculado. */
  private enviarReportesAFacturacion(t: FcrTicket): void {
    if (!t.pedidoCode) return;
    const header = {
      code: t.code,
      cliente: t.clientName,
      pozo: t.wellName,
      supervisor: resolveSupervisorName(t),
      operador: t.assignedOperator,
    };

    const porDia = new Map<string, typeof t.activityLog>();
    for (const e of t.activityLog) {
      const arr = porDia.get(e.date) ?? [];
      arr.push(e);
      porDia.set(e.date, arr);
    }
    for (const [fecha, actividades] of porDia) {
      this.docsBridge.pushReporteJob({
        pedidoCode: t.pedidoCode,
        origen: 'fcr',
        ticketOperativoId: t.id,
        fecha,
        firmadoPor: resolveSupervisorName(t),
        header,
        actividades,
      });
    }

    if (t.toolUsageLog.length) {
      this.docsBridge.pushReporteHerramientas({
        pedidoCode: t.pedidoCode,
        origen: 'fcr',
        ticketOperativoId: t.id,
        firmadoPor: resolveSupervisorName(t),
        header,
        herramientas: t.tools.map((tool) => ({ id: tool.id, name: tool.name })),
        usoHerramientas: t.toolUsageLog,
      });
    }
    this.notify.success('Reportes enviados a Facturación', `Vinculados al Pedido ${t.pedidoCode}.`);
  }

  // ══════════════════════════════════════════════
  // FASE: Control de Retorno
  // ══════════════════════════════════════════════

  protected readonly pendingReturnTools = computed(() =>
    (this.ticket()?.tools ?? []).filter((t) => t.status === 'recibida'),
  );

  protected async markToolReturned(toolId: number): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Confirmar devolución',
      'Confirma que esta herramienta fue devuelta y conciliada contra la Guía de Movimiento. No podrá deshacer este paso.',
    );
    if (!ok) return;
    this.updateTicket(
      this.fcrService.setToolStatus(t.id, toolId, 'devuelta'),
      'Herramienta marcada como devuelta.',
    );
  }

  protected openHerramientaFaltante(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<HerramientaFaltanteDialog, HerramientaFaltanteDialogData>({
      title: 'Registrar herramienta faltante',
      content: HerramientaFaltanteDialog,
      data: { ticketCode: t.code, tools: this.pendingReturnTools() },
      footer: false,
    });
    ref.afterClose.subscribe((result: HerramientaFaltanteDialogResult | undefined) => {
      if (!result?.registered || result.toolId === undefined || !result.reason) return;
      this.updateTicket(
        this.fcrService.registerMissingTool(t.id, result.toolId, result.reason),
        'Herramienta faltante registrada.',
      );
    });
  }

  protected openGuiaSalidaBodega(tool: FcrTool): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<GuiaSalidaBodegaDialog, GuiaSalidaBodegaDialogData>({
      title: 'Guía de Salida por Bodega',
      content: GuiaSalidaBodegaDialog,
      data: { ticketCode: t.code, clientName: t.clientName, toolName: tool.name },
      footer: false,
    });
    ref.afterClose.subscribe((result: GuiaSalidaBodegaDialogResult | undefined) => {
      if (!result?.generated) return;
      this.updateTicket(
        this.fcrService.generateBodegaExitGuide(t.id, tool.id),
        'Guía de Salida de Bodega generada.',
      );
    });
  }

  protected readonly needsBodegaExitGuide = computed(() =>
    (this.ticket()?.tools ?? []).some(
      (t) =>
        t.status === 'faltante' &&
        t.missingReason?.startsWith('Venta de herramienta complementaria'),
    ),
  );

  protected readonly toolReturnControlComplete = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    const allSettled = t.tools.every(
      (tool) => tool.status === 'devuelta' || tool.status === 'faltante',
    );
    const bodegaGuideOk = !this.needsBodegaExitGuide() || t.bodegaExitGuideGenerated;
    return allSettled && bodegaGuideOk;
  });

  // ══════════════════════════════════════════════
  // FASE: Cierre — dashboard de resumen
  // ══════════════════════════════════════════════

  protected readonly phaseLabel = (phase: FcrPhase): string => FCR_PHASE_LABELS[phase];

  /**
   * Totales para los PDF de cierre (el dashboard en pantalla se quitó). "Documentos subidos" cuenta solo los 6
   * flags de documento con archivo real (3 de la rama SERVICIOS + 3 de la
   * rama VENTA) — los otros 6 hitos (`workReportUploaded`,
   * `toolReportUploaded`, `finalReviewGuideUploaded` (ya no se muestra: no existe en el proceso real),
   * `movementGuideGenerated`, `reviewGuideGenerated`,
   * `bodegaExitGuideGenerated`) nunca tuvieron opción real de "subir un
   * documento" (se marcan solos como efecto de otra acción), así que no
   * cuentan como documento acá — evita que el resumen de cierre los muestre
   * como si faltara adjuntar algo que jamás se pudo adjuntar.
   */
  protected readonly closureStats = computed(() => {
    const t = this.ticket();
    if (!t) return { documentsCount: 0, totalHours: 0 };
    const docFlags = [
      t.formularioInspeccionExternoUploaded,
      t.formatoDimensionamientoServicioUploaded,
      t.formatoDurezaServicioUploaded,
      t.registroDurezaUploaded,
      t.registroQaqcUploaded,
      t.inspectionDocumentUploaded,
    ];
    return {
      documentsCount: docFlags.filter(Boolean).length,
      totalHours: t.activityLog.reduce((sum, e) => sum + e.durationHours, 0),
    };
  });

  /**
   * Fases del resumen con inicio, finalización y duración — mismos tramos que la tarjeta del avance del
   * ticket, para que el PDF y la pantalla digan lo mismo. Tickets sin `timelineResumen`: historial de fases.
   */
  private fasesDelResumen(): ReporteCierrePdfPhaseRow[] {
    const t = this.ticket();
    if (!t) return [];
    const tramos = t.timelineResumen?.tramos ?? [];
    if (tramos.length) {
      return tramos.map((tramo) => ({
        label: this.phaseLabel(tramo.fase as FcrPhase),
        responsable: tramo.actorNombre ?? '—',
        rol: tramo.actorRolLabel ?? tramo.actorRol ?? '—',
        inicio: tramo.inicio,
        fin: tramo.fin,
        duracionMs: tramo.fin ? tramo.duracionMs : undefined,
      }));
    }
    return t.phaseHistory.map((p) => ({
      label: this.phaseLabel(p.phase),
      responsable: p.approvedBy,
      rol: p.approvedByRole,
      inicio: p.date,
    }));
  }

  /** Abre la vista imprimible del resumen de cierre — datos derivados del ticket completo, sin llamada adicional al backend. */
  protected openReporteCierre(): void {
    const t = this.ticket();
    if (!t) return;

    // Reporte de trabajo y uso de herramientas completos, por día (no nombres de archivo).
    const bitacora = agruparBitacoraPorDia(t.activityLog, []).map((dia) => ({
      fecha: fechaDiaDoc(dia.fecha),
      totalHoras: dia.totalHoras,
      actividades: dia.actividades.map((a) => ({
        startTime: a.startTime,
        endTime: a.endTime,
        durationHours: a.durationHours,
        detail: a.detail,
      })),
    }));
    const usoHerramientas = this.toolUsagePorDia().map((dia) => ({
      fecha: fechaDiaDoc(dia.fecha),
      usos: dia.items.map((u) => ({
        herramienta: u.toolName,
        estado: this.toolDailyStatusLabel(u.status),
        tipo: u.tipoTrabajo
          ? this.tipoTrabajoLabel(u.tipoTrabajo)
          : u.tipoCompletacion
            ? this.tipoCompletacionLabel(u.tipoCompletacion)
            : '—',
        picker: u.tipoPicker ?? '—',
        presion: u.presion ?? '—',
        peso: u.peso ?? '—',
        observacion: u.observacion ?? '—',
      })),
    }));

    this.dialog.open<ReporteCierrePdfDialog, ReporteCierrePdfDialogData>({
      title: 'Resumen de Cierre — Vista de impresión',
      content: ReporteCierrePdfDialog,
      data: {
        header: {
          code: t.code,
          cliente: t.clientName,
          pozo: t.wellName,
          supervisor: resolveSupervisorName(t),
          operador: t.assignedOperator,
        },
        tipoOtLabel: t.tipoOt === 'servicio' ? 'Servicio' : 'Venta',
        estimatedDate: t.estimatedDate,
        phases: this.fasesDelResumen(),
        tools: t.tools.map((tool) => ({
          id: tool.id,
          name: tool.name,
          status: this.toolStatusLabel(tool.status),
        })),
        bitacora,
        usoHerramientas,
        tipoUsoLabel: t.tipoOt === 'servicio' ? 'Tipo de trabajo' : 'Tipo de completación',
        totalHours: this.closureStats().totalHours,
        observationsCount: t.observations.length,
        nombreArchivo: `Resumen de cierre ${t.code}`,
      },
      footer: false,
      width: '1100px',
    });
  }

  // ══════════════════════════════════════════════
  // FASE: Cierre
  // ══════════════════════════════════════════════

  /** "Ver prefactura": la ve el Supervisor (y Jefe de Base) en el cierre del ticket, para llevarla a firmar al Company Man. */
  protected readonly puedeVerPrefactura = computed(() => {
    const t = this.ticket();
    return (
      !!t &&
      ['Supervisor', 'Jefe de Base', 'Superadmin'].includes(this.roleName()) &&
      (t.currentPhase === 'cierre' || t.status === 'cerrado')
    );
  });

  protected verPrefactura(): void {
    const t = this.ticket();
    if (!t) return;
    this.dialog.open<TicketPrefacturaDialog, TicketPrefacturaDialogData>({
      title: 'Prefactura del servicio',
      content: TicketPrefacturaDialog,
      data: { linea: 'fcr', ticketId: t.id, ticketCode: t.code },
      footer: false,
      width: 1000,
    });
  }

  protected openCierreTicket(): void {
    const t = this.ticket();
    if (!t || !this.isMyTurn()) return;
    if (this.faltaActaEntrega()) {
      this.notify.error(
        'Acta de Entrega pendiente',
        'Carga el Acta de Entrega de Locación (DYN-PMP-RE-027) firmada por el cliente en «Documentos QHSE» antes de cerrar el ticket.',
      );
      return;
    }
    const returned = t.tools.filter((tool) => tool.status === 'devuelta').length;
    const enviados = t.tools.filter(
      (tool) => this.toolInspectionByToolId().get(tool.id)?.estado === 'enviado',
    ).length;
    const ref = this.dialog.open<CierreTicketDialog, CierreTicketDialogData>({
      title: 'Cerrar ticket FCR',
      content: CierreTicketDialog,
      data: {
        ticketCode: t.code,
        clientName: t.clientName,
        toolsReturnedSummary: `${returned} de ${t.tools.length} devueltas`,
        documentsSummary: `${this.closureStats().documentsCount} documentos cargados`,
        checklistsSummary:
          t.tipoOt === 'servicio' ? `${enviados} de ${t.tools.length} enviados` : 'No aplica',
      },
      footer: false,
    });
    ref.afterClose.subscribe((result: CierreTicketDialogResult | undefined) => {
      if (!result?.closed) return;
      this.fcrService.closeTicket(t.id).subscribe({
        next: (updated) => {
          this.ticket.set(updated);
          this.notify.success('Ticket cerrado. Encuesta de satisfacción enviada al cliente.');
          // Al finalizar, se abre la prefactura para registrar la firma del Company Man (queda firmada en Facturación).
          if (this.puedeVerPrefactura()) {
            this.ticketPrefactura.necesitaFirma('fcr', t.id).subscribe((necesita) => {
              if (necesita) this.verPrefactura();
            });
          }
        },
        error: (err: { error?: { message?: string } }) =>
          this.notify.error('Error', err?.error?.message ?? 'No se pudo cerrar el ticket.'),
      });
    });
  }

  // ══════════════════════════════════════════════
  // Corrección de propuesta (FCR-001)
  // ══════════════════════════════════════════════

  protected openSolicitarCorreccion(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<SolicitarCorreccionDialog, SolicitarCorreccionDialogData>({
      title: 'Solicitar corrección',
      content: SolicitarCorreccionDialog,
      data: { ticketCode: t.code, proposalVersion: t.proposalVersion },
      footer: false,
    });
    ref.afterClose.subscribe((result: SolicitarCorreccionDialogResult | undefined) => {
      if (!result?.requested || !result.observations) return;
      this.fcrService.requestCorrection(t.id, result.observations).subscribe({
        next: (updated) => {
          this.ticket.set(updated);
          this.notify.success('Corrección solicitada a Ingeniería de Ventas FCR.');
        },
        error: () => this.notify.error('Error', 'No se pudo solicitar la corrección.'),
      });
    });
  }

  /** Ingeniería de Ventas FCR devuelve el turno al Supervisor tras aplicar la corrección solicitada. */
  protected async resolveCorrection(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Reenviar a Supervisor',
      'Confirma que la corrección solicitada ya fue aplicada. El Supervisor podrá volver a revisar la información.',
    );
    if (!ok) return;
    const author = this.auth.currentUser();
    this.fcrService
      .resolveCorrection(
        t.id,
        author?.name ?? 'Ingeniería de Ventas FCR',
        'Corrección aplicada según lo solicitado.',
      )
      .subscribe({
        next: (updated) => {
          this.ticket.set(updated);
          this.notify.success('Corrección reenviada al Supervisor.');
        },
        error: () => this.notify.error('Error', 'No se pudo reenviar la corrección al Supervisor.'),
      });
  }

  // ══════════════════════════════════════════════
  // Entrada SERVICIOS — tipo_operador (tabla de operadores inline, sin modal)
  // ══════════════════════════════════════════════

  /** Para el resumen de solo lectura de esta fase una vez completada (pantalla acumulativa). */
  protected readonly tipoOperadorLabels = TIPO_OPERADOR_LABELS;
  protected readonly tipoOperadorSeleccionado = signal<TipoOperador | null>(null);
  /** Persona elegida en la tabla — nombre concreto, no solo la especialidad. */
  protected readonly operadorMecanicoSeleccionado = signal<string | null>(null);

  protected readonly mecanicoFiltroOptions: DynadrillSelectOption[] = [
    { label: 'Todos', value: 'todos' },
    ...(Object.entries(TIPO_OPERADOR_LABELS) as [TipoOperador, string][]).map(([value, label]) => ({
      value,
      label,
    })),
  ];
  protected readonly mecanicoFiltro = signal<TipoOperador | 'todos'>('todos');
  /** Roster simulado — sin backend real de personal todavía (mismo criterio que `OPERATOR_SCHEDULE` de `AsignarOperadorDialog`). */
  protected readonly mecanicoRoster: MechanicOperator[] = [
    { name: 'F. Ortega', tipo: 'mecanico', disponible: true },
    { name: 'L. Andrade', tipo: 'mecanico', disponible: false },
    { name: 'S. Moreno', tipo: 'mecanico', disponible: true },
    { name: 'D. Herrera', tipo: 'soldador', disponible: true },
    { name: 'C. Benítez', tipo: 'soldador', disponible: true },
    { name: 'N. Castillo', tipo: 'soldador', disponible: false },
  ];
  protected readonly mecanicoFilasVisibles = computed(() => {
    const f = this.mecanicoFiltro();
    return f === 'todos' ? this.mecanicoRoster : this.mecanicoRoster.filter((op) => op.tipo === f);
  });

  protected onMecanicoFiltroChange(value: unknown): void {
    this.mecanicoFiltro.set(value as TipoOperador | 'todos');
  }

  /** Un solo paso: elegir la fila ya fija tipo + operador (antes eran 2 pasos con un modal aparte). */
  protected seleccionarOperadorMecanico(op: MechanicOperator): void {
    if (!op.disponible) return;
    this.tipoOperadorSeleccionado.set(op.tipo);
    this.operadorMecanicoSeleccionado.set(op.name);
  }

  protected async confirmTipoOperador(): Promise<void> {
    const t = this.ticket();
    const tipo = this.tipoOperadorSeleccionado();
    const operatorName = this.operadorMecanicoSeleccionado();
    if (!t || !tipo || !operatorName) return;
    const ok = await this.confirmStep(
      'Confirmar tipo de operador',
      'El ticket avanzará al Formulario de Inspección.',
    );
    if (!ok) return;
    this.fcrService.setTipoOperador(t.id, tipo).subscribe({
      next: () => {
        this.fcrService.assignMechanicOperator(t.id, operatorName).subscribe({
          next: (updated) => {
            this.ticket.set(updated);
            this.advancePhase('inspeccion');
          },
          error: () =>
            this.notify.error('Error', 'No se pudo guardar el operador mecánico asignado.'),
        });
      },
      error: () => this.notify.error('Error', 'No se pudo guardar el tipo de operador.'),
    });
  }

  // ══════════════════════════════════════════════
  // Entrada SERVICIOS — inspeccion / aprobacion_supervisor_operaciones
  // ══════════════════════════════════════════════

  protected readonly formularioExternoUploadState = computed(() =>
    this.ticket()?.formularioInspeccionExternoUploaded ? 'uploaded' : 'idle',
  );
  protected readonly dimensionamientoServicioUploadState = computed(() =>
    this.ticket()?.formatoDimensionamientoServicioUploaded ? 'uploaded' : 'idle',
  );
  protected readonly durezaServicioUploadState = computed(() =>
    this.ticket()?.formatoDurezaServicioUploaded ? 'uploaded' : 'idle',
  );

  protected readonly inspeccionServicioCompleta = computed(() => {
    const t = this.ticket();
    return (
      !!t?.formularioInspeccionExternoUploaded &&
      !!t?.formatoDimensionamientoServicioUploaded &&
      !!t?.formatoDurezaServicioUploaded
    );
  });

  // ── Checklist de inspección por herramienta (fcr-checklist-inspeccion) ──
  // Se llena una vez por cada FcrTool del ticket, exclusivo de la rama
  // SERVICIOS. Convive con los 3 documentos de arriba — no lo reemplaza.

  protected readonly toolInspections = signal<FcrToolInspection[]>([]);

  private readonly toolInspectionByToolId = computed(
    () => new Map(this.toolInspections().map((i) => [i.toolId, i])),
  );

  protected toolInspectionEstado(toolId: number): string | null {
    return this.toolInspectionByToolId().get(toolId)?.estado ?? null;
  }

  protected toolChecklistButtonLabel(toolId: number): string {
    const inspection = this.toolInspectionByToolId().get(toolId);
    if (!inspection) return 'Iniciar checklist';
    if (inspection.estado === 'enviado' || inspection.estado === 'aprobado') return 'Ver checklist';
    // 'borrador': si ya está todo llenado y le toca firmar al rol actual, el botón lo dice explícito en vez de un genérico "Continuar".
    const rolPendiente = FCR_TOOL_INSPECTION_FIRMA_ROLES.find(
      (rol) => !inspection.firmas[rol]?.firmado,
    );
    if (rolPendiente) {
      const anterior = FCR_TOOL_INSPECTION_FIRMA_ROL_ANTERIOR[rolPendiente];
      const pasoHabilitado = !anterior || !!inspection.firmas[anterior]?.firmado;
      if (
        pasoHabilitado &&
        FCR_TOOL_INSPECTION_FIRMA_ROLES_REQUERIDOS[rolPendiente].includes(this.roleName())
      ) {
        return 'Firmar checklist';
      }
    }
    return 'Continuar checklist';
  }

  /** RN (fcr-checklist-inspeccion): la fase no avanza a Aprobación de Supervisor si falta el checklist "enviado" de alguna herramienta. */
  protected readonly allChecklistsEnviados = computed(() => {
    const tools = this.ticket()?.tools ?? [];
    return (
      tools.length > 0 &&
      tools.every((tool) => this.toolInspectionByToolId().get(tool.id)?.estado === 'enviado')
    );
  });

  /** Nombres de las herramientas cuyo checklist todavía no está "enviado" — para nombrarlas en vez de un aviso genérico. */
  protected readonly checklistsPendientesNombres = computed(() => {
    const tools = this.ticket()?.tools ?? [];
    return tools
      .filter((tool) => this.toolInspectionByToolId().get(tool.id)?.estado !== 'enviado')
      .map((tool) => tool.name);
  });

  protected readonly puedeEnviarInspeccionServicio = computed(
    () => this.inspeccionServicioCompleta() && this.allChecklistsEnviados(),
  );

  /**
   * En 'inspeccion' el rol "responsable" de la fase (Operador, fijo en
   * `FCR_PHASE_ROLE`) no alcanza para el banner: una vez que el Operador ya
   * firmó "Reparado por" de una herramienta, lo que realmente falta es la
   * firma de Supervisor o QHSE — mostrar "Operador" ahí es directamente
   * incorrecto (bug reportado). Recorre cada herramienta y junta el rol
   * pendiente CON el nombre de la herramienta — el checklist es por
   * herramienta, así que "firmé como Supervisor" en una herramienta no
   * resuelve la firma de Supervisor pendiente en otra distinta; sin el
   * nombre de la herramienta el mensaje parece "no cambió nada" (bug
   * reportado: "el operador ya firmó, faltan las otras firmas" seguía
   * mostrando el mismo rol tras firmar, porque era el mismo rol pero en
   * OTRA herramienta).
   */
  protected readonly rolesConAccionPendienteEnInspeccion = computed(() => {
    const porRol = new Map<string, string[]>();
    const agregar = (rol: string, toolName: string) => {
      const nombres = porRol.get(rol) ?? [];
      if (!nombres.includes(toolName)) nombres.push(toolName);
      porRol.set(rol, nombres);
    };
    for (const tool of this.ticket()?.tools ?? []) {
      const inspection = this.toolInspectionByToolId().get(tool.id);
      if (!inspection) {
        agregar('Operador FCR', tool.name); // checklist ni siquiera iniciado
        continue;
      }
      if (inspection.estado === 'enviado' || inspection.estado === 'aprobado') continue;
      const rolPendiente = FCR_TOOL_INSPECTION_FIRMA_ROLES.find(
        (rol) => !inspection.firmas[rol]?.firmado,
      );
      if (!rolPendiente) continue;
      const anterior = FCR_TOOL_INSPECTION_FIRMA_ROL_ANTERIOR[rolPendiente];
      const habilitado = !anterior || !!inspection.firmas[anterior]?.firmado;
      if (habilitado)
        agregar(FCR_TOOL_INSPECTION_FIRMA_ROLES_REQUERIDOS[rolPendiente][0], tool.name);
    }
    return [...porRol.entries()].map(([rol, toolNames]) => `${rol} (${toolNames.join(', ')})`);
  });

  protected readonly bannerAccionEsperada = computed(() => {
    if (this.ticketCerrado())
      return 'Ticket finalizado — solo lectura. Los documentos y reportes siguen disponibles para ver y descargar.';
    if (this.currentPhase() === 'inspeccion') {
      const roles = this.rolesConAccionPendienteEnInspeccion();
      if (roles.length > 0) return `Esperando firma de checklist: ${roles.join(', ')}`;
    }
    // El acta ya la firmó el Supervisor — si sigue bloqueado es por el gate
    // QHSE (HSE-PLAN-001 / HSE-SITIO-001), que no es acción del Supervisor.
    if (
      this.currentPhase() === 'reunion_operativa' &&
      this.ticket()?.operationalActaSigned &&
      !this.ptwFirmadoOk()
    ) {
      if (!this.coberturaOk())
        return 'Esperando acción de HSE: aprobar actividades pendientes en la Matriz IPERC';
      const ptw = this.qhseVinculo()?.ptw;
      return ptw
        ? `Esperando acción de HSE: validación de los documentos del PTW ${ptw.code} (HSE-SITIO-001)`
        : 'Esperando acción de HSE: apertura del PTW / Recibimiento de Sitio';
    }
    return `Esperando acción de: ${this.responsibleRole()}`;
  });

  private loadToolInspections(ticketId: number): void {
    this.toolInspeccionesService.listByTicket(ticketId).subscribe({
      next: (list) => this.toolInspections.set(list),
      error: () =>
        this.notify.error('Error', 'No se pudieron cargar los checklists de inspección.'),
    });
  }

  protected openChecklistHerramienta(tool: FcrTool): void {
    const t = this.ticket();
    if (!t || !tool.articuloId) return;
    const ref = this.dialog.open<ChecklistHerramientaDialog, ChecklistHerramientaDialogData>({
      title: 'Checklist de inspección',
      content: ChecklistHerramientaDialog,
      data: {
        ticketId: t.id,
        toolId: tool.id,
        articuloId: tool.articuloId,
        toolName: tool.name,
        operadorCampoAsignado: t.assignedOperator,
        cliente: t.clientName,
        pozo: t.wellName,
      },
      footer: false,
      width: '90vw',
    });
    ref.afterClose.subscribe(() => {
      // Se recarga la lista completa aunque el diálogo se haya cerrado sin
      // "Enviar" — "Guardar borrador" también persiste cambios en backend.
      this.loadToolInspections(t.id);
    });
  }

  protected onSubirInspeccionServicio(
    documento: 'formularioExterno' | 'dimensionamiento' | 'dureza',
    file: NzUploadFile,
  ): void {
    const t = this.ticket();
    const archivo = this.extraerArchivoValido(file);
    if (!t || !archivo) return;
    this.updateTicket(
      this.fcrService.subirDocumento(t.id, CAMPO_DOCUMENTO_SERVICIO[documento], archivo),
      'Documento subido.',
    );
  }

  protected readonly simulandoCargaDocumentos = signal(false);

  /** Los 3 documentos de esta sección que todavía no tienen archivo cargado — controla si el botón de carga rápida tiene algo que hacer. */
  protected readonly documentosServicioPendientes = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const pendientes: Array<'formularioExterno' | 'dimensionamiento' | 'dureza'> = [];
    if (!t.formularioInspeccionExternoUploaded) pendientes.push('formularioExterno');
    if (!t.formatoDimensionamientoServicioUploaded) pendientes.push('dimensionamiento');
    if (!t.formatoDurezaServicioUploaded) pendientes.push('dureza');
    return pendientes;
  });

  /**
   * Carga rápida (demo/QA): genera un archivo de prueba y lo sube a cada uno
   * de los documentos de esta sección que todavía no tenga uno — evita tener
   * que buscar 3 archivos reales a mano solo para avanzar el flujo. Secuencial
   * (no `forkJoin`) para no pisarse: cada subida deja el ticket actualizado y
   * la siguiente parte de ese estado, no del snapshot inicial.
   */
  protected async simularCargaRapidaDocumentos(): Promise<void> {
    const t = this.ticket();
    const pendientes = this.documentosServicioPendientes();
    if (!t || pendientes.length === 0 || this.simulandoCargaDocumentos()) return;

    this.simulandoCargaDocumentos.set(true);
    try {
      for (const doc of pendientes) {
        const archivo = new File(
          [
            `Documento simulado — ${CAMPO_DOCUMENTO_SERVICIO[doc]} — ticket ${t.code} — ${new Date().toISOString()}`,
          ],
          `${doc}-simulado.txt`,
          { type: 'text/plain' },
        );
        const actualizado = await firstValueFrom(
          this.fcrService.subirDocumento(t.id, CAMPO_DOCUMENTO_SERVICIO[doc], archivo),
        );
        this.ticket.set(actualizado);
      }
      this.notify.success(
        'Carga rápida completa',
        `${pendientes.length} documento(s) simulado(s) cargado(s).`,
      );
    } catch {
      this.notify.error('Error', 'No se pudo completar la carga rápida. Inténtalo de nuevo.');
    } finally {
      this.simulandoCargaDocumentos.set(false);
    }
  }

  protected onEliminarInspeccionServicio(
    documento: 'formularioExterno' | 'dimensionamiento' | 'dureza',
  ): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(
      this.fcrService.eliminarDocumento(t.id, CAMPO_DOCUMENTO_SERVICIO[documento]),
      'Documento eliminado.',
    );
  }

  /**
   * Previsualiza uno de los 6 documentos de FCR en una pestaña nueva (sin
   * forzar descarga) — el navegador renderiza PDF/imagen directo; otros
   * formatos (doc/xls) el propio navegador decide si los puede mostrar o los
   * descarga, no hay forma de forzar una vista previa universal para esos.
   * `fcrService.descargarDocumento` pasa por `HttpClient` (Bearer incluido);
   * un `<a href>`/`window.open` directo al endpoint no lo llevaría.
   */
  protected previsualizarDocumento(campo: CampoDocumentoFcr): void {
    const t = this.ticket();
    if (!t) return;
    this.fcrService.descargarDocumento(t.id, campo).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el documento.'),
    });
  }

  protected async confirmEnviarInspeccionServicio(): Promise<void> {
    if (!this.puedeEnviarInspeccionServicio()) return;
    const ok = await this.confirmStep(
      'Enviar a Supervisor',
      'El ticket avanzará a Aprobación de Supervisor de Operaciones.',
    );
    if (!ok) return;
    this.advancePhase('aprobacion_supervisor_operaciones');
  }

  protected readonly inspeccionDecision = signal<DynadrillApprovalDecision>(null);
  protected readonly inspeccionRejectionNote = signal('');

  protected async onInspeccionDecisionChange(decision: DynadrillApprovalDecision): Promise<void> {
    if (decision === 'approved') {
      const ok = await this.confirmStep(
        'Aprobar inspección',
        'El ticket continuará a Asignación de Operador.',
      );
      if (!ok) return;
      this.inspeccionDecision.set(decision);
      this.confirmInspeccionReview('approved');
      return;
    }
    this.inspeccionDecision.set(decision);
  }

  protected async confirmInspeccionRejection(): Promise<void> {
    if (!this.inspeccionRejectionNote().trim()) return;
    const ok = await this.confirmStep(
      'Solicitar corrección',
      'Se notificará al Operador para corregir la inspección.',
    );
    if (!ok) return;
    this.confirmInspeccionReview('rejected', this.inspeccionRejectionNote());
  }

  private confirmInspeccionReview(decision: 'approved' | 'rejected', observation?: string): void {
    const t = this.ticket();
    if (!t) return;
    this.fcrService.reviewInspeccion(t.id, decision, observation).subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.inspeccionDecision.set(null);
        this.inspeccionRejectionNote.set('');
        this.advancePhase(decision === 'approved' ? 'asignacion' : 'inspeccion');
      },
      error: () => {
        this.inspeccionDecision.set(null);
        this.notify.error('Error', 'No se pudo registrar la revisión de inspección.');
      },
    });
  }

  protected async approveValidation(): Promise<void> {
    const ok = await this.confirmStep(
      'Aprobar información técnica',
      'Confirma que la propuesta técnica y el apartado de herramientas son correctos. El ticket avanzará a Preparación de Herramientas.',
    );
    if (!ok) return;
    this.advancePhase('preparacion_herramientas');
  }

  // ══════════════════════════════════════════════
  // Avance genérico de fase
  // ══════════════════════════════════════════════

  /** Confirmación previa a un "Continuar a X" — el paso queda bloqueado tras confirmar. */
  protected async confirmAndAdvance(
    phase: FcrPhase,
    title: string,
    content: string,
  ): Promise<void> {
    const ok = await this.confirmStep(title, content);
    if (!ok) return;
    this.advancePhase(phase);
  }

  /**
   * La mayoría de acciones de este flujo actualizaban `ticket` sin ningún callback de
   * error — si la petición fallaba (red caída, 500, etc.), la UI simplemente parecía
   * no haber hecho nada, sin ningún aviso de que la acción no se guardó. Tampoco había
   * confirmación de que sí se guardó — `successMessage` cubre ambos con un solo toast.
   */
  private updateTicket(
    request: Observable<FcrTicket>,
    successMessage = 'Cambios guardados.',
  ): void {
    request.subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.notify.success(successMessage);
      },
      error: () =>
        this.notify.error('Error', 'No se pudo completar la acción. Inténtalo de nuevo.'),
    });
  }

  /**
   * `<dynadrill-upload-zone>` emite el `NzUploadFile` real de ng-zorro — acá
   * se extrae el `File` nativo y se valida el tamaño en cliente (UX; el
   * backend es la fuente de verdad y vuelve a validarlo).
   */
  private extraerArchivoValido(file: NzUploadFile): File | null {
    // `originFileObj` es lo normal, pero algunos flujos de ng-zorro entregan
    // el `File` nativo directamente en vez de envuelto — si no viene ahí,
    // usamos el propio `file` cuando ya parece un `File` (tiene `size`/`name`
    // reales), en vez de fallar en silencio.
    const archivo = (file.originFileObj as File | undefined) ?? (file as unknown as File);
    if (!archivo || typeof archivo.size !== 'number') {
      this.notify.error(
        'Archivo no reconocido',
        'No se pudo leer el archivo seleccionado. Probá de nuevo.',
      );
      return null;
    }
    if (archivo.size > MAX_UPLOAD_SIZE_BYTES) {
      this.notify.error(
        'Archivo demasiado grande',
        'El archivo supera el máximo permitido de 2MB.',
      );
      return null;
    }
    return archivo;
  }

  protected advancePhase(phase: FcrPhase): void {
    const t = this.ticket();
    if (!t || !this.isMyTurn()) return;

    // Gate HSE-TRIAGE-001: con una emergencia abierta, nada avanza (mayor severidad que un SWA).
    const e = this.emergencia();
    if (e) {
      this.notify.error(
        'Emergencia activa',
        `Emergencia ${e.code} abierta. El servicio no puede avanzar hasta que se cierre en QHSE.`,
      );
      return;
    }
    // Gate HSE-SEGUIMIENTO-003: con un Stop Work abierto, nada avanza.
    const s = this.swa();
    if (s) {
      this.notify.error(
        'Trabajo detenido',
        `Stop Work ${s.code} abierto (${s.tipoPeligro}). El servicio no puede avanzar hasta que se autorice la reanudación en QHSE.`,
      );
      return;
    }

    // Gate HSE-PLAN-001: no se asigna operador ni se ejecuta sin la
    // cobertura IPERC completa.
    if ((phase === 'asignacion' || phase === 'ejecucion_operativa') && !this.coberturaOk()) {
      this.notify.error(
        'Matriz IPERC incompleta',
        `HSE tiene pendiente aprobar ${actividadesPendientesTexto(this.qhseVinculo())} en la matriz maestra.`,
      );
      return;
    }
    // Gate HSE-SITIO-001: no se ejecuta en campo sin el PTW firmado en sitio
    // (FCR-004 "Descargar documentos HSE", RN-FCR-016).
    if (phase === 'ejecucion_operativa' && !this.ptwFirmadoOk()) {
      const p = this.qhseVinculo()?.ptw;
      this.notify.error(
        'PTW pendiente',
        p
          ? `El servicio no puede pasar a ejecución de campo: el PTW ${p.code} está en ${ptwFaseLabel(
              p.fase,
            )} — falta que QHSE valide los documentos del PTW.`
          : 'El servicio no puede pasar a ejecución de campo: todavía no se abrió el PTW / Recibimiento de Sitio en QHSE.',
      );
      return;
    }

    const approver = this.auth.currentUser();
    this.fcrService
      .advancePhase(t.id, phase, approver?.name ?? '', approver?.roleName ?? '')
      .subscribe({
        next: (updated) => {
          this.ticket.set(updated);
          this.notify.success(
            'Fase actualizada',
            `El ticket ahora está en "${FCR_PHASE_LABELS[phase]}".`,
          );
        },
        error: () => this.notify.error('Error', 'No se pudo avanzar de fase.'),
      });
  }

  // ══════════════════════════════════════════════
  // Carga inicial
  // ══════════════════════════════════════════════

  private cargarPedido(pedidoId: number): void {
    this.pedidoService.get(pedidoId).subscribe({
      next: (p) => this.pedido.set(p),
      error: () => this.pedido.set(null),
    });
  }

  constructor() {
    // Móvil: barra "← FCR-XXXX" (Nav/TopAppBar Type=Detail) en vez de hamburguesa + logo.
    useDetailChrome(() => this.ticket()?.code ?? 'Ticket', '/modulos/operativo/fcr');
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.fcrService.getTicket(id).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.loading.set(false);
        if (t.tipoOt === 'servicio') this.loadToolInspections(id);
        if (t.pedidoId) {
          this.loadDocumentosQhse(id);
          this.cargarPedido(t.pedidoId);
        }
      },
      error: () => this.loading.set(false),
    });

    // Si el ticket avanza de fase, la selección manual vieja del detalle ya no aplica.
    effect(() => {
      this.currentPhaseIndex();
      untracked(() => this.manualPhaseIndex.set(null));
    });
  }

  protected goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  protected formatDate(iso: string): string {
    return iso.slice(0, 10);
  }
}
