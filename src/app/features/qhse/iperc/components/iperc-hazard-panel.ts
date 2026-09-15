import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_DRAWER_DATA, NzDrawerRef } from 'ng-zorro-antd/drawer';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  calcularNP,
  calcularNR,
  CONTROL_TYPE_LABELS,
  ControlType,
  GtcEvaluacion,
  interpretarNP,
  interpretarNR,
  IpercControl,
  IpercHazard,
  IpercMatrix,
  NC_OPCIONES,
  ND_OPCIONES,
  NE_OPCIONES,
} from '../models/iperc.model';
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

type MomentoGtc = 'riesgoInicial' | 'riesgoResidual';

/**
 * Detalle de un peligro dentro de la Matriz IPERC — se abre desde el panel
 * lateral (mismo patrón que order-detail-panel en Mantenimiento) en vez de
 * expandir todo inline en la página principal.
 *
 * La evaluación de riesgo sigue GTC 45 completo (confirmado leyendo el
 * Excel real DYN-SGI-RE-087): se eligen ND (deficiencia) y NE (exposición)
 * — el sistema calcula NP = ND×NE — y NC (consecuencia) — el sistema
 * calcula NR = NP×NC y su banda I-IV. Ya no es la matriz visual
 * Probabilidad×Severidad de antes (dynadrill-risk-matrix, en dynadrill-ui)
 * — esa solo modelaba un eje 1-5 por lado, no la jerarquía real de la
 * norma. Se abandona ese componente compartido acá (nadie más lo usaba en
 * todo el frontend) en vez de generalizarlo para un único consumidor.
 */
@Component({
  selector: 'app-iperc-hazard-panel',
  imports: [
    DynadrillTextComponent,
    DynadrillTagComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillButtonComponent,
    DynadrillCheckboxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iperc-hazard-panel.html',
  styleUrl: './iperc-hazard-panel.scss',
})
export class IpercHazardPanel {
  private readonly ipercService = inject(IpercService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly drawerRef = inject(NzDrawerRef<void>);
  private readonly data = inject<IpercHazardPanelData>(NZ_DRAWER_DATA);

  protected readonly isEditable = this.data.editable;
  protected readonly controlTypeLabels = CONTROL_TYPE_LABELS;
  protected readonly controlTypeOptions = CONTROL_TYPE_OPTIONS;
  protected readonly ndOpciones = ND_OPCIONES;
  protected readonly neOpciones = NE_OPCIONES;
  protected readonly ncOpciones = NC_OPCIONES;
  protected readonly interpretarNP = interpretarNP;
  protected readonly interpretarNR = interpretarNR;

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

  protected readonly npInicial = computed(() => calcularNP(this.hazard().riesgoInicial.nd, this.hazard().riesgoInicial.ne));
  protected readonly nrInicial = computed(() => calcularNR(this.hazard().riesgoInicial.nd, this.hazard().riesgoInicial.ne, this.hazard().riesgoInicial.nc));
  protected readonly npResidual = computed(() => calcularNP(this.hazard().riesgoResidual.nd, this.hazard().riesgoResidual.ne));
  protected readonly nrResidual = computed(() =>
    calcularNR(this.hazard().riesgoResidual.nd, this.hazard().riesgoResidual.ne, this.hazard().riesgoResidual.nc),
  );

  protected readonly residualTone = computed<'success' | 'warning' | 'error' | null>(() => {
    const nr = this.nrResidual();
    if (nr == null) return null;
    const { nivel } = interpretarNR(nr);
    // I/II = No aceptable (crítico); III = Mejorable (advertencia); IV = Aceptable.
    return nivel === 'IV' ? 'success' : nivel === 'III' ? 'warning' : 'error';
  });

  protected readonly controlType = signal<ControlType>('administrativo');
  protected readonly controlDescription = signal('');

  protected seleccionarEje(momento: MomentoGtc, campo: keyof GtcEvaluacion, valor: number): void {
    if (!this.isEditable) return;
    const actual = this.hazard()[momento];
    // Clic sobre el mismo valor ya marcado lo limpia — permite corregir sin un botón "quitar" aparte.
    const nuevoValor = actual[campo] === valor ? null : valor;
    this.patchHazard({ [momento]: { ...actual, [campo]: nuevoValor } } as Partial<IpercHazard>);
  }

  protected setClasificacionPeligro(valor: string): void {
    this.patchHazard({ clasificacionPeligro: valor || undefined });
  }

  protected setNumeroExpuestos(valor: string): void {
    this.patchHazard({ numeroExpuestos: valor ? +valor : undefined });
  }

  protected setPeorConsecuencia(valor: string): void {
    this.patchHazard({ peorConsecuencia: valor || undefined });
  }

  protected setRequisitoLegal(valor: boolean): void {
    this.patchHazard({ requisitoLegal: valor });
  }

  protected setControlesExistentes(valor: string): void {
    this.patchHazard({ controlesExistentes: valor });
  }

  protected setGeneradoEn(valor: string): void {
    this.patchHazard({ generadoEn: valor || undefined });
  }

  protected setEfectosPosibles(valor: string): void {
    this.patchHazard({ efectosPosibles: valor || undefined });
  }

  protected setControlesExistentesMedio(valor: string): void {
    this.patchHazard({ controlesExistentesMedio: valor || undefined });
  }

  protected setControlesExistentesIndividuo(valor: string): void {
    this.patchHazard({ controlesExistentesIndividuo: valor || undefined });
  }

  protected setSeguimiento(valor: string): void {
    this.patchHazard({ seguimiento: valor || undefined });
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
    this.ipercService.update(current.id, { tasks }).subscribe({
      error: () => {
        this.matrixState.set(current);
        this.notify.error('Error', 'No se pudo guardar el cambio. Inténtalo de nuevo.');
      },
    });
  }
}
