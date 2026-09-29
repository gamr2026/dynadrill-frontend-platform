import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDatetimePickerComponent,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillSelectComponent,
  DynadrillStepperComponent,
  DynadrillTagComponent,
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
  type TravelRiskOption,
  type TravelRiskQuestion,
  type VehicleType,
} from '../models/pumping.model';
import { UnidadesService } from '../../../maintenance/services/unidades.service';
import { toLocalDateString } from '../../../../shared/utils';

export interface TravelManagementDialogData {
  operatorName: string;
  unitCode: string;
  ticketCode: string;
  origen: string;
  destino: string;
  lineaServicio: string;
  /** Supervisor asignado al ticket — fallback si aún no cargó el Jefe de Base. */
  supervisor: string;
  /** Jefe de Base — "Gerente/Supervisor" (paso General) y "Gerente que autoriza" (paso Aprobación). */
  jefeBase?: string;
  /** Conductor elegido en la inspección de la unidad — no el operador del ticket. */
  conductor?: string;
  conductores: string;
  placas: string;
  /** Gerenciamiento de ida del mismo operador — al abrir el de retorno, precarga motivo/plan y ruta (editable). */
  previousTravelManagement?: TravelManagement;
}

export interface TravelManagementDialogResult {
  completed: boolean;
  travelManagement?: TravelManagement;
}

/** Ponderación que bloquea el viaje — ver createTravelRiskQuestions() en pumping.model.ts */
const BLOCKING_RISK_VALUE = 999;

const STEPS = ['General', 'Evaluación', 'Plan & Ruta', 'Aprobación'];

@Component({
  selector: 'app-travel-management-dialog',
  /** Pantalla completa en móvil (formulario largo) — ver styles.scss. */
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    DynadrillTextComponent,
    DynadrillContextCardComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillDatetimePickerComponent,
    DynadrillIconComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillStepperComponent,
    DynadrillTagComponent,
    DynadrillChipGroupComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './travel-management-dialog.html',
  styleUrl: './travel-management-dialog.scss',
})
export class TravelManagementDialog {
  private readonly modalRef = inject(NzModalRef<TravelManagementDialog, TravelManagementDialogResult | undefined>);
  private readonly data = inject<TravelManagementDialogData>(NZ_MODAL_DATA);
  private readonly unidadesService = inject(UnidadesService);

  /** true cuando el dato vino del registro maestro de la Unidad — se bloquea para no romper la integridad con Inventario. */
  protected readonly placaBloqueada = signal(false);
  protected readonly tipoBloqueado = signal(false);

  constructor() {
    // Precarga del vehículo: la placa y el tipo (Liviano/Pesado) se toman
    // del registro de la Unidad seleccionada en el ticket. Si el registro
    // maestro los tiene, quedan bloqueados; si no, se pueden escribir.
    this.unidadesService.list().subscribe(unidades => {
      const unidad = unidades.find(u => u.code === this.data.unitCode);
      if (!unidad) return;
      if (unidad.placa) {
        this.placas.set(unidad.placa);
        this.placaBloqueada.set(true);
      }
      if (unidad.categoriaPeso) {
        this.vehicleType.set(unidad.categoriaPeso);
        this.tipoBloqueado.set(true);
      }
    });
  }

  // ── Wizard steps ──
  protected readonly steps = STEPS;
  protected readonly currentStep = signal(0);

  protected goToNextStep(): void {
    this.currentStep.update(step => Math.min(step + 1, STEPS.length - 1));
  }

  protected goToPreviousStep(): void {
    this.currentStep.update(step => Math.max(step - 1, 0));
  }

  // ── Header fields ──
  // dynadrill-datetime-picker trabaja con Date, no con el string ISO que espera TravelManagement.fecha
  // (mismo patrón que user-form-dialog.ts / investigacion-dialog.ts). Tipado `Date | null` porque el
  // picker permite limpiar el campo (allowClear) y emite null pese a que su tipo declarado diga Date —
  // canSubmit/submit() lo validan.
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly motivoViaje = signal(this.data.previousTravelManagement?.motivoViaje ?? '');
  protected readonly lineaServicio = signal(this.data.lineaServicio);
  protected readonly origen = signal(this.data.origen);
  protected readonly destino = signal(this.data.destino);
  protected readonly gerenteSupervisor = signal(this.data.jefeBase || this.data.supervisor);
  protected readonly ticketNo = signal(this.data.ticketCode);
  protected readonly conductores = signal(this.data.conductor || this.data.conductores);
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

  /** Cabecera para móvil con la context-card nueva (variant="card"): ticket, unidad y operador agrupados. */
  protected readonly headerGroups = computed<DynadrillContextCardItem[][]>(() => [
    [
      { label: 'Ticket', value: this.ticketNo() || '—', icon: 'file-text' },
      { label: 'Unidad', value: this.data.unitCode || '—', icon: 'tool', badgeVariant: 'brand' },
    ],
    [{ label: 'Operador', value: this.data.operatorName || '—', icon: 'users' }],
  ]);

  // ── Risk assessment questions ──
  protected readonly riskQuestions = signal<TravelRiskQuestion[]>(createTravelRiskQuestions());

  protected readonly totalPoints = computed(() => {
    const questions = this.riskQuestions();
    let total = 0;
    for (const q of questions) {
      if (q.selectedValue !== null && q.selectedValue < BLOCKING_RISK_VALUE) {
        total += q.selectedValue;
      }
    }
    return total;
  });

  protected readonly hasBlockingAnswer = computed(() => {
    return this.riskQuestions().some(q => q.selectedValue === BLOCKING_RISK_VALUE);
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
  protected readonly passengerDraft = signal('');
  protected readonly passengersList = signal<string[]>([]);
  protected readonly passengersLabel = computed(() => {
    const count = this.passengersList().length;
    return count > 0 ? `Pasajeros (${count} agregado${count === 1 ? '' : 's'})` : 'Pasajeros';
  });
  protected readonly canCombineTrips = signal<string[]>([]);
  protected readonly combineOptions = ['Sí', 'No'];

  protected addPassenger(): void {
    const name = this.passengerDraft().trim();
    if (!name) return;
    this.passengersList.update(list => [...list, name]);
    this.passengerDraft.set('');
  }

  protected removePassenger(index: number): void {
    this.passengersList.update(list => list.filter((_, i) => i !== index));
  }

  protected onPassengerDraftKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addPassenger();
    } else if (event.key === 'Backspace' && this.passengerDraft() === '') {
      this.passengersList.update(list => list.slice(0, -1));
    }
  }

  // ── Route info — precargado del gerenciamiento de ida si existe (editable) ──
  private readonly previousRoute = this.data.previousTravelManagement?.routeInfo?.[0];
  protected readonly routeLocation = signal(this.previousRoute?.location ?? '');
  protected readonly routeArrivalTime = signal(this.previousRoute?.arrivalTime ?? '');
  protected readonly routeDepartureTime = signal(this.previousRoute?.departureTime ?? '');
  protected readonly routeOvernightDetails = signal(this.previousRoute?.overnightDetails ?? '');

  // ── Communication — mismo criterio: precargado de la ida, editable ──
  private readonly previousComm = this.data.previousTravelManagement?.communication?.[0];
  protected readonly commFrequency = signal(this.previousComm?.frequency ?? '');
  protected readonly commContactPerson = signal(this.previousComm?.contactPerson ?? '');
  protected readonly commContactDetails = signal(this.previousComm?.contactDetails ?? '');

  // ── Approvals ──
  protected readonly conductorNames = signal(this.data.conductor || this.data.conductores);
  /** Gerente que autoriza = Jefe de Base; lo confirma él al autorizar cuando el riesgo es MEDIO/ALTO. */
  protected readonly approverName = signal(this.data.jefeBase || this.data.supervisor);

  protected onVehicleTypeChange(value: unknown): void {
    this.vehicleType.set(value as VehicleType);
  }

  // ── Question selection ──
  // Varias opciones de una misma pregunta pueden compartir el mismo valor de ponderación
  // (ej. "N/A = 0" y "Sí = 0"), así que la opción marcada se rastrea por índice, no por valor.
  private readonly selectedOptionIndexByQuestion = signal<Record<number, number>>({});

  protected onQuestionAnswer(questionId: number, optionIndex: number, value: number): void {
    this.riskQuestions.update(questions =>
      questions.map(q =>
        q.id === questionId
          ? { ...q, selectedValue: value, selectedLabel: q.options[optionIndex]?.label ?? null }
          : q,
      ),
    );
    this.selectedOptionIndexByQuestion.update(byQuestion => ({ ...byQuestion, [questionId]: optionIndex }));
  }

  /**
   * Llenado rápido: responde de una sola vez cada pregunta que aún no
   * tiene respuesta, con su opción de menor riesgo (nunca una que bloquee
   * el viaje) — para no tener que clickear una por una las 12 preguntas en
   * cada prueba. No pisa respuestas ya elegidas a mano.
   *
   * Antes tomaba la PRIMERA opción no bloqueante del array (`findIndex`),
   * no la de menor puntaje — algunas preguntas (7 y 12) no traen sus
   * opciones ordenadas de menor a mayor riesgo, así que "rápido" terminaba
   * sumando 5 y 50 en vez de 0 en esas dos, dando 80 puntos totales en vez
   * de los ~25 esperados. Ahora se busca explícitamente el valor mínimo.
   */
  protected llenadoRapidoRiesgo(): void {
    const nuevosIndices: Record<number, number> = {};
    this.riskQuestions.update(questions =>
      questions.map(q => {
        if (q.selectedValue !== null) return q;
        let chosen = 0;
        let mejorValor = Infinity;
        q.options.forEach((o, i) => {
          if (o.value !== BLOCKING_RISK_VALUE && o.value < mejorValor) {
            mejorValor = o.value;
            chosen = i;
          }
        });
        nuevosIndices[q.id] = chosen;
        return { ...q, selectedValue: q.options[chosen].value, selectedLabel: q.options[chosen].label };
      }),
    );
    this.selectedOptionIndexByQuestion.update(byQuestion => ({ ...byQuestion, ...nuevosIndices }));
  }

  protected isOptionSelected(question: TravelRiskQuestion, optionIndex: number): boolean {
    return this.selectedOptionIndexByQuestion()[question.id] === optionIndex;
  }

  protected isBlockingOption(option: TravelRiskOption): boolean {
    return option.value === BLOCKING_RISK_VALUE;
  }

  /**
   * El operador solo necesita ver la opción, no la ponderación interna
   * (ej. "4m - 8m = 15" → "4m - 8m"). Se conserva cualquier texto que venga
   * después del número (ej. "Sí = 75 No viaja" → "Sí No viaja") porque ahí
   * suele ir la consecuencia de la respuesta, no el puntaje.
   */
  protected optionDisplayLabel(option: TravelRiskOption): string {
    return option.label.replace(/\s*=\s*\d+\b/, '').trim();
  }

  protected readonly allQuestionsAnswered = computed(() => {
    return this.riskQuestions().every(q => q.selectedLabel !== null);
  });

  protected readonly canSubmit = computed(() => {
    return (
      this.fecha() !== null &&
      this.allQuestionsAnswered() &&
      !this.hasBlockingAnswer() &&
      this.motivoViaje().trim() !== '' &&
      this.routeLocation().trim() !== '' &&
      this.conductorNames().trim() !== '' &&
      this.approverName().trim() !== ''
    );
  });

  /** BAJO lo cierra el supervisor directo; MEDIO/ALTO va a autorización del Jefe de Base. */
  protected readonly requiereAprobacionJefeBase = computed(() => this.riskLevel() !== 'BAJO');
  protected readonly submitLabel = computed(() =>
    this.requiereAprobacionJefeBase() ? 'Enviar para aprobación del Jefe de Base' : 'Guardar',
  );

  /**
   * Por qué el botón "Guardar" está deshabilitado — los pasos del wizard no
   * bloquean el avance, así que se llega al paso 4 sin saber qué falta.
   * (Pasajeros queda opcional: un viaje solo con conductor es válido.)
   */
  protected readonly submitHint = computed(() => {
    if (this.hasBlockingAnswer()) return 'Una de las respuestas bloquea el viaje — no se puede guardar el gerenciamiento.';
    const faltan: string[] = [];
    if (this.fecha() === null) faltan.push('Fecha (paso General)');
    if (this.motivoViaje().trim() === '') faltan.push('Motivo del viaje (paso General)');
    if (!this.allQuestionsAnswered()) faltan.push('responder todas las preguntas de la Evaluación');
    if (this.routeLocation().trim() === '') faltan.push('Locación de la ruta (Plan & Ruta)');
    if (this.conductorNames().trim() === '') faltan.push('Conductor(es) (Aprobación)');
    if (this.approverName().trim() === '') faltan.push('Gerente que autoriza (Aprobación)');
    return faltan.length ? `Falta: ${faltan.join(' · ')}.` : '';
  });

  // ── Actions ──
  protected submit(): void {
    const fecha = this.fecha();
    if (!fecha) return;
    const result: TravelManagement = {
      fecha: toLocalDateString(fecha),
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
      passengers: this.passengersList().join(', '),
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
