import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillApprovalActionsComponent,
  DynadrillButtonComponent,
  DynadrillRiskMatrixComponent,
  DynadrillScreenHeaderComponent,
  DynadrillTagComponent,
  type DynadrillApprovalDecision,
  type DynadrillRiskMatrixValue,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { CONTROL_TYPE_LABELS, IPERC_STATUS_LABELS, IpercHazard, IpercMatrix } from '../../models/iperc.model';
import { IpercService } from '../../services/iperc.service';

@Component({
  selector: 'app-iperc-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillRiskMatrixComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillApprovalActionsComponent,
  ],
  templateUrl: './iperc-detail-page.html',
  styleUrl: './iperc-detail-page.scss',
})
export class IpercDetailPage {
  private readonly ipercService = inject(IpercService);
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

  protected readonly canStartEvaluation = computed(() => this.matrix()?.status === 'borrador');
  protected readonly canSendToReview = computed(() => this.matrix()?.status === 'en_evaluacion');
  protected readonly canReviewNow = computed(() => this.matrix()?.status === 'en_revision');

  protected readonly canApprove = computed(() => {
    const roleName = this.auth.currentUser()?.roleName;
    return roleName === 'Coordinador HSE' || roleName === 'Gerente HSE';
  });

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

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/iperc']);
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
    const updated: IpercMatrix = { ...current, tasks };
    this.matrix.set(updated);
    this.ipercService.update(current.id, { tasks }).subscribe();
  }
}
