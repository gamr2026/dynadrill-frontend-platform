import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import {
  DynadrillButtonComponent,
  DynadrillIconComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';

export interface AsignarOperadorDialogData {
  ticketCode: string;
  /** Fecha estimada del servicio (ISO 'YYYY-MM-DD') — precarga el inicio del rango a verificar. */
  estimatedDate: string;
}

export interface AsignarOperadorDialogResult {
  assigned: boolean;
  operatorName?: string;
}

interface OperatorSchedule {
  name: string;
  /** Rangos (ISO 'YYYY-MM-DD') en los que el operador ya está comprometido en otro trabajo. */
  busyRanges: { start: string; end: string }[];
}

interface OperatorAvailability {
  name: string;
  available: boolean;
  detail: string;
}

/**
 * Roster + disponibilidad simulados — sin backend real de personal para
 * FCR todavía. Cubre a propósito los 4 casos posibles frente a un rango:
 * disponible todo el rango, ocupado todo el rango, sale del rango a
 * mitad de camino, y se incorpora a mitad de camino. Se agregan además
 * dos operadores con compromisos que no tocan el rango por defecto, para
 * que el roster se sienta real (no solo los 3 casos mínimos).
 */
const OPERATOR_SCHEDULE: OperatorSchedule[] = [
  { name: 'J. Paredes', busyRanges: [{ start: '2026-08-25', end: '2026-08-28' }] },
  { name: 'M. Salazar', busyRanges: [{ start: '2026-09-11', end: '2026-09-15' }] },
  { name: 'R. Chávez', busyRanges: [{ start: '2026-08-01', end: '2026-12-31' }] },
  { name: 'E. Guerrero', busyRanges: [{ start: '2026-09-08', end: '2026-09-11' }] },
  { name: 'P. Vera', busyRanges: [] },
  { name: 'A. Torres', busyRanges: [{ start: '2026-09-01', end: '2026-09-03' }, { start: '2026-09-20', end: '2026-09-25' }] },
];

/** Simula la latencia de una búsqueda real de disponibilidad contra un roster/calendario de personal. */
const SIMULATED_FETCH_DELAY_MS = 600;

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addDaysIso(iso: string, days: number): string {
  return toIso(addDays(new Date(`${iso}T00:00:00`), days));
}

function formatShort(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

@Component({
  selector: 'app-asignar-operador-dialog',
  // NzDatePickerModule/FormsModule en vez de dynadrill-datetime-picker: la
  // librería todavía no tiene un átomo de rango de fechas (dynadrill-
  // datetime-picker es de una sola fecha) — excepción puntual, mismo
  // criterio que dynadrill-icon/dynadrill-timer para lo que la librería
  // aún no cubre.
  imports: [DynadrillTextComponent, DynadrillSelectComponent, DynadrillIconComponent, DynadrillSpinnerComponent, DynadrillButtonComponent, FormsModule, NzDatePickerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asignar-operador-dialog.html',
  styleUrl: './asignar-operador-dialog.scss',
})
export class AsignarOperadorDialog {
  private readonly modalRef = inject(NzModalRef<AsignarOperadorDialog, AsignarOperadorDialogResult | undefined>);
  protected readonly data = inject<AsignarOperadorDialogData>(NZ_MODAL_DATA);

  private readonly initialStart = new Date(`${this.data.estimatedDate}T00:00:00`);

  protected readonly rangeStart = signal(this.initialStart);
  protected readonly rangeEnd = signal(addDays(this.initialStart, 2));
  protected readonly selectedOperator = signal<string | null>(null);

  /** Un solo widget de rango en vez de dos date-pickers separados — más claro y evita el desajuste si se edita uno sin el otro. */
  protected readonly dateRange = computed<[Date, Date]>(() => [this.rangeStart(), this.rangeEnd()]);

  /**
   * Resultado de la "búsqueda" de disponibilidad — separado del rango
   * elegido porque se llena de forma asíncrona (simulando una consulta
   * real al backend de personal), no al vuelo con cada tecla/click.
   */
  protected readonly loadingOperators = signal(true);
  protected readonly availability = signal<OperatorAvailability[]>([]);

  private pendingFetch?: ReturnType<typeof setTimeout>;

  constructor() {
    this.fetchAvailability();
    inject(DestroyRef).onDestroy(() => {
      if (this.pendingFetch) clearTimeout(this.pendingFetch);
    });
  }

  protected readonly operatorOptions = computed<DynadrillSelectOption[]>(() =>
    this.availability().map(a => ({
      label: `${a.name} — ${a.detail}`,
      value: a.name,
      icon: a.available ? 'check' : 'close',
    })),
  );

  protected readonly canAssign = computed(() => {
    const selected = this.selectedOperator();
    if (!selected || this.loadingOperators()) return false;
    return this.availability().find(a => a.name === selected)?.available ?? false;
  });

  /**
   * Simula el llamado al backend de personal: recalcula disponibilidad
   * contra el rango elegido con una latencia falsa, en vez de resolverla
   * de forma síncrona — así el flujo se comporta como una búsqueda real
   * ("Buscando disponibilidad…") y no como datos ya cargados de antemano.
   */
  private fetchAvailability(): void {
    if (this.pendingFetch) clearTimeout(this.pendingFetch);
    this.loadingOperators.set(true);
    const start = toIso(this.rangeStart());
    const end = toIso(this.rangeEnd());
    this.pendingFetch = setTimeout(() => {
      this.availability.set(OPERATOR_SCHEDULE.map(op => this.describeAvailability(op, start, end)));
      this.loadingOperators.set(false);
    }, SIMULATED_FETCH_DELAY_MS);
  }

  /**
   * Disponibilidad de cada operador contra el rango elegido — no es un
   * simple sí/no: distingue a quien sale del rango (estaba libre y deja de
   * estarlo antes de que termine) de quien se incorpora dentro del rango
   * (estaba ocupado y se libera antes de que termine), para que el
   * Supervisor entienda POR QUÉ alguien no califica y pueda ajustar fechas.
   */
  private describeAvailability(op: OperatorSchedule, rangeStart: string, rangeEnd: string): OperatorAvailability {
    const busy = op.busyRanges.find(r => r.start <= rangeEnd && r.end >= rangeStart);
    if (!busy) return { name: op.name, available: true, detail: 'Disponible todo el rango' };

    const coversFullRange = busy.start <= rangeStart && busy.end >= rangeEnd;
    if (coversFullRange) {
      return { name: op.name, available: false, detail: `Ocupado todo el rango (hasta ${formatShort(busy.end)})` };
    }
    if (busy.start > rangeStart) {
      return { name: op.name, available: false, detail: `Disponible al inicio, sale del rango el ${formatShort(busy.start)}` };
    }
    return { name: op.name, available: false, detail: `Ocupado al inicio, se incorpora el ${formatShort(addDaysIso(busy.end, 1))}` };
  }

  protected onDateRangeChange(value: (Date | null)[] | null): void {
    if (!value || !value[0] || !value[1]) return;
    this.rangeStart.set(value[0]);
    this.rangeEnd.set(value[1]);
    this.selectedOperator.set(null);
    this.fetchAvailability();
  }

  protected onOperatorChange(value: unknown): void {
    this.selectedOperator.set(value as string);
  }

  protected assign(): void {
    const operatorName = this.selectedOperator();
    if (!operatorName) return;
    this.modalRef.close({ assigned: true, operatorName });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
