import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillApprovalActionsComponent,
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillRiskMatrixComponent,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  type DynadrillApprovalDecision,
  type DynadrillRiskMatrixValue,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  CONTROL_TYPE_LABELS,
  ControlType,
  IPERC_STATUS_LABELS,
  IpercControl,
  IpercHazard,
  IpercMatrix,
  IpercTask,
} from '../../models/iperc.model';
import { IpercService } from '../../services/iperc.service';
import { PtwService } from '../../../ptw/services/ptw.service';

interface HazardDraft {
  peligro: string;
  fuenteRiesgo: string;
  controlesExistentes: string;
}

interface ControlDraft {
  type: ControlType;
  description: string;
}

const EMPTY_HAZARD_DRAFT: HazardDraft = { peligro: '', fuenteRiesgo: '', controlesExistentes: '' };
const EMPTY_CONTROL_DRAFT: ControlDraft = { type: 'administrativo', description: '' };
const CONTROL_TYPE_OPTIONS: DynadrillSelectOption[] = (Object.entries(CONTROL_TYPE_LABELS) as [ControlType, string][]).map(
  ([value, label]) => ({ label, value }),
);

@Component({
  selector: 'app-iperc-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillRiskMatrixComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly matrix = signal<IpercMatrix | null>(null);
  protected readonly controlTypeLabels = CONTROL_TYPE_LABELS;

  protected readonly statusLabel = computed(() => {
    const m = this.matrix();
    return m ? IPERC_STATUS_LABELS[m.status] : '';
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
  /** Fase 2/3 ("identificar peligros" / "definir controles") — solo mientras la matriz sigue en evaluación, igual que el riesgo. */
  protected readonly canEditContent = this.riskEditable;

  protected readonly controlTypeOptions = CONTROL_TYPE_OPTIONS;

  protected readonly nuevaTareaDescripcion = signal('');
  protected readonly hazardDrafts = signal<Record<number, HazardDraft>>({});
  protected readonly controlDrafts = signal<Record<number, ControlDraft>>({});

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
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.ipercService.get(id).subscribe({
      next: matrix => {
        this.matrix.set(matrix);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onInitialRiskChange(hazard: IpercHazard, value: DynadrillRiskMatrixValue): void {
    this.patchHazard(hazard.id, { probabilidadInicial: value.probabilidad, severidadInicial: value.severidad });
  }

  protected onResidualRiskChange(hazard: IpercHazard, value: DynadrillRiskMatrixValue): void {
    this.patchHazard(hazard.id, { probabilidadResidual: value.probabilidad, severidadResidual: value.severidad });
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

  /** Fase 1: "Desglosar actividades en tareas secuenciales". */
  protected agregarTarea(): void {
    const current = this.matrix();
    const descripcion = this.nuevaTareaDescripcion().trim();
    if (!current || !descripcion) return;

    const nuevaTarea: IpercTask = { id: this.nextLocalId(current), descripcion, hazards: [] };
    const tasks = [...current.tasks, nuevaTarea];
    this.persistTasks(current, tasks);
    this.nuevaTareaDescripcion.set('');
  }

  protected hazardDraft(taskId: number): HazardDraft {
    return this.hazardDrafts()[taskId] ?? EMPTY_HAZARD_DRAFT;
  }

  protected setHazardDraftField(taskId: number, field: keyof HazardDraft, value: string): void {
    this.hazardDrafts.update(drafts => ({ ...drafts, [taskId]: { ...this.hazardDraft(taskId), [field]: value } }));
  }

  /** Fase 2: "Identificar peligros por tarea" + "Evaluar riesgo inicial" (el riesgo en sí se completa después, clicando la matriz). */
  protected agregarPeligro(taskId: number): void {
    const current = this.matrix();
    const draft = this.hazardDraft(taskId);
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
    this.hazardDrafts.update(drafts => ({ ...drafts, [taskId]: EMPTY_HAZARD_DRAFT }));
  }

  protected controlDraft(hazardId: number): ControlDraft {
    return this.controlDrafts()[hazardId] ?? EMPTY_CONTROL_DRAFT;
  }

  protected setControlDraftField(hazardId: number, changes: Partial<ControlDraft>): void {
    this.controlDrafts.update(drafts => ({ ...drafts, [hazardId]: { ...this.controlDraft(hazardId), ...changes } }));
  }

  /** Fase 3: "Definir controles: ingeniería, administrativos y EPP". */
  protected agregarControl(hazardId: number): void {
    const current = this.matrix();
    const draft = this.controlDraft(hazardId);
    if (!current || !draft.description.trim()) return;

    const nuevoControl: IpercControl = { id: this.nextLocalId(current), type: draft.type, description: draft.description.trim() };
    const tasks = current.tasks.map(task => ({
      ...task,
      hazards: task.hazards.map(h => (h.id === hazardId ? { ...h, controles: [...h.controles, nuevoControl] } : h)),
    }));
    this.persistTasks(current, tasks);
    this.controlDrafts.update(drafts => ({ ...drafts, [hazardId]: EMPTY_CONTROL_DRAFT }));
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

  private patchHazard(hazardId: number, changes: Partial<IpercHazard>): void {
    const current = this.matrix();
    if (!current) return;

    const tasks = current.tasks.map(task => ({
      ...task,
      hazards: task.hazards.map(h => (h.id === hazardId ? { ...h, ...changes } : h)),
    }));
    this.persistTasks(current, tasks);
  }
}
