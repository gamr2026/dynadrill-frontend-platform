import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillApprovalActionsComponent,
  DynadrillAvatarComponent,
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCardComponent,
  DynadrillContextCardComponent,
  DynadrillDrawerService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillScreenHeaderComponent,
  DynadrillStepperComponent,
  DynadrillTagComponent,
  dynadrillRiskLevel,
  type DynadrillApprovalDecision,
  type DynadrillContextCardItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { IPERC_STATUS_LABELS, IpercHazard, IpercMatrix, IpercStatus, IpercTask } from '../../models/iperc.model';
import { IpercService } from '../../services/iperc.service';
import { PtwService } from '../../../ptw/services/ptw.service';
import { IpercHazardPanel, IpercHazardPanelData } from '../../components/iperc-hazard-panel';

interface HazardDraft {
  peligro: string;
  fuenteRiesgo: string;
  controlesExistentes: string;
}

const EMPTY_HAZARD_DRAFT: HazardDraft = { peligro: '', fuenteRiesgo: '', controlesExistentes: '' };

/** Mismas 4 fases documentadas en HSE-PLAN-001. */
const FASE_STEPS = ['Preparación', 'Identificación/Evaluación', 'Controles/Reevaluación', 'Documentación y aprobación'];
const STATUS_STEP_INDEX: Record<IpercStatus, number> = {
  borrador: 0,
  en_evaluacion: 1,
  en_revision: 2,
  aprobada: 3,
  rechazada: 1,
};

@Component({
  selector: 'app-iperc-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillStepperComponent,
    DynadrillContextCardComponent,
    DynadrillAvatarComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillInputComponent,
    DynadrillApprovalActionsComponent,
    DynadrillBannerComponent,
  ],
  templateUrl: './iperc-detail-page.html',
  styleUrl: './iperc-detail-page.scss',
})
export class IpercDetailPage {
  private readonly ipercService = inject(IpercService);
  private readonly ptwService = inject(PtwService);
  private readonly auth = inject(AuthService);
  private readonly drawer = inject(DynadrillDrawerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly matrixId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly matrix = signal<IpercMatrix | null>(null);

  protected readonly faseSteps = FASE_STEPS;
  protected readonly faseIndex = computed(() => STATUS_STEP_INDEX[this.matrix()?.status ?? 'borrador']);

  protected readonly statusLabel = computed(() => {
    const m = this.matrix();
    return m ? IPERC_STATUS_LABELS[m.status] : '';
  });

  protected readonly statusTone = computed<DynadrillTagVariant>(() => {
    const status = this.matrix()?.status;
    if (status === 'aprobada') return 'success';
    if (status === 'rechazada') return 'error';
    if (status === 'en_revision') return 'warning';
    return 'info';
  });

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const m = this.matrix();
    if (!m) return [];
    return [
      { label: 'Código', value: m.code },
      { label: 'ATS base generado', value: m.atsGenerado ? 'Sí' : 'No' },
      { label: 'Aprobada por', value: m.approvedByName ? `${m.approvedByName}` : '—' },
      { label: 'Tareas desglosadas', value: String(m.tasks.length) },
    ];
  });

  /**
   * Fase 2/3 de HSE-PLAN-001: mientras la matriz está "en_evaluacion" se
   * edita el riesgo inicial y el residual; una vez pasa a "en_revision"
   * queda congelada hasta que se apruebe o se rechace (y vuelva a
   * evaluación).
   */
  protected readonly riskEditable = computed(() => this.matrix()?.status === 'en_evaluacion');

  /** Fase 1 de HSE-PLAN-001 ("desglosar actividad en tareas") — se puede seguir ampliando el desglose tanto en borrador como ya iniciada la evaluación. */
  protected readonly canAddTask = computed(() => {
    const status = this.matrix()?.status;
    return status === 'borrador' || status === 'en_evaluacion';
  });
  /** Fase 2 ("identificar peligros") — solo mientras la matriz sigue en evaluación, igual que el riesgo. */
  protected readonly canEditContent = this.riskEditable;

  protected readonly addingTask = signal(false);
  protected readonly nuevaTareaDescripcion = signal('');

  protected readonly addingHazardForTask = signal<number | null>(null);
  protected readonly hazardDraft = signal<HazardDraft>(EMPTY_HAZARD_DRAFT);

  protected readonly canStartEvaluation = computed(() => this.matrix()?.status === 'borrador');
  protected readonly canSendToReview = computed(() => this.matrix()?.status === 'en_evaluacion');
  protected readonly canReviewNow = computed(() => this.matrix()?.status === 'en_revision');

  protected readonly canApprove = computed(() => {
    const roleName = this.auth.currentUser()?.roleName;
    return roleName === 'Coordinador HSE' || roleName === 'Gerente HSE';
  });

  /** HSE-MASTER-001: sin IPERC aprobado el sistema bloquea la apertura del PTW — por eso solo aparece con status "aprobada". */
  protected readonly canOpenPtw = computed(() => this.matrix()?.status === 'aprobada');

  protected readonly openingPtw = signal(false);
  protected readonly openPtwError = signal('');

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.ipercService.get(this.matrixId).subscribe({
      next: matrix => {
        this.matrix.set(matrix);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Nivel de riesgo residual más alto entre los peligros de una tarea — para el badge de la card, de un vistazo. */
  protected taskRiskTone(task: IpercTask): { label: string; tone: DynadrillTagVariant } {
    const valores = task.hazards
      .map(h => (h.probabilidadResidual != null && h.severidadResidual != null ? h.probabilidadResidual * h.severidadResidual : null))
      .filter((v): v is number => v != null);
    if (task.hazards.length === 0) return { label: 'Sin peligros', tone: 'neutral' };
    if (valores.length === 0) return { label: 'Sin evaluar', tone: 'neutral' };
    const nivel = dynadrillRiskLevel(Math.max(...valores));
    return nivel === 'bajo' ? { label: 'Riesgo bajo', tone: 'success' } : nivel === 'medio' ? { label: 'Riesgo medio', tone: 'warning' } : { label: 'Riesgo alto', tone: 'error' };
  }

  protected hazardRiskTag(hazard: IpercHazard): { label: string; tone: DynadrillTagVariant } {
    if (hazard.probabilidadResidual == null || hazard.severidadResidual == null) return { label: 'Sin evaluar', tone: 'neutral' };
    const nivel = dynadrillRiskLevel(hazard.probabilidadResidual * hazard.severidadResidual);
    return nivel === 'bajo' ? { label: 'Bajo', tone: 'success' } : nivel === 'medio' ? { label: 'Medio', tone: 'warning' } : { label: 'Alto', tone: 'error' };
  }

  protected verPeligro(task: IpercTask, hazard: IpercHazard): void {
    const matrix = this.matrix();
    if (!matrix) return;
    const ref = this.drawer.open<IpercHazardPanel, IpercHazardPanelData>({
      title: 'Detalle del peligro',
      content: IpercHazardPanel,
      data: { matrix, taskId: task.id, hazardId: hazard.id, editable: this.riskEditable() },
      size: 'medium',
    });
    ref.afterClose.subscribe(() => this.reload());
  }

  protected startEvaluation(): void {
    this.transitionTo('en_evaluacion');
  }

  protected sendToReview(): void {
    this.transitionTo('en_revision');
  }

  protected onDecision(decision: DynadrillApprovalDecision): void {
    const current = this.matrix();
    if (!current || !decision) return;

    if (decision === 'approved') {
      const approvedByName = this.auth.currentUser()?.name ?? '';
      this.ipercService.approve(current.id, approvedByName).subscribe(updated => this.matrix.set(updated));
      return;
    }

    // Rechazada: vuelve a evaluación para que el equipo la corrija (HSE-MASTER-001, ciclo de mejora continua).
    this.ipercService.update(current.id, { status: 'en_evaluacion' }).subscribe(updated => this.matrix.set(updated));
  }

  /** HSE-PLAN-001 → HSE-SITIO-001: abre el PTW/Recibimiento de Sitio a partir de esta matriz ya aprobada. */
  protected abrirRecibimientoSitio(): void {
    const current = this.matrix();
    if (!current || this.openingPtw()) return;
    this.openingPtw.set(true);
    this.openPtwError.set('');
    this.ptwService.createFromIperc(current.id).subscribe({
      next: ptw => {
        this.openingPtw.set(false);
        this.router.navigate(['/dashboard/qhse/ptw', ptw.id]);
      },
      error: () => {
        this.openingPtw.set(false);
        this.openPtwError.set('No se pudo abrir el PTW. Verifica que la matriz siga aprobada e intenta de nuevo.');
      },
    });
  }

  /** HSE-TRIAGE-002 cerró una investigación con lección aprendida para esta matriz: se marca revisada tras actualizar controles. */
  protected marcarLeccionRevisada(): void {
    const current = this.matrix();
    if (!current) return;
    this.ipercService
      .update(current.id, { leccionAprendidaPendiente: false })
      .subscribe(updated => this.matrix.set(updated));
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/iperc']);
  }

  protected toggleAddTask(): void {
    this.addingTask.update(v => !v);
    this.nuevaTareaDescripcion.set('');
  }

  /** Fase 1: "Desglosar actividades en tareas secuenciales". */
  protected agregarTarea(): void {
    const current = this.matrix();
    const descripcion = this.nuevaTareaDescripcion().trim();
    if (!current || !descripcion) return;

    const nuevaTarea: IpercTask = { id: this.nextLocalId(current), descripcion, hazards: [] };
    const tasks = [...current.tasks, nuevaTarea];
    this.persistTasks(current, tasks);
    this.addingTask.set(false);
    this.nuevaTareaDescripcion.set('');
  }

  protected toggleAddHazard(taskId: number): void {
    this.addingHazardForTask.update(current => (current === taskId ? null : taskId));
    this.hazardDraft.set(EMPTY_HAZARD_DRAFT);
  }

  protected setHazardDraftField(field: keyof HazardDraft, value: string): void {
    this.hazardDraft.update(draft => ({ ...draft, [field]: value }));
  }

  /** Fase 2: "Identificar peligros por tarea" (el riesgo y los controles se completan después, dentro del panel de detalle). */
  protected agregarPeligro(taskId: number): void {
    const current = this.matrix();
    const draft = this.hazardDraft();
    if (!current || !draft.peligro.trim() || !draft.fuenteRiesgo.trim()) return;

    const nuevoPeligro: IpercHazard = {
      id: this.nextLocalId(current),
      peligro: draft.peligro.trim(),
      fuenteRiesgo: draft.fuenteRiesgo.trim(),
      controlesExistentes: draft.controlesExistentes.trim(),
      probabilidadInicial: null,
      severidadInicial: null,
      controles: [],
      probabilidadResidual: null,
      severidadResidual: null,
    };
    const tasks = current.tasks.map(t => (t.id === taskId ? { ...t, hazards: [...t.hazards, nuevoPeligro] } : t));
    this.persistTasks(current, tasks);
    this.addingHazardForTask.set(null);
    this.hazardDraft.set(EMPTY_HAZARD_DRAFT);
  }

  /** IDs únicos dentro de la matriz — no hay backend real generándolos, así que se calculan a partir del máximo existente entre tareas, peligros y controles. */
  private nextLocalId(matrix: IpercMatrix): number {
    let max = 0;
    for (const task of matrix.tasks) {
      max = Math.max(max, task.id);
      for (const hazard of task.hazards) {
        max = Math.max(max, hazard.id);
        for (const control of hazard.controles) max = Math.max(max, control.id);
      }
    }
    return max + 1;
  }

  private persistTasks(current: IpercMatrix, tasks: IpercTask[]): void {
    const updated: IpercMatrix = { ...current, tasks };
    this.matrix.set(updated);
    this.ipercService.update(current.id, { tasks }).subscribe();
  }

  private transitionTo(status: IpercMatrix['status']): void {
    const current = this.matrix();
    if (!current) return;
    this.ipercService.update(current.id, { status }).subscribe(updated => this.matrix.set(updated));
  }
}
