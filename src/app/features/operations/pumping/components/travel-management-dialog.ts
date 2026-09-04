import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillInputComponent,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  DynadrillChipGroupComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  createTravelRiskQuestions,
  calculateTravelRiskLevel,
  getTravelRiskDescription,
  type TravelManagement,
  type TravelRiskLevel,
  type TravelRiskQuestion,
  type VehicleType,
} from '../models/pumping.model';

export interface TravelManagementDialogData {
  operatorName: string;
  unitCode: string;
  ticketCode: string;
  origen: string;
  destino: string;
  lineaServicio: string;
  supervisor: string;
  conductores: string;
  placas: string;
}

export interface TravelManagementDialogResult {
  completed: boolean;
  travelManagement?: TravelManagement;
}

@Component({
  selector: 'app-travel-management-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillContextCardComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillChipGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './travel-management-dialog.html',
  styleUrl: './travel-management-dialog.scss',
})
export class TravelManagementDialog {
  private readonly modalRef = inject(NzModalRef<TravelManagementDialog, TravelManagementDialogResult | undefined>);
  private readonly data = inject<TravelManagementDialogData>(NZ_MODAL_DATA);

  // ── Header fields ──
  protected readonly fecha = signal(new Date().toISOString().split('T')[0]);
  protected readonly motivoViaje = signal('');
  protected readonly lineaServicio = signal(this.data.lineaServicio);
  protected readonly origen = signal(this.data.origen);
  protected readonly destino = signal(this.data.destino);
  protected readonly gerenteSupervisor = signal(this.data.supervisor);
  protected readonly ticketNo = signal(this.data.ticketCode);
  protected readonly conductores = signal(this.data.conductores);
  protected readonly vehicleType = signal<VehicleType | null>(null);
  protected readonly placas = signal(this.data.placas);

  protected readonly vehicleTypeOptions: DynadrillSelectOption[] = [
    { label: 'Liviano', value: 'Liviano' },
    { label: 'Pesado', value: 'Pesado' },
  ];

  // ── Header context ──
  protected readonly headerItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Documento', value: 'DYN-SGI-RE-049' },
    { label: 'Ticket', value: this.ticketNo() },
    { label: 'Operador', value: this.data.operatorName },
    { label: 'Unidad', value: this.data.unitCode },
  ]);

  // ── Risk assessment questions ──
  protected readonly riskQuestions = signal<TravelRiskQuestion[]>(createTravelRiskQuestions());

  protected readonly totalPoints = computed(() => {
    const questions = this.riskQuestions();
    let total = 0;
    for (const q of questions) {
      if (q.selectedValue !== null && q.selectedValue < 999) {
        total += q.selectedValue;
      }
    }
    return total;
  });

  protected readonly hasBlockingAnswer = computed(() => {
    return this.riskQuestions().some(q => q.selectedValue === 999);
  });

  protected readonly riskLevel = computed<TravelRiskLevel>(() => {
    return calculateTravelRiskLevel(this.totalPoints());
  });

  protected readonly riskDescription = computed(() => {
    return getTravelRiskDescription(this.riskLevel());
  });

  protected readonly riskLevelColor = computed(() => {
    switch (this.riskLevel()) {
      case 'ALTO': return 'error';
      case 'MEDIO': return 'warning';
      case 'BAJO': return 'success';
    }
  });

  // ── Risk table ──
  protected readonly riskTableColumns: DynadrillDataTableColumn[] = [
    { key: 'level', header: 'RIESGO' },
    { key: 'points', header: 'PUNTOS' },
    { key: 'schedule', header: 'GESTIÓN DE RIESGOS' },
  ];

  protected readonly riskTableRows = [
    { level: 'ALTO', points: '> 75', schedule: 'Desde 23:00 pm hasta 05:00 am — Director General (Quito)' },
    { level: 'MEDIO', points: '31 a 75', schedule: 'Desde 18:00 pm hasta 23:00 am — Jefe de Base' },
    { level: 'BAJO', points: '< 30', schedule: 'Desde 05:00 pm hasta 18:00 am — Supervisor directo/Jefe de Base' },
  ];

  // ── Travel plan fields ──
  protected readonly passengers = signal('');
  protected readonly canCombineTrips = signal<string[]>([]);
  protected readonly combineOptions = ['Sí', 'No'];

  // ── Route info ──
  protected readonly routeLocation = signal('');
  protected readonly routeArrivalTime = signal('');
  protected readonly routeDepartureTime = signal('');
  protected readonly routeOvernightDetails = signal('');

  // ── Communication ──
  protected readonly commFrequency = signal('');
  protected readonly commContactPerson = signal('');
  protected readonly commContactDetails = signal('');

  // ── Approvals ──
  protected readonly conductorNames = signal(this.data.conductores);
  protected readonly approverName = signal(this.data.supervisor);

  protected onVehicleTypeChange(value: unknown): void {
    this.vehicleType.set(value as VehicleType);
  }

  // ── Question selection ──
  // Chip-group en vez de select: son solo 2-3 opciones por pregunta y 15
  // preguntas en total — con select había que abrir y cerrar el dropdown
  // 15 veces para llenar el formulario completo.
  protected onQuestionAnswer(questionId: number, value: unknown): void {
    this.riskQuestions.update(questions =>
      questions.map(q => q.id === questionId ? { ...q, selectedValue: value as number } : q),
    );
  }

  protected getQuestionOptionLabels(question: TravelRiskQuestion): string[] {
    return question.options.map(opt => opt.label);
  }

  protected getSelectedOptionLabel(question: TravelRiskQuestion): string[] {
    const selected = question.options.find(opt => opt.value === question.selectedValue);
    return selected ? [selected.label] : [];
  }

  protected onQuestionChipChange(question: TravelRiskQuestion, selectedLabels: string[]): void {
    const label = selectedLabels[0];
    const option = question.options.find(opt => opt.label === label);
    this.onQuestionAnswer(question.id, option ? option.value : null);
  }

  protected readonly allQuestionsAnswered = computed(() => {
    return this.riskQuestions().every(q => q.selectedValue !== null);
  });

  protected readonly canSubmit = computed(() => {
    return this.allQuestionsAnswered() && !this.hasBlockingAnswer() && this.motivoViaje() !== '';
  });

  // ── Actions ──
  protected submit(): void {
    const result: TravelManagement = {
      fecha: this.fecha(),
      motivoViaje: this.motivoViaje(),
      lineaServicio: this.lineaServicio(),
      origen: this.origen(),
      destino: this.destino(),
      gerenteSupervisor: this.gerenteSupervisor(),
      ticketNo: this.ticketNo(),
      conductores: this.conductores(),
      vehicleType: this.vehicleType() ?? 'Liviano',
      placas: this.placas(),
      riskQuestions: this.riskQuestions(),
      totalPoints: this.totalPoints(),
      riskLevel: this.riskLevel(),
      passengers: this.passengers(),
      canCombineTrips: this.canCombineTrips()[0] === 'Sí' ? true : this.canCombineTrips()[0] === 'No' ? false : null,
      routeInfo: [{
        location: this.routeLocation(),
        arrivalTime: this.routeArrivalTime(),
        departureTime: this.routeDepartureTime(),
        overnightDetails: this.routeOvernightDetails(),
      }],
      communication: [{
        frequency: this.commFrequency(),
        contactPerson: this.commContactPerson(),
        contactDetails: this.commContactDetails(),
      }],
      arrivalTime: this.routeArrivalTime(),
      departureTime: this.routeDepartureTime(),
      overnightData: this.routeOvernightDetails(),
      conductorNames: this.conductorNames(),
      approverName: this.approverName(),
      conductorSignature: this.conductorNames(),
      approverSignature: this.approverName(),
      phoneApprovalBy: '',
      phoneApprovalTime: '',
    };
    this.modalRef.close({ completed: true, travelManagement: result });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
