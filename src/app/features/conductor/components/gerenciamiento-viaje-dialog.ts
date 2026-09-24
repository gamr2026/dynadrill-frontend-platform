import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  GerenciamientoViaje,
  TravelRiskOption,
  TravelRiskQuestion,
  VehicleType,
  calculateTravelRiskLevel,
  createTravelRiskQuestions,
  getTravelRiskDescription,
} from '../models/gerenciamiento-viaje.model';
import { GerenciamientoViajeService } from '../services/gerenciamiento-viaje.service';
import { toLocalDateString } from '../../../shared/utils';

/** Ponderación que bloquea el viaje — ver createTravelRiskQuestions() en gerenciamiento-viaje.model.ts */
const BLOCKING_RISK_VALUE = 999;

/** El conductor solicita su propio Gerenciamiento de Viaje (DYN-SGI-RE-049) — mismo cuestionario que ya usaba el Supervisor dentro del ticket Pumping. */
@Component({
  selector: 'app-gerenciamiento-viaje-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
    DynadrillDataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gerenciamiento-viaje-dialog.html',
  styleUrl: './gerenciamiento-viaje-dialog.scss',
})
export class GerenciamientoViajeDialog {
  private readonly service = inject(GerenciamientoViajeService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<GerenciamientoViajeDialog, GerenciamientoViaje | undefined>);

  protected readonly submitting = signal(false);

  // ── Información general ──
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly motivoViaje = signal('');
  protected readonly origen = signal('');
  protected readonly destino = signal('');
  protected readonly ticketCode = signal('');
  protected readonly vehicleType = signal<VehicleType | null>(null);
  protected readonly placas = signal('');

  protected readonly vehicleTypeOptions: DynadrillSelectOption[] = [
    { label: 'Liviano', value: 'Liviano' },
    { label: 'Pesado', value: 'Pesado' },
  ];

  protected onVehicleTypeChange(value: unknown): void {
    this.vehicleType.set(value as VehicleType);
  }

  // ── Plan y logística ──
  protected readonly passengers = signal('');
  protected readonly departureTime = signal('');
  protected readonly arrivalTime = signal('');
  protected readonly overnightData = signal('');

  // ── Evaluación de riesgos ──
  protected readonly riskQuestions = signal<TravelRiskQuestion[]>(createTravelRiskQuestions());
  private readonly selectedOptionIndexByQuestion = signal<Record<number, number>>({});

  protected readonly totalPoints = computed(() => {
    let total = 0;
    for (const q of this.riskQuestions()) {
      if (q.selectedValue !== null && q.selectedValue < BLOCKING_RISK_VALUE) total += q.selectedValue;
    }
    return total;
  });

  protected readonly hasBlockingAnswer = computed(() => this.riskQuestions().some(q => q.selectedValue === BLOCKING_RISK_VALUE));
  protected readonly riskLevel = computed(() => calculateTravelRiskLevel(this.totalPoints()));
  protected readonly riskDescription = computed(() => getTravelRiskDescription(this.riskLevel()));
  protected readonly riskLevelColor = computed(() => {
    switch (this.riskLevel()) {
      case 'ALTO':
        return 'error';
      case 'MEDIO':
        return 'warning';
      case 'BAJO':
        return 'success';
    }
  });

  protected readonly riskTableColumns: DynadrillDataTableColumn[] = [
    { key: 'level', header: 'RIESGO' },
    { key: 'points', header: 'PUNTOS' },
    { key: 'schedule', header: 'GESTIÓN DE RIESGOS' },
  ];
  protected readonly riskTableRows = [
    { level: 'ALTO', points: '> 75', schedule: 'Requiere aprobación del Director General (Quito)' },
    { level: 'MEDIO', points: '31 a 75', schedule: 'Requiere autorización del Jefe de Base' },
    { level: 'BAJO', points: '< 30', schedule: 'Se aprueba automáticamente' },
  ];

  protected onQuestionAnswer(questionId: number, optionIndex: number, value: number): void {
    this.riskQuestions.update(questions =>
      questions.map(q => (q.id === questionId ? { ...q, selectedValue: value, selectedLabel: q.options[optionIndex]?.label ?? null } : q)),
    );
    this.selectedOptionIndexByQuestion.update(byQuestion => ({ ...byQuestion, [questionId]: optionIndex }));
  }

  protected isOptionSelected(question: TravelRiskQuestion, optionIndex: number): boolean {
    return this.selectedOptionIndexByQuestion()[question.id] === optionIndex;
  }

  protected isBlockingOption(option: TravelRiskOption): boolean {
    return option.value === BLOCKING_RISK_VALUE;
  }

  /** Mismo criterio que TravelManagementDialog: se muestra la opción sin la ponderación interna. */
  protected optionDisplayLabel(option: TravelRiskOption): string {
    return option.label.replace(/\s*=\s*\d+\b/, '').trim();
  }

  protected readonly allQuestionsAnswered = computed(() => this.riskQuestions().every(q => q.selectedLabel !== null));

  protected readonly puedeGuardar = computed(
    () =>
      this.fecha() !== null &&
      this.motivoViaje().trim().length > 0 &&
      this.origen().trim().length > 0 &&
      this.destino().trim().length > 0 &&
      this.vehicleType() !== null &&
      this.placas().trim().length > 0 &&
      this.allQuestionsAnswered() &&
      !this.hasBlockingAnswer(),
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    this.service
      .create({
        riskLevel: this.riskLevel(),
        payload: {
          fecha: toLocalDateString(this.fecha()!),
          motivoViaje: this.motivoViaje().trim(),
          origen: this.origen().trim(),
          destino: this.destino().trim(),
          ticketCode: this.ticketCode().trim() || undefined,
          vehicleType: this.vehicleType()!,
          placas: this.placas().trim(),
          passengers: this.passengers().trim() || undefined,
          departureTime: this.departureTime().trim() || undefined,
          arrivalTime: this.arrivalTime().trim() || undefined,
          overnightData: this.overnightData().trim() || undefined,
          riskQuestions: this.riskQuestions(),
          totalPoints: this.totalPoints(),
        },
      })
      .subscribe({
        next: gv => {
          this.notify.success(
            'Gerenciamiento de viaje enviado',
            gv.estado === 'aprobado' ? `${gv.code} — riesgo BAJO, aprobado automáticamente.` : `${gv.code} — pendiente de autorización del Jefe de Base.`,
          );
          this.modalRef.close(gv);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo registrar el gerenciamiento de viaje.');
        },
      });
  }
}
