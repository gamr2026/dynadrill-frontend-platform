import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import type { Observable } from 'rxjs';
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
import { FcrService } from '../../services/fcr.service';
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
import { SolicitarCorreccionDialog, SolicitarCorreccionDialogData, SolicitarCorreccionDialogResult } from '../../components/solicitar-correccion-dialog';
import { AsignarOperadorDialog, AsignarOperadorDialogData, AsignarOperadorDialogResult } from '../../components/asignar-operador-dialog';
import { FirmaActaDialog, FirmaActaDialogData, FirmaActaDialogResult } from '../../components/firma-acta-dialog';
import { HerramientaFaltanteDialog, HerramientaFaltanteDialogData, HerramientaFaltanteDialogResult } from '../../components/herramienta-faltante-dialog';
import { GuiaSalidaBodegaDialog, GuiaSalidaBodegaDialogData, GuiaSalidaBodegaDialogResult } from '../../components/guia-salida-bodega-dialog';
import { CierreTicketDialog, CierreTicketDialogData, CierreTicketDialogResult } from '../../components/cierre-ticket-dialog';
import {
  ReporteHerramientasPdfDialog,
  ReporteHerramientasPdfDialogData,
  ReporteJobPdfDialog,
  ReporteJobPdfDialogData,
  OperativoDocsBridgeService,
} from '../../../../../shared/index';

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

const PHASE_KEYS: FcrPhase[] = [
  'validacion',
  'preparacion_herramientas',
  'asignacion_operador',
  'reunion_operativa',
  'ejecucion_campo',
  'revision_reportes',
  'control_retorno',
  'cierre',
];

/** Catálogo simulado del inventario del cliente (RN-FCR-008A: no se permite seleccionar fuera de él). */
const CLIENT_INVENTORY_CATALOG = [
  'Tubería de perforación 5"',
  'Estabilizador 8 1/2"',
  'Martillo de fondo',
  'Sarta de perforación',
  'Broca tricónica 12 1/4"',
  'Estabilizador 6 3/4"',
  'Válvula de contrapresión',
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
    DynadrillTextareaComponent,
    DynadrillUploadZoneComponent,
    DynadrillApprovalActionsComponent,
    TicketQhseBanner,
  ],
  templateUrl: './ticket-detail-page.html',
  styleUrl: './ticket-detail-page.scss',
})
export class FcrTicketDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fcrService = inject(FcrService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly docsBridge = inject(OperativoDocsBridgeService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  protected readonly loading = signal(true);
  protected readonly ticket = signal<FcrTicket | null>(null);

  // ── Gates QHSE (HSE-PLAN-001 cobertura IPERC + HSE-SITIO-001 PTW + HSE-SEGUIMIENTO-003 SWA + HSE-TRIAGE-001 Emergencia) ──
  protected readonly qhseVinculo = computed(() => this.ticket()?.qhse ?? null);
  protected readonly coberturaOk = computed(() => coberturaOk(this.qhseVinculo()));
  protected readonly ptwFirmadoOk = computed(() => ptwFirmadoOk(this.qhseVinculo()));
  protected readonly swa = computed(() => swaActivo(this.qhseVinculo()));
  protected readonly emergencia = computed(() => emergenciaActiva(this.qhseVinculo()));
  protected readonly puedeVerQhse = computed(() => QHSE_VIEWER_ROLES.includes(this.roleName()));

  // ── Tracker de fases ──

  protected readonly phaseLabels = PHASE_KEYS.map(p => FCR_PHASE_LABELS[p]);

  protected readonly currentPhaseIndex = computed(() => {
    const t = this.ticket();
    return t ? PHASE_KEYS.indexOf(t.currentPhase) : 0;
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

  protected readonly availableToAdd = computed<DynadrillSelectOption[]>(() => {
    const currentNames = new Set(this.ticket()?.tools.map(t => t.name) ?? []);
    return CLIENT_INVENTORY_CATALOG.filter(name => !currentNames.has(name)).map(name => ({ label: name, value: name }));
  });

  protected readonly toolToAdd = signal<string | null>(null);

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
    this.toolToAdd.set(value as string | null);
  }

  protected addTool(): void {
    const name = this.toolToAdd();
    const t = this.ticket();
    if (!name || !t) return;
    this.fcrService.addTool(t.id, name).subscribe({
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

  protected async onInspectionUploaded(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const ok = await this.confirmStep('Confirmar documento de inspección', 'Al confirmar se generan la Guía de Movimiento y la Guía de Revisión. Esta acción no se puede deshacer.');
    if (!ok) return;
    this.fcrService.markInspectionUploaded(t.id).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.notify.success('Guía de Movimiento y Guía de Revisión generadas.');
      },
      error: () => this.notify.error('Error', 'No se pudo confirmar el documento de inspección.'),
    });
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

  protected readonly usageToolOptions = computed<DynadrillSelectOption[]>(() => (this.ticket()?.tools ?? []).map(tool => ({ label: tool.name, value: tool.id })));
  protected readonly usageStatusOptions: DynadrillSelectOption[] = (Object.entries(FCR_TOOL_DAILY_STATUS_LABELS) as [FcrToolDailyStatus, string][]).map(
    ([value, label]) => ({ label: `${FCR_TOOL_DAILY_STATUS_CODE[value]} — ${label}`, value }),
  );

  protected readonly canAddToolUsage = computed(() => this.usageToolId() !== null && this.usageStatus() !== null);

  protected readonly sortedToolUsageLog = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return [...t.toolUsageLog]
      .sort((a, b) => (a.date + a.toolId).localeCompare(b.date + b.toolId))
      .map(entry => ({ ...entry, toolName: t.tools.find(tool => tool.id === entry.toolId)?.name ?? `#${entry.toolId}` }));
  });

  protected readonly toolDailyStatusLabel = (status: FcrToolDailyStatus): string => `${FCR_TOOL_DAILY_STATUS_CODE[status]} — ${FCR_TOOL_DAILY_STATUS_LABELS[status]}`;

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
    if (!t || toolId === null || !status) return;
    this.fcrService.addToolUsageEntry(t.id, { toolId, date: toIso(this.usageDate()), status }).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.usageToolId.set(null);
        this.usageStatus.set(null);
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
          this.auth.switchRole('Ingeniería de Ventas', 7);
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
        this.auth.switchRole('Supervisor', 1);
      },
      error: () => this.notify.error('Error', 'No se pudo reenviar la corrección al Supervisor.'),
    });
  }

  protected async approveValidation(): Promise<void> {
    const ok = await this.confirmStep('Aprobar información técnica', 'Confirma que la propuesta técnica y el apartado de herramientas son correctos. El ticket avanzará a Preparación de Herramientas.');
    if (!ok) return;
    this.advancePhase('preparacion_herramientas');
  }

  // ══════════════════════════════════════════════
  // Avance genérico de fase (con auto-switch de rol para la demo)
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

  protected advancePhase(phase: FcrPhase): void {
    const t = this.ticket();
    if (!t || !this.isMyTurn()) return;

    // Gate HSE-TRIAGE-001: con una emergencia abierta, nada avanza (mayor severidad que un SWA).
    const e = this.emergencia();
    if (e) {
      this.notify.error('Emergencia activa', `Emergencia ${e.code} abierta. El servicio no puede avanzar hasta que se cierre en QHSE.`);
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
    if ((phase === 'asignacion_operador' || phase === 'ejecucion_campo') && !this.coberturaOk()) {
      this.notify.error(
        'Matriz IPERC incompleta',
        `HSE tiene pendiente aprobar ${actividadesPendientesTexto(this.qhseVinculo())} en la matriz maestra.`,
      );
      return;
    }
    // Gate HSE-SITIO-001: no se ejecuta en campo sin el PTW firmado en sitio
    // (FCR-004 "Descargar documentos HSE", RN-FCR-016).
    if (phase === 'ejecucion_campo' && !this.ptwFirmadoOk()) {
      const p = this.qhseVinculo()?.ptw;
      this.notify.error(
        'PTW pendiente',
        p
          ? `El servicio no puede pasar a ejecución de campo: el PTW ${p.code} está en ${ptwFaseLabel(
              p.fase,
            )} — falta la firma en sitio.`
          : 'El servicio no puede pasar a ejecución de campo: todavía no se abrió el PTW / Recibimiento de Sitio en QHSE.',
      );
      return;
    }

    const approver = this.auth.currentUser();
    this.fcrService.advancePhase(t.id, phase, approver?.name ?? '', approver?.roleName ?? '').subscribe({
      next: updated => {
        this.ticket.set(updated);
        const nextRole = FCR_PHASE_ROLE[phase];
        this.auth.switchRole(nextRole.roleName, nextRole.roleId);
      },
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
