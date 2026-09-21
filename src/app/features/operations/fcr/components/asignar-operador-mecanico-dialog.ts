import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillIconComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { TIPO_OPERADOR_LABELS, TipoOperador } from '../models/fcr-catalogos.model';

export interface AsignarOperadorMecanicoDialogData {
  ticketCode: string;
  /** Especialidad ya elegida en 'tipo_operador' — precarga el filtro, pero la tabla sigue permitiendo ver las demás. */
  tipoOperador: TipoOperador;
}

export interface AsignarOperadorMecanicoDialogResult {
  assigned: boolean;
  operatorName?: string;
}

interface MechanicOperator {
  name: string;
  tipo: TipoOperador;
  disponible: boolean;
}

type FiltroTipo = TipoOperador | 'todos';

/** Roster simulado — sin backend real de personal todavía (mismo criterio que `OPERATOR_SCHEDULE` de `AsignarOperadorDialog`). */
const MECHANIC_ROSTER: MechanicOperator[] = [
  { name: 'F. Ortega', tipo: 'mecanico', disponible: true },
  { name: 'L. Andrade', tipo: 'mecanico', disponible: false },
  { name: 'S. Moreno', tipo: 'mecanico', disponible: true },
  { name: 'D. Herrera', tipo: 'soldador', disponible: true },
  { name: 'C. Benítez', tipo: 'soldador', disponible: true },
  { name: 'N. Castillo', tipo: 'soldador', disponible: false },
];

/** Simula la latencia de una búsqueda real de roster/disponibilidad de personal. */
const SIMULATED_FETCH_DELAY_MS = 500;

/**
 * Selector de operador mecánico/soldador para la fase `tipo_operador` — a
 * diferencia de `AsignarOperadorDialog` (operador de campo, un `<select>` con
 * disponibilidad por rango), acá se pidió explícitamente una tabla filtrable
 * por especialidad: cada fila es un operador, se elige haciendo click en su
 * fila (deshabilitada si no está disponible).
 */
@Component({
  selector: 'app-asignar-operador-mecanico-dialog',
  imports: [DynadrillTextComponent, DynadrillSelectComponent, DynadrillIconComponent, DynadrillSpinnerComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asignar-operador-mecanico-dialog.html',
  styleUrl: './asignar-operador-mecanico-dialog.scss',
})
export class AsignarOperadorMecanicoDialog {
  private readonly modalRef = inject(NzModalRef<AsignarOperadorMecanicoDialog, AsignarOperadorMecanicoDialogResult | undefined>);
  protected readonly data = inject<AsignarOperadorMecanicoDialogData>(NZ_MODAL_DATA);

  protected readonly tipoLabels = TIPO_OPERADOR_LABELS;
  protected readonly filtroOptions: DynadrillSelectOption[] = [
    { label: 'Todos', value: 'todos' },
    ...(Object.entries(TIPO_OPERADOR_LABELS) as [TipoOperador, string][]).map(([value, label]) => ({ value, label })),
  ];

  protected readonly filtroTipo = signal<FiltroTipo>(this.data.tipoOperador);
  protected readonly selectedOperator = signal<string | null>(null);

  protected readonly loading = signal(true);
  protected readonly roster = signal<MechanicOperator[]>([]);
  private pendingFetch?: ReturnType<typeof setTimeout>;

  constructor() {
    this.fetchRoster();
    inject(DestroyRef).onDestroy(() => {
      if (this.pendingFetch) clearTimeout(this.pendingFetch);
    });
  }

  private fetchRoster(): void {
    if (this.pendingFetch) clearTimeout(this.pendingFetch);
    this.loading.set(true);
    this.pendingFetch = setTimeout(() => {
      this.roster.set(MECHANIC_ROSTER);
      this.loading.set(false);
    }, SIMULATED_FETCH_DELAY_MS);
  }

  protected readonly filasVisibles = computed(() => {
    const filtro = this.filtroTipo();
    return filtro === 'todos' ? this.roster() : this.roster().filter(op => op.tipo === filtro);
  });

  protected readonly canAssign = computed(() => !!this.selectedOperator());

  protected onFiltroChange(value: unknown): void {
    this.filtroTipo.set(value as FiltroTipo);
    this.selectedOperator.set(null);
  }

  protected seleccionar(operador: MechanicOperator): void {
    if (!operador.disponible) return;
    this.selectedOperator.set(operador.name);
  }

  protected asignar(): void {
    const operatorName = this.selectedOperator();
    if (!operatorName) return;
    this.modalRef.close({ assigned: true, operatorName });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
