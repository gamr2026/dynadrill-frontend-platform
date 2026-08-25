import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_DRAWER_DATA, NzDrawerRef } from 'ng-zorro-antd/drawer';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillRiskMatrixComponent,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  dynadrillRiskLevel,
  type DynadrillRiskMatrixValue,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { CONTROL_TYPE_LABELS, ControlType, IpercControl, IpercHazard, IpercMatrix } from '../models/iperc.model';
import { IpercService } from '../services/iperc.service';

export interface IpercHazardPanelData {
  matrix: IpercMatrix;
  taskId: number;
  hazardId: number;
  editable: boolean;
}

const CONTROL_TYPE_OPTIONS: DynadrillSelectOption[] = (Object.entries(CONTROL_TYPE_LABELS) as [ControlType, string][]).map(
  ([value, label]) => ({ label, value }),
);

/**
 * Detalle de un peligro dentro de la Matriz IPERC — se abre desde el panel
 * lateral (mismo patrón que order-detail-panel en Mantenimiento) en vez de
 * expandir todo inline en la página principal, que quedaba como una pared
 * de matrices de riesgo repetidas por cada peligro.
 */
@Component({
  selector: 'app-iperc-hazard-panel',
  imports: [DynadrillTextComponent, DynadrillTagComponent, DynadrillRiskMatrixComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iperc-hazard-panel.html',
  styleUrl: './iperc-hazard-panel.scss',
})
export class IpercHazardPanel {
  private readonly ipercService = inject(IpercService);
  private readonly drawerRef = inject(NzDrawerRef<void>);
  private readonly data = inject<IpercHazardPanelData>(NZ_DRAWER_DATA);

  protected readonly isEditable = this.data.editable;
  protected readonly controlTypeLabels = CONTROL_TYPE_LABELS;
  protected readonly controlTypeOptions = CONTROL_TYPE_OPTIONS;

  /**
   * OJO: NzDrawerService copia las propiedades de nzData directamente sobre
   * la instancia del componente (además de exponerlas vía NZ_DRAWER_DATA) —
   * un campo local llamado igual que una clave de IpercHazardPanelData
   * (ej. "matrix") queda sobreescrito con el valor plano, rompiendo la
   * señal ("this.matrix is not a function"). Por eso este campo no se
   * llama igual que ninguna clave de IpercHazardPanelData.
   */
  private readonly matrixState = signal(this.data.matrix);

  protected readonly hazard = computed<IpercHazard>(() => {
    const task = this.matrixState().tasks.find(t => t.id === this.data.taskId);
    return task?.hazards.find(h => h.id === this.data.hazardId) ?? this.data.matrix.tasks[0].hazards[0];
  });

  protected readonly residualTone = computed<'success' | 'warning' | 'error' | null>(() => {
    const h = this.hazard();
    if (h.probabilidadResidual == null || h.severidadResidual == null) return null;
    const nivel = dynadrillRiskLevel(h.probabilidadResidual * h.severidadResidual);
    return nivel === 'bajo' ? 'success' : nivel === 'medio' ? 'warning' : 'error';
  });

  protected readonly controlType = signal<ControlType>('administrativo');
  protected readonly controlDescription = signal('');

  protected onInitialRiskChange(value: DynadrillRiskMatrixValue): void {
    this.patchHazard({ probabilidadInicial: value.probabilidad, severidadInicial: value.severidad });
  }

  protected onResidualRiskChange(value: DynadrillRiskMatrixValue): void {
    this.patchHazard({ probabilidadResidual: value.probabilidad, severidadResidual: value.severidad });
  }

  protected agregarControl(): void {
    if (!this.controlDescription().trim()) return;
    const nuevoControl: IpercControl = { id: this.nextLocalId(), type: this.controlType(), description: this.controlDescription().trim() };
    this.patchHazard({ controles: [...this.hazard().controles, nuevoControl] });
    this.controlDescription.set('');
  }

  protected cerrar(): void {
    this.drawerRef.close();
  }

  private nextLocalId(): number {
    let max = 0;
    for (const task of this.matrixState().tasks) {
      max = Math.max(max, task.id);
      for (const hz of task.hazards) {
        max = Math.max(max, hz.id);
        for (const c of hz.controles) max = Math.max(max, c.id);
      }
    }
    return max + 1;
  }

  private patchHazard(changes: Partial<IpercHazard>): void {
    const current = this.matrixState();
    const tasks = current.tasks.map(t =>
      t.id === this.data.taskId ? { ...t, hazards: t.hazards.map(h => (h.id === this.data.hazardId ? { ...h, ...changes } : h)) } : t,
    );
    const updated: IpercMatrix = { ...current, tasks };
    this.matrixState.set(updated);
    this.ipercService.update(current.id, { tasks }).subscribe();
  }
}
