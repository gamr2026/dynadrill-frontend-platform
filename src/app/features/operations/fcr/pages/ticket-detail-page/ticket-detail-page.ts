import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import type { Observable } from 'rxjs';
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
  DynadrillStatisticComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
  type DynadrillApprovalDecision,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  FcrTicket,
  FcrTool,
  FCR_PHASE_LABELS,
  FCR_PHASE_ROLE,
  FCR_TOOL_DAILY_STATUS_CODE,
  FCR_TOOL_DAILY_STATUS_LABELS,
  FCR_TOOL_STATUS_LABELS,
  type FcrPhase,
  type FcrPhaseApproval,
  type FcrToolDailyStatus,
  type FcrToolStatus,
} from '../../models/fcr.model';
import { FcrService, type CampoDocumentoFcr } from '../../services/fcr.service';
import { PedidoService } from '../../../../facturacion/services/pedido.service';
import { itemsEstimadosDe, LINEA_SERVICIO_LABELS, type Pedido } from '../../../../facturacion/models/pedido.model';
import { FcrToolInspeccionesService } from '../../services/fcr-tool-inspecciones.service';
import type { FcrToolInspection } from '../../models/fcr-tool-inspeccion.model';
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
import { SolicitarCorreccionDialog, SolicitarCorreccionDialogData, SolicitarCorreccionDialogResult } from '../../components/solicitar-correccion-dialog';
import { AsignarOperadorDialog, AsignarOperadorDialogData, AsignarOperadorDialogResult } from '../../components/asignar-operador-dialog';
import { FirmaActaDialog, FirmaActaDialogData, FirmaActaDialogResult } from '../../components/firma-acta-dialog';
import { ChecklistHerramientaDialog, ChecklistHerramientaDialogData } from '../../components/checklist-herramienta-dialog';
import { HerramientaFaltanteDialog, HerramientaFaltanteDialogData, HerramientaFaltanteDialogResult } from '../../components/herramienta-faltante-dialog';
import { GuiaSalidaBodegaDialog, GuiaSalidaBodegaDialogData, GuiaSalidaBodegaDialogResult } from '../../components/guia-salida-bodega-dialog';
import { CierreTicketDialog, CierreTicketDialogData, CierreTicketDialogResult } from '../../components/cierre-ticket-dialog';
import {
  ReporteCierrePdfDialog,
  ReporteCierrePdfDialogData,
  type ReporteCierrePdfActivitySummaryRow,
  type ReporteCierrePdfDocumentRow,
  ReporteHerramientasPdfDialog,
  ReporteHerramientasPdfDialogData,
  ReporteJobPdfDialog,
  ReporteJobPdfDialogData,
  OperativoDocsBridgeService,
} from '../../../../../shared/index';

/** RN de negocio (fcr-adjuntos-reales): el backend es la fuente de verdad, esto es solo UX para no esperar el round-trip. */
const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;

/** Mapea las 3 claves cortas históricas de la rama SERVICIOS al nombre de campo real de `CAMPOS_DOCUMENTO_FCR` (backend). */
const CAMPO_DOCUMENTO_SERVICIO: Record<'formularioExterno' | 'dimensionamiento' | 'dureza', CampoDocumentoFcr> = {
  formularioExterno: 'formularioInspeccionExterno',
  dimensionamiento: 'formatoDimensionamientoServicio',
  dureza: 'formatoDurezaServicio',
};

const HOUR_OPTIONS: DynadrillSelectOption[] = Array.from({ length: 24 }, (_, h) => {
  const v = String(h).padStart(2, '0');
  return { value: v, label: v };
});
const MINUTE_OPTIONS: DynadrillSelectOption[] = Array.from({ length: 60 }, (_, m) => {
  const v = String(m).padStart(2, '0');
  return { value: v, label: v };
});

/** 'HH:mm' a 'HH:mm' → horas — mismo criterio que el servidor, para mostrar la duración calculada antes de guardar. */
function calcDurationHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let minutes = endH * 60 + endM - (startH * 60 + startM);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return toIso(new Date());
}

/** Entrada VENTA — sin cambios respecto al flujo original. */
const PHASE_KEYS_VENTA: FcrPhase[] = [
  'validacion',
  'preparacion_herramientas',
  'asignacion_operador',
  'reunion_operativa',
  'ejecucion_campo',
  'revision_reportes',
  'control_retorno',
  'cierre',
];

/**
 * Entrada SERVICIOS — paridad con VENTA: arranca en 'validacion' (mismo
 * paso, mismo rol responsable) antes de 'preparacion_herramientas'
 * (Supervisor pide herramientas a Bodega), luego 'tipo_operador' asigna al
 * operador mecánico que repara e inspecciona por herramienta, y
 * 'aprobacion_supervisor_operaciones' confluye directo en
 * 'asignacion_operador' (operador de campo) — ya no se vuelve a pasar por
 * 'preparacion_herramientas', eso ocurre una sola vez.
 */
const PHASE_KEYS_SERVICIO: FcrPhase[] = [
  'validacion',
  'preparacion_herramientas',
  'tipo_operador',
  'reparacion',
  'inspeccion',
  'aprobacion_supervisor_operaciones',
  'asignacion_operador',
  'reunion_operativa',
  'ejecucion_campo',
  'revision_reportes',
  'control_retorno',
  'cierre',
];

@Component({
  selector: 'app-fcr-ticket-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
    DynadrillStatisticComponent,
    DynadrillTextareaComponent,
    DynadrillUploadZoneComponent,
    DynadrillApprovalActionsComponent,
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
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly docsBridge = inject(OperativoDocsBridgeService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  protected readonly loading = signal(true);
  protected readonly ticket = signal<FcrTicket | null>(null);

  // ── Tracker de fases (la secuencia depende de tipoOt — dos entradas, un tronco común) ──

  protected readonly phaseKeys = computed<FcrPhase[]>(() =>
    this.ticket()?.tipoOt === 'servicio' ? PHASE_KEYS_SERVICIO : PHASE_KEYS_VENTA,
  );
  protected readonly phaseLabels = computed(() => this.phaseKeys().map(p => FCR_PHASE_LABELS[p]));

  protected readonly currentPhaseIndex = computed(() => {
    const t = this.ticket();
    return t ? this.phaseKeys().indexOf(t.currentPhase) : 0;
  });

  protected readonly currentPhase = computed<FcrPhase>(() => this.ticket()?.currentPhase ?? 'validacion');

  /**
   * En la mayoría de fases hay un solo actor durante toda la fase, pero
   * Preparación de Herramientas alterna entre Bodega y Supervisor paso a
   * paso (FCR-002), con un envío formal en cada sentido — si se deja fijo
   * en "Supervisor" (como en FCR_PHASE_ROLE), el banner miente en varios
   * de esos sub-pasos. Orden de prioridad: primero lo que bloquea el envío
   * a Bodega, luego la preparación en Bodega, luego el envío de vuelta al
   * Supervisor, luego la recepción.
   */
  protected readonly responsibleRole = computed(() => {
    const t = this.ticket();
    if (t?.currentPhase === 'validacion' && t.observations.length > 0) {
      // El último autor dice de quién es el turno: si Supervisor pidió la
      // corrección, le toca a Ingeniería de Ventas aplicarla; si Ingeniería
      // de Ventas ya reenvió, vuelve a ser turno del Supervisor.
      const last = t.observations[t.observations.length - 1];
      return last.role === 'Supervisor' ? 'Ingeniería de Ventas' : 'Supervisor';
    }
    if (t?.currentPhase === 'preparacion_herramientas') {
      const hasUnsentSelected = t.tools.some(tool => tool.status === 'seleccionada' && !tool.sentToBodega);
      if (hasUnsentSelected) return 'Supervisor';
      const hasSentSelected = t.tools.some(tool => tool.status === 'seleccionada' && tool.sentToBodega);
      if (hasSentSelected) return 'Bodeguero';
      const hasUnsentPrepared = t.tools.some(tool => tool.status === 'en_preparacion' && !tool.sentToSupervisor);
      if (hasUnsentPrepared) return 'Bodeguero';
      const hasSentPrepared = t.tools.some(tool => tool.status === 'en_preparacion' && tool.sentToSupervisor);
      if (hasSentPrepared) return 'Supervisor';
    }
    return FCR_PHASE_ROLE[this.currentPhase()].roleName;
  });
  protected readonly isMyTurn = computed(() => this.responsibleRole() === this.roleName());

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
    return this.dialog.confirm({ title, content, okText: 'Confirmar', cancelText: 'Cancelar', danger });
  }

  // ── Pedido vinculado (solo lectura, fase 'validacion') ──

  /** Detalle completo del Pedido de Facturación que originó este ticket — `null` si el ticket no tiene uno vinculado (tickets legado sembrados sin puente). */
  protected readonly pedido = signal<Pedido | null>(null);
  protected readonly pedidoLineaServicioLabel = computed(() => {
    const p = this.pedido();
    return p ? LINEA_SERVICIO_LABELS[p.lineaServicio] : '';
  });
  protected readonly pedidoItems = computed(() => {
    const p = this.pedido();
    return p ? itemsEstimadosDe(p) : [];
  });
  protected readonly pedidoItemsTotal = computed(() =>
    this.pedidoItems().reduce((sum, item) => sum + item.cantidad * item.valorUnitario, 0),
  );

  // ── Contexto ──

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      { label: 'Propuesta', value: `V${t.proposalVersion} · aprobada` },
      { label: 'Supervisor', value: t.assignedSupervisor || '—' },
      { label: 'Operador asignado', value: t.assignedOperator || 'Sin asignar' },
      { label: 'Herramientas', value: `${t.tools.filter(tool => tool.status === 'recibida').length} de ${t.tools.length} recibidas` },
    ];
  });

  // ══════════════════════════════════════════════
  // FASE: Preparación de Herramientas
  // ══════════════════════════════════════════════

  protected readonly toolStatusLabel = (status: FcrToolStatus): string => FCR_TOOL_STATUS_LABELS[status];

  /** Separa las herramientas de la tanda original de las agregadas después de que el proceso ya había avanzado — se muestran en secciones distintas sin duplicar la lógica de fila. */
  protected readonly originalTools = computed(() => (this.ticket()?.tools ?? []).filter(tool => !tool.addedLate));
  protected readonly lateTools = computed(() => (this.ticket()?.tools ?? []).filter(tool => tool.addedLate));

  /** Catálogo real de Inventario (RN-FCR-008A: no se permite seleccionar fuera de él) — reemplaza el mock hardcodeado que existía antes. */
  protected readonly herramientasCatalogo = toSignal(
    this.articulosService.list({ categoria: 'HERRAMIENTAS', activo: true }),
    { initialValue: [] },
  );

  protected readonly availableToAdd = computed<DynadrillSelectOption[]>(() => {
    const currentArticuloIds = new Set(this.ticket()?.tools.map(t => t.articuloId).filter((id): id is number => id !== undefined) ?? []);
    return this.herramientasCatalogo()
      .filter(articulo => !currentArticuloIds.has(articulo.id))
      .map(articulo => ({ label: articulo.nombre, value: articulo.id }));
  });

  protected readonly toolToAdd = signal<number | null>(null);

  protected readonly allToolsReceived = computed(() => {
    const tools = this.ticket()?.tools ?? [];
    return tools.length > 0 && tools.every(t => t.status === 'recibida');
  });

  /** RN-FCR-005 / SP7: solo se puede declarar la lista completa cuando todo lo agregado ya fue recibido. */
  protected readonly canConfirmToolList = computed(() => this.allToolsReceived() && !this.ticket()?.toolListConfirmed);

  protected async confirmToolListComplete(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Enviar a documento de inspección',
      'Declara que no quedan herramientas por agregar. La lista quedará cerrada y podrá subir el documento de inspección.',
    );
    if (!ok) return;
    this.updateTicket(this.fcrService.setToolListConfirmed(t.id, true));
  }

  /** Corrección puntual: reabre la lista para agregar una herramienta olvidada, antes de continuar a la siguiente fase. */
  protected async reopenToolList(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep('Reabrir lista de herramientas', 'Esto permite agregar más herramientas antes de subir el documento de inspección. ¿Continuar?', true);
    if (!ok) return;
    this.updateTicket(this.fcrService.setToolListConfirmed(t.id, false));
  }

  /**
   * Bodega solo ve "Marcar preparada" en las herramientas que el Supervisor
   * ya envió formalmente — el envío es de un solo sentido, por herramienta:
   * no existe "reabrir" para volver a quitar una ya enviada.
   */
  protected readonly canSendToBodega = computed(() => {
    const t = this.ticket();
    return !!t && t.tools.some(tool => tool.status === 'seleccionada' && !tool.sentToBodega);
  });

  protected async sendToolsToBodega(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Enviar herramientas a Bodega',
      'Bodega podrá empezar a preparar las herramientas seleccionadas. Esta acción no se puede deshacer para estas herramientas.',
    );
    if (!ok) return;
    this.updateTicket(this.fcrService.sendToolsToBodega(t.id));
  }

  protected onToolToAddChange(value: unknown): void {
    this.toolToAdd.set(value as number | null);
  }

  protected addTool(): void {
    const articuloId = this.toolToAdd();
    const t = this.ticket();
    if (!articuloId || !t) return;
    this.fcrService.addTool(t.id, articuloId).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.toolToAdd.set(null);
      },
      error: () => this.notify.error('Error', 'No se pudo agregar la herramienta.'),
    });
  }

  /** Quita una herramienta agregada por error, antes de que Bodega la prepare. */
  protected async removeTool(toolId: number): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep('Quitar herramienta', 'Esta acción no se puede deshacer. ¿Quitar la herramienta de la lista?', true);
    if (!ok) return;
    this.updateTicket(this.fcrService.removeTool(t.id, toolId));
  }

  /** Bodega marca la herramienta como preparada físicamente (FCR-002). */
  protected async markToolPrepared(toolId: number): Promise<void> {
    const ok = await this.confirmStep('Marcar herramienta preparada', 'Confirma que la herramienta ya está físicamente preparada y lista para que el Supervisor la reciba.');
    if (!ok) return;
    this.updateToolStatus(toolId, 'en_preparacion');
  }

  /** Supervisor recibe formalmente la herramienta preparada por Bodega (RN-FCR-008C). */
  protected async receiveTool(toolId: number): Promise<void> {
    const ok = await this.confirmStep('Recibir herramienta', 'Confirma la recepción formal de esta herramienta. Una vez recibida, solo usted puede corregirlo desde aquí.');
    if (!ok) return;
    this.updateToolStatus(toolId, 'recibida');
  }

  /**
   * Simétrico al envío a Bodega: Bodega envía formalmente al Supervisor lo
   * que ya preparó, antes de que pueda recibirlo. También de un solo
   * sentido — si Bodega necesita corregir una herramienta ya enviada, usa
   * "Corregir" (vuelve a "Seleccionada"), no un botón de reabrir el envío.
   */
  protected readonly canSendToSupervisor = computed(() => {
    const t = this.ticket();
    return !!t && t.tools.some(tool => tool.status === 'en_preparacion' && !tool.sentToSupervisor);
  });

  protected async sendToolsToSupervisor(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep(
      'Enviar herramientas al Supervisor',
      'El Supervisor podrá empezar a recibir las herramientas preparadas. Esta acción no se puede deshacer para estas herramientas.',
    );
    if (!ok) return;
    this.updateTicket(this.fcrService.sendToolsToSupervisor(t.id));
  }

  /**
   * Corrige un paso ya confirmado por error (única vía de "deshacer" en
   * Preparación de Herramientas): Bodega puede regresar una herramienta de
   * "En preparación" a "Seleccionada", y el Supervisor puede regresar una
   * "Recibida" a "En preparación" si la recibió por equivocación.
   */
  protected async correctTool(toolId: number, revertTo: FcrToolStatus): Promise<void> {
    const ok = await this.confirmStep('Corregir herramienta', `Esto revierte el estado de la herramienta a "${this.toolStatusLabel(revertTo)}". ¿Continuar?`, true);
    if (!ok) return;
    this.updateToolStatus(toolId, revertTo);
  }

  private updateToolStatus(toolId: number, status: FcrToolStatus): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(this.fcrService.setToolStatus(t.id, toolId, status));
  }

  protected readonly inspectionUploadState = computed(() => (this.ticket()?.inspectionDocumentUploaded ? 'uploaded' : 'idle'));

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
    const ok = await this.confirmStep('Confirmar documento de inspección', 'Al confirmar se generan la Guía de Movimiento y la Guía de Revisión. Esta acción no se puede deshacer.');
    if (!ok) return;
    this.fcrService.subirDocumento(t.id, 'inspectionDocument', archivo).subscribe({
      next: () => {
        this.fcrService.markInspectionUploaded(t.id).subscribe({
          next: updated => {
            this.ticket.set(updated);
            this.notify.success('Guía de Movimiento y Guía de Revisión generadas.');
          },
          error: () => this.notify.error('Error', 'El documento se subió, pero no se pudieron generar las guías.'),
        });
      },
      error: () => this.notify.error('Error', 'No se pudo subir el documento de inspección.'),
    });
  }

  /** Documentos de VENTA que el diagrama pide junto al de inspección (Registro de dureza / Registro firmado de QAQC). */
  protected readonly durezaUploadState = computed(() => (this.ticket()?.registroDurezaUploaded ? 'uploaded' : 'idle'));
  protected readonly qaqcUploadState = computed(() => (this.ticket()?.registroQaqcUploaded ? 'uploaded' : 'idle'));

  protected onRegistroDurezaUploaded(file: NzUploadFile): void {
    const t = this.ticket();
    const archivo = this.extraerArchivoValido(file);
    if (!t || !archivo) return;
    this.updateTicket(this.fcrService.subirDocumento(t.id, 'registroDureza', archivo));
  }

  protected onEliminarRegistroDureza(): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(this.fcrService.eliminarDocumento(t.id, 'registroDureza'));
  }

  protected onRegistroQaqcUploaded(file: NzUploadFile): void {
    const t = this.ticket();
    const archivo = this.extraerArchivoValido(file);
    if (!t || !archivo) return;
    this.updateTicket(this.fcrService.subirDocumento(t.id, 'registroQaqc', archivo));
  }

  protected onEliminarRegistroQaqc(): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(this.fcrService.eliminarDocumento(t.id, 'registroQaqc'));
  }

  // ══════════════════════════════════════════════
  // FASE: Asignación de Operador
  // ══════════════════════════════════════════════

  protected openAsignarOperador(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<AsignarOperadorDialog, AsignarOperadorDialogData>({
      title: 'Asignar operador',
      content: AsignarOperadorDialog,
      data: { ticketCode: t.code, estimatedDate: t.estimatedDate },
      footer: false,
    });
    ref.afterClose.subscribe((result: AsignarOperadorDialogResult | undefined) => {
      if (!result?.assigned || !result.operatorName) return;
      this.updateTicket(this.fcrService.assignOperator(t.id, result.operatorName));
    });
  }

  // ══════════════════════════════════════════════
  // FASE: Reunión Operativa
  // ══════════════════════════════════════════════

  protected openFirmaActa(): void {
    const t = this.ticket();
    if (!t) return;
    const ref = this.dialog.open<FirmaActaDialog, FirmaActaDialogData>({
      title: 'Reunión operativa',
      content: FirmaActaDialog,
      data: { ticketCode: t.code },
      footer: false,
    });
    ref.afterClose.subscribe((result: FirmaActaDialogResult | undefined) => {
      if (!result?.confirmed || !result.meetingDate) return;
      this.updateTicket(this.fcrService.confirmActa(t.id, result.meetingDate));
    });
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
  protected readonly activityStartMinute = computed(() => this.activityStart().split(':')[1] || null);
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

  protected readonly canAddActivity = computed(() => this.activityDuration() !== null && this.activityDetail().trim().length > 0);

  protected readonly sortedActivityLog = computed(() =>
    [...(this.ticket()?.activityLog ?? [])].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)),
  );

  protected addActivityLogEntry(): void {
    const t = this.ticket();
    if (!t || !this.canAddActivity()) return;
    const author = this.auth.currentUser()?.name ?? this.roleName();
    this.fcrService
      .addActivityLogEntry(t.id, { date: todayIso(), startTime: this.activityStart(), endTime: this.activityEnd(), detail: this.activityDetail(), author })
      .subscribe({
        next: updated => {
          this.ticket.set(updated);
          this.activityStart.set('');
          this.activityEnd.set('');
          this.activityDetail.set('');
        },
        error: () => this.notify.error('Error', 'No se pudo registrar la actividad.'),
      });
  }

  protected async removeActivityLogEntry(entryId: number): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep('Quitar actividad', 'Esta acción no se puede deshacer. ¿Quitar esta entrada de la bitácora?', true);
    if (!ok) return;
    this.updateTicket(this.fcrService.removeActivityLogEntry(t.id, entryId));
  }

  // ══════════════════════════════════════════════
  // FASE: Ejecución de Campo — registro de uso de herramientas (Reporte de Htas.)
  // ══════════════════════════════════════════════

  protected readonly usageToolId = signal<number | null>(null);
  protected readonly usageDate = signal(new Date());
  protected readonly usageStatus = signal<FcrToolDailyStatus | null>(null);
  // Completación/trabajo + picker + presión/peso/observación — por herramienta, junto al resto del registro de uso.
  protected readonly usageTipoCompletacion = signal<TipoCompletacion | null>(null);
  protected readonly usageTipoTrabajo = signal<TipoTrabajo | null>(null);
  protected readonly usageTipoPicker = signal<TipoPicker | null>(null);
  protected readonly usagePresion = signal('');
  protected readonly usagePeso = signal('');
  protected readonly usageObservacion = signal('');

  protected readonly usageToolOptions = computed<DynadrillSelectOption[]>(() => (this.ticket()?.tools ?? []).map(tool => ({ label: tool.name, value: tool.id })));
  protected readonly usageStatusOptions: DynadrillSelectOption[] = (Object.entries(FCR_TOOL_DAILY_STATUS_LABELS) as [FcrToolDailyStatus, string][]).map(
    ([value, label]) => ({ label: `${FCR_TOOL_DAILY_STATUS_CODE[value]} — ${label}`, value }),
  );

  protected readonly canAddToolUsage = computed(() => {
    const t = this.ticket();
    if (!t || this.usageToolId() === null || !this.usageStatus()) return false;
    if (!this.usageTipoPicker() || !this.usagePresion().trim() || !this.usagePeso().trim()) return false;
    return t.tipoOt === 'servicio' ? !!this.usageTipoTrabajo() : !!this.usageTipoCompletacion();
  });

  protected readonly sortedToolUsageLog = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return [...t.toolUsageLog]
      .sort((a, b) => (a.date + a.toolId).localeCompare(b.date + b.toolId))
      .map(entry => ({ ...entry, toolName: t.tools.find(tool => tool.id === entry.toolId)?.name ?? `#${entry.toolId}` }));
  });

  protected readonly toolDailyStatusLabel = (status: FcrToolDailyStatus): string => `${FCR_TOOL_DAILY_STATUS_CODE[status]} — ${FCR_TOOL_DAILY_STATUS_LABELS[status]}`;
  protected readonly tipoTrabajoLabel = (value: TipoTrabajo): string => TIPO_TRABAJO_LABELS[value];
  protected readonly tipoCompletacionLabel = (value: TipoCompletacion): string => TIPO_COMPLETACION_LABELS[value];

  protected onUsageDateChange(value: Date | null): void {
    if (value) this.usageDate.set(value);
  }

  protected onUsageToolChange(value: unknown): void {
    this.usageToolId.set(value as number);
  }

  protected onUsageStatusChange(value: unknown): void {
    this.usageStatus.set(value as FcrToolDailyStatus);
  }

  protected addToolUsageEntry(): void {
    const t = this.ticket();
    const toolId = this.usageToolId();
    const status = this.usageStatus();
    if (!t || toolId === null || !status || !this.canAddToolUsage()) return;
    this.fcrService
      .addToolUsageEntry(t.id, {
        toolId,
        date: toIso(this.usageDate()),
        status,
        // Tickets sembrados antes de tipoOt no lo traen — se tratan como venta (mismo default que en el resto de la página).
        tipoCompletacion: t.tipoOt !== 'servicio' ? (this.usageTipoCompletacion() ?? undefined) : undefined,
        tipoTrabajo: t.tipoOt === 'servicio' ? (this.usageTipoTrabajo() ?? undefined) : undefined,
        tipoPicker: this.usageTipoPicker() ?? undefined,
        presion: this.usagePresion().trim(),
        peso: this.usagePeso().trim(),
        observacion: this.usageObservacion().trim() || undefined,
      })
      .subscribe({
        next: updated => {
          this.ticket.set(updated);
          this.usageToolId.set(null);
          this.usageStatus.set(null);
          this.usageTipoCompletacion.set(null);
          this.usageTipoTrabajo.set(null);
          this.usageTipoPicker.set(null);
          this.usagePresion.set('');
          this.usagePeso.set('');
          this.usageObservacion.set('');
        },
        error: () => this.notify.error('Error', 'No se pudo registrar el uso de la herramienta.'),
      });
  }

  protected async removeToolUsageEntry(entryId: number): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep('Quitar registro', 'Esta acción no se puede deshacer. ¿Quitar este registro de uso?', true);
    if (!ok) return;
    this.updateTicket(this.fcrService.removeToolUsageEntry(t.id, entryId));
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
      confirming ? 'Declara que no queda nada pendiente por registrar.' : 'Permite seguir editando antes de finalizar.',
    );
    if (!ok) return;
    this.updateTicket(this.fcrService.confirmPickerUsageList(t.id, confirming));
  }

  // ══════════════════════════════════════════════
  // FASE: Ejecución de Campo — cierre
  // ══════════════════════════════════════════════

  protected async submitFieldReports(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep('Finalizar ejecución', 'Confirma que el trabajo de campo finalizó y desea subir los reportes operativos. No podrá modificarlos después.');
    if (!ok) return;
    this.fcrService.submitReports(t.id).subscribe({
      next: updated => {
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
    this.dialog.open<ReporteJobPdfDialog, ReporteJobPdfDialogData>({
      title: 'Reporte de Trabajo — Vista de impresión',
      content: ReporteJobPdfDialog,
      data: {
        header: { code: t.code, cliente: t.clientName, pozo: t.wellName, supervisor: t.assignedSupervisor, operador: t.assignedOperator },
        log: t.activityLog,
      },
      footer: false,
      width: '820px',
    });
  }

  protected openReporteHerramientas(): void {
    const t = this.ticket();
    if (!t) return;
    this.dialog.open<ReporteHerramientasPdfDialog, ReporteHerramientasPdfDialogData>({
      title: 'Reporte de Herramientas — Vista de impresión',
      content: ReporteHerramientasPdfDialog,
      data: {
        header: { code: t.code, cliente: t.clientName, pozo: t.wellName, supervisor: t.assignedSupervisor, operador: t.assignedOperator },
        tools: t.tools.map(tool => ({ id: tool.id, name: tool.name })),
        usageLog: t.toolUsageLog,
      },
      footer: false,
      width: '920px',
    });
  }

  protected readonly reportsDecision = signal<DynadrillApprovalDecision>(null);
  protected readonly rejectionNote = signal('');

  protected async onReportsDecisionChange(decision: DynadrillApprovalDecision): Promise<void> {
    if (decision === 'approved') {
      const ok = await this.confirmStep('Aprobar reportes', 'El ticket continuará a Control de Retorno de Herramientas. Esta acción no se puede deshacer.');
      if (!ok) return;
      this.reportsDecision.set(decision);
      this.confirmReportsReview('approved');
      return;
    }
    this.reportsDecision.set(decision);
  }

  protected async confirmRejection(): Promise<void> {
    if (!this.rejectionNote().trim()) return;
    const ok = await this.confirmStep('Solicitar corrección', 'Se notificará al Operador para corregir los reportes.');
    if (!ok) return;
    this.confirmReportsReview('rejected', this.rejectionNote());
  }

  private confirmReportsReview(decision: 'approved' | 'rejected', observation?: string): void {
    const t = this.ticket();
    if (!t) return;
    this.fcrService.reviewReports(t.id, decision, observation).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.reportsDecision.set(null);
        this.rejectionNote.set('');
        if (decision === 'approved') {
          this.enviarReportesAFacturacion(updated);
          this.advancePhase('control_retorno');
        }
      },
      error: () => this.notify.error('Error', 'No se pudo registrar la revisión de reportes.'),
    });
  }

  /** Puente FCR → Facturación: al aprobar los reportes, se empujan al Pedido vinculado. */
  private enviarReportesAFacturacion(t: FcrTicket): void {
    if (!t.pedidoCode) return;
    const header = { code: t.code, cliente: t.clientName, pozo: t.wellName, supervisor: t.assignedSupervisor, operador: t.assignedOperator };

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
        firmadoPor: t.assignedSupervisor,
        header,
        actividades,
      });
    }

    if (t.toolUsageLog.length) {
      this.docsBridge.pushReporteHerramientas({
        pedidoCode: t.pedidoCode,
        origen: 'fcr',
        ticketOperativoId: t.id,
        firmadoPor: t.assignedSupervisor,
        header,
        herramientas: t.tools.map(tool => ({ id: tool.id, name: tool.name })),
        usoHerramientas: t.toolUsageLog,
      });
    }
    this.notify.success('Reportes enviados a Facturación', `Vinculados al Pedido ${t.pedidoCode}.`);
  }

  // ══════════════════════════════════════════════
  // FASE: Control de Retorno
  // ══════════════════════════════════════════════

  protected readonly pendingReturnTools = computed(() => (this.ticket()?.tools ?? []).filter(t => t.status === 'recibida'));

  protected async markToolReturned(toolId: number): Promise<void> {
    const ok = await this.confirmStep('Confirmar devolución', 'Confirma que esta herramienta fue devuelta y conciliada contra la Guía de Movimiento. No podrá deshacer este paso.');
    if (!ok) return;
    this.updateToolStatus(toolId, 'devuelta');
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
      this.updateTicket(this.fcrService.registerMissingTool(t.id, result.toolId, result.reason));
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
      this.updateTicket(this.fcrService.generateBodegaExitGuide(t.id, tool.id));
    });
  }

  protected readonly needsBodegaExitGuide = computed(() =>
    (this.ticket()?.tools ?? []).some(t => t.status === 'faltante' && t.missingReason?.startsWith('Venta de herramienta complementaria')),
  );

  protected readonly toolReturnControlComplete = computed(() => {
    const t = this.ticket();
    if (!t) return false;
    const allSettled = t.tools.every(tool => tool.status === 'devuelta' || tool.status === 'faltante');
    const bodegaGuideOk = !this.needsBodegaExitGuide() || t.bodegaExitGuideGenerated;
    return allSettled && bodegaGuideOk;
  });

  // ══════════════════════════════════════════════
  // FASE: Cierre — dashboard de resumen
  // ══════════════════════════════════════════════

  protected readonly phaseLabel = (phase: FcrPhase): string => FCR_PHASE_LABELS[phase];

  /**
   * KPIs del dashboard de cierre. "Documentos subidos" cuenta los 6 flags
   * reales de documento (3 de la rama SERVICIOS + 3 de la rama VENTA) más
   * los otros 6 hitos/documentos generados durante el ticket — el mismo
   * universo que `closureOtherDocuments` + `checklistDocumentosReadOnly`.
   */
  protected readonly closureStats = computed(() => {
    const t = this.ticket();
    if (!t) return { toolsCount: 0, documentsCount: 0, totalHours: 0, phasesCompletedCount: 0 };
    const docFlags = [
      t.formularioInspeccionExternoUploaded,
      t.formatoDimensionamientoServicioUploaded,
      t.formatoDurezaServicioUploaded,
      t.registroDurezaUploaded,
      t.registroQaqcUploaded,
      t.inspectionDocumentUploaded,
      t.workReportUploaded,
      t.toolReportUploaded,
      t.finalReviewGuideUploaded,
      t.movementGuideGenerated,
      t.reviewGuideGenerated,
      t.bodegaExitGuideGenerated,
    ];
    return {
      toolsCount: t.tools.length,
      documentsCount: docFlags.filter(Boolean).length,
      totalHours: t.activityLog.reduce((sum, e) => sum + e.durationHours, 0),
      phasesCompletedCount: t.phaseHistory.length,
    };
  });

  /** Hitos/documentos generados durante el ticket que quedan fuera de los 6 flags reales ya cubiertos por `checklistDocumentosReadOnly` / los documentos de VENTA. */
  protected readonly closureOtherDocuments = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      { key: 'workReport' as const, label: 'Reporte de trabajo', uploaded: t.workReportUploaded },
      { key: 'toolReport' as const, label: 'Reporte de herramientas', uploaded: t.toolReportUploaded },
      { key: 'finalReviewGuide' as const, label: 'Guía de revisión final', uploaded: t.finalReviewGuideUploaded },
      { key: 'movementGuide' as const, label: 'Guía de movimiento', uploaded: t.movementGuideGenerated },
      { key: 'reviewGuide' as const, label: 'Guía de revisión', uploaded: t.reviewGuideGenerated },
      { key: 'bodegaExitGuide' as const, label: 'Guía de salida de bodega', uploaded: t.bodegaExitGuideGenerated },
    ];
  });

  /** Abre la vista imprimible del resumen de cierre — datos derivados del ticket completo, sin llamada adicional al backend. */
  protected openReporteCierre(): void {
    const t = this.ticket();
    if (!t) return;

    const documentos: ReporteCierrePdfDocumentRow[] = [
      { label: 'Formulario de inspección externo', uploaded: !!t.formularioInspeccionExternoUploaded, nombreArchivo: t.formularioInspeccionExternoNombreArchivo },
      { label: 'Formato de dimensionamiento', uploaded: !!t.formatoDimensionamientoServicioUploaded, nombreArchivo: t.formatoDimensionamientoServicioNombreArchivo },
      { label: 'Formato de Dureza', uploaded: !!t.formatoDurezaServicioUploaded, nombreArchivo: t.formatoDurezaServicioNombreArchivo },
      { label: 'Documento de inspección', uploaded: t.inspectionDocumentUploaded, nombreArchivo: t.inspectionDocumentNombreArchivo },
      { label: 'Registro de dureza', uploaded: !!t.registroDurezaUploaded, nombreArchivo: t.registroDurezaNombreArchivo },
      { label: 'Registro firmado de QAQC', uploaded: !!t.registroQaqcUploaded, nombreArchivo: t.registroQaqcNombreArchivo },
      { label: 'Reporte de trabajo', uploaded: t.workReportUploaded },
      { label: 'Reporte de herramientas', uploaded: t.toolReportUploaded },
      { label: 'Guía de revisión final', uploaded: t.finalReviewGuideUploaded },
      { label: 'Guía de movimiento', uploaded: t.movementGuideGenerated },
      { label: 'Guía de revisión', uploaded: t.reviewGuideGenerated },
      { label: 'Guía de salida de bodega', uploaded: t.bodegaExitGuideGenerated },
    ];

    const byDate = new Map<string, { count: number; totalHours: number }>();
    for (const entry of t.activityLog) {
      const acc = byDate.get(entry.date) ?? { count: 0, totalHours: 0 };
      acc.count += 1;
      acc.totalHours += entry.durationHours;
      byDate.set(entry.date, acc);
    }
    const activitySummary: ReporteCierrePdfActivitySummaryRow[] = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, acc]) => ({ date, count: acc.count, totalHours: acc.totalHours }));

    this.dialog.open<ReporteCierrePdfDialog, ReporteCierrePdfDialogData>({
      title: 'Resumen de Cierre — Vista de impresión',
      content: ReporteCierrePdfDialog,
      data: {
        header: { code: t.code, cliente: t.clientName, pozo: t.wellName, supervisor: t.assignedSupervisor, operador: t.assignedOperator },
        tipoOtLabel: t.tipoOt === 'servicio' ? 'Servicio' : 'Venta',
        estimatedDate: t.estimatedDate,
        phases: t.phaseHistory.map(p => ({ label: this.phaseLabel(p.phase), approvedBy: p.approvedBy, approvedByRole: p.approvedByRole, date: p.date })),
        tools: t.tools.map(tool => ({ id: tool.id, name: tool.name, status: this.toolStatusLabel(tool.status) })),
        documentos,
        activitySummary,
        totalHours: this.closureStats().totalHours,
        toolUsageCount: t.toolUsageLog.length,
        observationsCount: t.observations.length,
      },
      footer: false,
      width: '900px',
    });
  }

  // ══════════════════════════════════════════════
  // FASE: Cierre
  // ══════════════════════════════════════════════

  protected openCierreTicket(): void {
    const t = this.ticket();
    if (!t || !this.isMyTurn()) return;
    const returned = t.tools.filter(tool => tool.status === 'devuelta').length;
    const ref = this.dialog.open<CierreTicketDialog, CierreTicketDialogData>({
      title: 'Cerrar ticket FCR',
      content: CierreTicketDialog,
      data: { ticketCode: t.code, clientName: t.clientName, toolsReturnedSummary: `${returned} de ${t.tools.length} devueltas` },
      footer: false,
    });
    ref.afterClose.subscribe((result: CierreTicketDialogResult | undefined) => {
      if (!result?.closed) return;
      this.fcrService.closeTicket(t.id).subscribe({
        next: updated => {
          this.ticket.set(updated);
          this.notify.success('Ticket cerrado. Encuesta de satisfacción enviada al cliente.');
        },
        error: () => this.notify.error('Error', 'No se pudo cerrar el ticket.'),
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
        next: updated => {
          this.ticket.set(updated);
          this.notify.success('Corrección solicitada a Ingeniería de Ventas.');
        },
        error: () => this.notify.error('Error', 'No se pudo solicitar la corrección.'),
      });
    });
  }

  /** Ingeniería de Ventas devuelve el turno al Supervisor tras aplicar la corrección solicitada. */
  protected async resolveCorrection(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep('Reenviar a Supervisor', 'Confirma que la corrección solicitada ya fue aplicada. El Supervisor podrá volver a revisar la información.');
    if (!ok) return;
    const author = this.auth.currentUser();
    this.fcrService.resolveCorrection(t.id, author?.name ?? 'Ingeniería de Ventas', 'Corrección aplicada según lo solicitado.').subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.notify.success('Corrección reenviada al Supervisor.');
      },
      error: () => this.notify.error('Error', 'No se pudo reenviar la corrección al Supervisor.'),
    });
  }

  // ══════════════════════════════════════════════
  // Entrada SERVICIOS — tipo_operador / reparacion
  // ══════════════════════════════════════════════

  protected readonly tipoOperadorOptions: DynadrillSelectOption[] = (
    Object.entries(TIPO_OPERADOR_LABELS) as [TipoOperador, string][]
  ).map(([value, label]) => ({ value, label }));
  protected readonly tipoOperadorSeleccionado = signal<TipoOperador | null>(null);

  protected async confirmTipoOperador(): Promise<void> {
    const t = this.ticket();
    const value = this.tipoOperadorSeleccionado();
    if (!t || !value) return;
    const ok = await this.confirmStep('Confirmar tipo de operador', 'El ticket avanzará a Reparación.');
    if (!ok) return;
    this.fcrService.setTipoOperador(t.id, value).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.advancePhase('reparacion');
      },
      error: () => this.notify.error('Error', 'No se pudo guardar el tipo de operador.'),
    });
  }

  protected readonly reparacionDescripcion = signal('');

  protected async confirmReparacion(): Promise<void> {
    const t = this.ticket();
    const descripcion = this.reparacionDescripcion().trim();
    if (!t || !descripcion) return;
    const ok = await this.confirmStep('Confirmar reparación', 'El ticket avanzará al Formulario de Inspección.');
    if (!ok) return;
    this.fcrService.registrarReparacion(t.id, descripcion).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.advancePhase('inspeccion');
      },
      error: () => this.notify.error('Error', 'No se pudo guardar la reparación.'),
    });
  }

  // ══════════════════════════════════════════════
  // Entrada SERVICIOS — inspeccion / aprobacion_supervisor_operaciones
  // ══════════════════════════════════════════════

  protected readonly formularioExternoUploadState = computed(() => (this.ticket()?.formularioInspeccionExternoUploaded ? 'uploaded' : 'idle'));
  protected readonly dimensionamientoServicioUploadState = computed(() => (this.ticket()?.formatoDimensionamientoServicioUploaded ? 'uploaded' : 'idle'));
  protected readonly durezaServicioUploadState = computed(() => (this.ticket()?.formatoDurezaServicioUploaded ? 'uploaded' : 'idle'));

  protected readonly inspeccionServicioCompleta = computed(() => {
    const t = this.ticket();
    return !!t?.formularioInspeccionExternoUploaded && !!t?.formatoDimensionamientoServicioUploaded && !!t?.formatoDurezaServicioUploaded;
  });

  // ── Checklist de inspección por herramienta (fcr-checklist-inspeccion) ──
  // Se llena una vez por cada FcrTool del ticket, exclusivo de la rama
  // SERVICIOS. Convive con los 3 documentos de arriba — no lo reemplaza.

  protected readonly toolInspections = signal<FcrToolInspection[]>([]);

  private readonly toolInspectionByToolId = computed(() => new Map(this.toolInspections().map(i => [i.toolId, i])));

  protected toolInspectionEstado(toolId: number): string | null {
    return this.toolInspectionByToolId().get(toolId)?.estado ?? null;
  }

  protected toolChecklistButtonLabel(toolId: number): string {
    const estado = this.toolInspectionEstado(toolId);
    if (estado === 'enviado' || estado === 'aprobado') return 'Ver checklist';
    if (estado === 'borrador') return 'Continuar checklist';
    return 'Iniciar checklist';
  }

  /** RN (fcr-checklist-inspeccion): la fase no avanza a Aprobación de Supervisor si falta el checklist "enviado" de alguna herramienta. */
  protected readonly allChecklistsEnviados = computed(() => {
    const tools = this.ticket()?.tools ?? [];
    return tools.length > 0 && tools.every(tool => this.toolInspectionByToolId().get(tool.id)?.estado === 'enviado');
  });

  protected readonly puedeEnviarInspeccionServicio = computed(() => this.inspeccionServicioCompleta() && this.allChecklistsEnviados());

  private loadToolInspections(ticketId: number): void {
    this.toolInspeccionesService.listByTicket(ticketId).subscribe({
      next: list => this.toolInspections.set(list),
      error: () => this.notify.error('Error', 'No se pudieron cargar los checklists de inspección.'),
    });
  }

  protected openChecklistHerramienta(tool: FcrTool): void {
    const t = this.ticket();
    if (!t || !tool.articuloId) return;
    const ref = this.dialog.open<ChecklistHerramientaDialog, ChecklistHerramientaDialogData>({
      title: 'Checklist de inspección',
      content: ChecklistHerramientaDialog,
      data: { ticketId: t.id, toolId: tool.id, articuloId: tool.articuloId, toolName: tool.name },
      footer: false,
      width: 960,
    });
    ref.afterClose.subscribe(() => {
      // Se recarga la lista completa aunque el diálogo se haya cerrado sin
      // "Enviar" — "Guardar borrador" también persiste cambios en backend.
      this.loadToolInspections(t.id);
    });
  }

  protected onSubirInspeccionServicio(documento: 'formularioExterno' | 'dimensionamiento' | 'dureza', file: NzUploadFile): void {
    const t = this.ticket();
    const archivo = this.extraerArchivoValido(file);
    if (!t || !archivo) return;
    this.updateTicket(this.fcrService.subirDocumento(t.id, CAMPO_DOCUMENTO_SERVICIO[documento], archivo));
  }

  protected onEliminarInspeccionServicio(documento: 'formularioExterno' | 'dimensionamiento' | 'dureza'): void {
    const t = this.ticket();
    if (!t) return;
    this.updateTicket(this.fcrService.eliminarDocumento(t.id, CAMPO_DOCUMENTO_SERVICIO[documento]));
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
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el documento.'),
    });
  }

  protected async confirmEnviarInspeccionServicio(): Promise<void> {
    if (!this.puedeEnviarInspeccionServicio()) return;
    const ok = await this.confirmStep('Enviar a Supervisor', 'El ticket avanzará a Aprobación de Supervisor de Operaciones.');
    if (!ok) return;
    this.advancePhase('aprobacion_supervisor_operaciones');
  }

  protected readonly inspeccionDecision = signal<DynadrillApprovalDecision>(null);
  protected readonly inspeccionRejectionNote = signal('');

  protected async onInspeccionDecisionChange(decision: DynadrillApprovalDecision): Promise<void> {
    if (decision === 'approved') {
      const ok = await this.confirmStep('Aprobar inspección', 'El ticket continuará a Asignación de Operador.');
      if (!ok) return;
      this.inspeccionDecision.set(decision);
      this.confirmInspeccionReview('approved');
      return;
    }
    this.inspeccionDecision.set(decision);
  }

  protected async confirmInspeccionRejection(): Promise<void> {
    if (!this.inspeccionRejectionNote().trim()) return;
    const ok = await this.confirmStep('Solicitar corrección', 'Se notificará al Operador para corregir la inspección.');
    if (!ok) return;
    this.confirmInspeccionReview('rejected', this.inspeccionRejectionNote());
  }

  private confirmInspeccionReview(decision: 'approved' | 'rejected', observation?: string): void {
    const t = this.ticket();
    if (!t) return;
    this.fcrService.reviewInspeccion(t.id, decision, observation).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.inspeccionDecision.set(null);
        this.inspeccionRejectionNote.set('');
        this.advancePhase(decision === 'approved' ? 'asignacion_operador' : 'inspeccion');
      },
      error: () => this.notify.error('Error', 'No se pudo registrar la revisión de inspección.'),
    });
  }

  protected async approveValidation(): Promise<void> {
    const ok = await this.confirmStep('Aprobar información técnica', 'Confirma que la propuesta técnica y el apartado de herramientas son correctos. El ticket avanzará a Preparación de Herramientas.');
    if (!ok) return;
    this.advancePhase('preparacion_herramientas');
  }

  // ══════════════════════════════════════════════
  // Avance genérico de fase
  // ══════════════════════════════════════════════

  /** Confirmación previa a un "Continuar a X" — el paso queda bloqueado tras confirmar. */
  protected async confirmAndAdvance(phase: FcrPhase, title: string, content: string): Promise<void> {
    const ok = await this.confirmStep(title, content);
    if (!ok) return;
    this.advancePhase(phase);
  }

  /**
   * La mayoría de acciones de este flujo actualizaban `ticket` sin ningún callback de
   * error — si la petición fallaba (red caída, 500, etc.), la UI simplemente parecía
   * no haber hecho nada, sin ningún aviso de que la acción no se guardó.
   */
  private updateTicket(request: Observable<FcrTicket>): void {
    request.subscribe({
      next: updated => this.ticket.set(updated),
      error: () => this.notify.error('Error', 'No se pudo completar la acción. Inténtalo de nuevo.'),
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
      this.notify.error('Archivo no reconocido', 'No se pudo leer el archivo seleccionado. Probá de nuevo.');
      return null;
    }
    if (archivo.size > MAX_UPLOAD_SIZE_BYTES) {
      this.notify.error('Archivo demasiado grande', 'El archivo supera el máximo permitido de 2MB.');
      return null;
    }
    return archivo;
  }

  protected advancePhase(phase: FcrPhase): void {
    const t = this.ticket();
    if (!t || !this.isMyTurn()) return;
    const approver = this.auth.currentUser();
    this.fcrService.advancePhase(t.id, phase, approver?.name ?? '', approver?.roleName ?? '').subscribe({
      next: updated => this.ticket.set(updated),
      error: () => this.notify.error('Error', 'No se pudo avanzar de fase.'),
    });
  }

  // ══════════════════════════════════════════════
  // Carga inicial
  // ══════════════════════════════════════════════

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.fcrService.getTicket(id).subscribe({
      next: t => {
        this.ticket.set(t);
        this.loading.set(false);
        if (t.tipoOt === 'servicio') this.loadToolInspections(id);
        if (t.pedidoId) {
          this.pedidoService.get(t.pedidoId).subscribe({
            next: p => this.pedido.set(p),
            error: () => this.pedido.set(null),
          });
        }
      },
      error: () => this.loading.set(false),
    });
  }

  protected goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  protected formatDate(iso: string): string {
    return iso.slice(0, 10);
  }
}
