import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDatetimePickerComponent,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillStepperComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import {
  GerenciamientoViaje,
  GerenciamientoViajeTipo,
  TicketContexto,
  TicketConductor,
  GERENCIAMIENTO_VIAJE_TIPO_LABELS,
  TravelRiskOption,
  TravelRiskQuestion,
  VehicleType,
  calculateTravelRiskLevel,
  createTravelRiskQuestions,
  getTravelRiskDescription,
} from '../models/gerenciamiento-viaje.model';
import { GerenciamientoViajeService } from '../services/gerenciamiento-viaje.service';
import { toLocalDateString } from '../../../shared/utils';

export interface GerenciamientoViajeDialogData {
  tipo: GerenciamientoViajeTipo;
  /** Desde la tabla de Pumping el ticket ya viene resuelto: el conductor no teclea el código. */
  ticket?: TicketContexto | TicketConductor;
}

/** Ponderación que bloquea el viaje — ver createTravelRiskQuestions() en gerenciamiento-viaje.model.ts */
const BLOCKING_RISK_VALUE = 999;

const STEPS = ['General', 'Evaluación', 'Plan y ruta', 'Confirmación'];

const VEHICLE_TYPE_OPTIONS: DynadrillSelectOption[] = [
  { label: 'Liviano', value: 'Liviano' },
  { label: 'Pesado', value: 'Pesado' },
];

/**
 * El conductor solicita su propio Gerenciamiento de Viaje (DYN-SGI-RE-049)
 * — antes lo llenaba el Supervisor desde dentro del ticket Pumping (ver
 * `travel-management-dialog.ts`, retirado); mismo cuestionario de riesgo y
 * mismos campos, reconstruidos acá porque el conductor no tiene acceso al
 * ticket. `approverName`/`approverSignature`/`phoneApprovalBy` del formato
 * original nunca los llenaba quien creaba el gerenciamiento (quedaban vacíos
 * o los fijaba el Jefe de Base al autorizar) — acá directamente no se piden:
 * la autorización real es el `aprobar`/`rechazar` de la bandeja.
 */
@Component({
  selector: 'app-gerenciamiento-viaje-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
    DynadrillDataTableComponent,
    DynadrillStepperComponent,
    DynadrillContextCardComponent,
    DynadrillChipGroupComponent,
    DynadrillTagComponent,
    DynadrillIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  templateUrl: './gerenciamiento-viaje-dialog.html',
  styleUrl: './gerenciamiento-viaje-dialog.scss',
})
export class GerenciamientoViajeDialog {
  private readonly data = inject<GerenciamientoViajeDialogData>(NZ_MODAL_DATA);
  private readonly service = inject(GerenciamientoViajeService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<GerenciamientoViajeDialog, GerenciamientoViaje | undefined>);

  protected readonly steps = STEPS;
  protected readonly currentStep = signal(0);
  protected readonly submitting = signal(false);
  protected readonly tipo = this.data.tipo;
  protected readonly tipoLabel = GERENCIAMIENTO_VIAJE_TIPO_LABELS[this.tipo];

  // ── Paso 1: Información general ──
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly motivoViaje = signal('');
  protected readonly ticketCode = signal('');
  protected readonly buscandoTicket = signal(false);
  protected readonly ticketEncontrado = signal(false);
  protected readonly ticketId = signal<number | undefined>(undefined);
  protected readonly lineaServicio = signal('');
  protected readonly origen = signal('');
  protected readonly destino = signal('');
  protected readonly assignedSupervisorNombre = signal('');
  protected readonly vehicleType = signal<VehicleType | null>(null);
  protected readonly placas = signal('');
  protected readonly vehicleTypeOptions = VEHICLE_TYPE_OPTIONS;

  /** Ticket fijado desde la tabla de Pumping — oculta el buscador. */
  protected readonly ticketFijo = !!this.data.ticket;

  constructor() {
    const t = this.data.ticket;
    if (t) {
      this.ticketCode.set(t.code);
      this.ticketId.set(t.id);
      this.origen.set(t.origen);
      this.destino.set(t.destino);
      this.lineaServicio.set(t.serviceType);
      this.assignedSupervisorNombre.set(t.assignedSupervisor);
      this.ticketEncontrado.set(true);
      if ('vehiculo' in t) {
        // Datos de la unidad inspeccionada: el conductor ya no los teclea (los puede corregir).
        this.placas.set(t.vehiculo.placa);
        this.vehicleType.set(this.tipoDeVehiculo(t.vehiculo.tipo));
        this.motivoViaje.set(`Traslado de la unidad ${t.vehiculo.unidadCode || t.unitCode} — ${t.code}`);
        if (t.conductor) this.conductorNames.set(t.conductor);
      }
    }
  }

  /** "Camioneta" → Liviano; "Camión"/"Cabezal" → Pesado; si no se reconoce, se deja para que el conductor elija. */
  private tipoDeVehiculo(tipo: string): VehicleType | null {
    const t = tipo.toLowerCase();
    if (/camioneta|liviano|auto|jeep/.test(t)) return 'Liviano';
    if (/cami[oó]n|cabezal|pesado|tanquero|tr[aá]iler/.test(t)) return 'Pesado';
    return null;
  }

  protected onVehicleTypeChange(value: unknown): void {
    this.vehicleType.set(value as VehicleType);
  }

  /** Autocompleta origen/destino/línea de servicio/supervisor asignado — el conductor no debe volver a tipearlos. */
  protected buscarTicket(): void {
    const code = this.ticketCode().trim();
    if (!code || this.buscandoTicket()) return;
    this.buscandoTicket.set(true);
    this.ticketEncontrado.set(false);
    this.service.contextoDeTicket(code).subscribe({
      next: ctx => {
        this.ticketId.set(ctx.id);
        this.origen.set(ctx.origen);
        this.destino.set(ctx.destino);
        this.lineaServicio.set(ctx.serviceType);
        this.assignedSupervisorNombre.set(ctx.assignedSupervisor);
        this.ticketEncontrado.set(true);
        this.buscandoTicket.set(false);
      },
      error: () => {
        this.buscandoTicket.set(false);
        this.ticketEncontrado.set(false);
        this.notify.error('No encontrado', `No se encontró el ticket "${code}".`);
      },
    });
  }

  /** Cabecera móvil con la context-card nueva (variant="card"): ticket y tipo de viaje agrupados. */
  protected readonly headerGroups = computed<DynadrillContextCardItem[][]>(() => [
    [
      { label: 'Ticket', value: this.ticketCode() || '—', icon: 'file-text' },
      { label: 'Tipo de viaje', value: this.tipoLabel, icon: 'tool', badgeVariant: 'brand' },
    ],
  ]);

  protected readonly headerItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Documento', value: 'DYN-SGI-RE-049' },
    { label: 'Tipo de viaje', value: this.tipoLabel },
  ]);

  // ── Paso 2: Evaluación de riesgos ──
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
    { level: 'ALTO', points: '> 75', schedule: 'Jefe de Base o Gerente HSE + Director General (Quito)' },
    { level: 'MEDIO', points: '31 a 75', schedule: 'Autoriza el Jefe de Base o el Gerente HSE' },
    { level: 'BAJO', points: '< 30', schedule: 'Autoriza el Supervisor de Pumping' },
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

  /** Mismo criterio que el formulario original: se muestra la opción sin la ponderación interna. */
  protected optionDisplayLabel(option: TravelRiskOption): string {
    return option.label.replace(/\s*=\s*\d+\b/, '').trim();
  }

  protected readonly allQuestionsAnswered = computed(() => this.riskQuestions().every(q => q.selectedLabel !== null));

  // ── Paso 3: Plan y ruta ──
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

  protected readonly routeLocation = signal('');
  protected readonly routeArrivalTime = signal('');
  protected readonly routeDepartureTime = signal('');
  protected readonly routeOvernightDetails = signal('');

  protected readonly commFrequency = signal('');
  protected readonly commContactPerson = signal('');
  protected readonly commContactDetails = signal('');

  // ── Paso 4: Confirmación ──
  protected readonly conductorNames = signal(this.auth.currentUser()?.name ?? '');

  protected readonly puedeGuardar = computed(
    () =>
      this.fecha() !== null &&
      this.motivoViaje().trim().length > 0 &&
      this.ticketEncontrado() &&
      this.vehicleType() !== null &&
      this.placas().trim().length > 0 &&
      this.allQuestionsAnswered() &&
      !this.hasBlockingAnswer() &&
      this.routeLocation().trim().length > 0 &&
      this.conductorNames().trim().length > 0,
  );

  protected goToNextStep(): void {
    if (this.currentStep() < this.steps.length - 1) this.currentStep.update(s => s + 1);
  }

  protected goToPreviousStep(): void {
    if (this.currentStep() > 0) this.currentStep.update(s => s - 1);
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    this.service
      .create({
        riskLevel: this.riskLevel(),
        tipo: this.tipo,
        ticketId: this.ticketId(),
        payload: {
          fecha: toLocalDateString(this.fecha()!),
          motivoViaje: this.motivoViaje().trim(),
          lineaServicio: this.lineaServicio(),
          origen: this.origen(),
          destino: this.destino(),
          assignedSupervisorNombre: this.assignedSupervisorNombre(),
          ticketCode: this.ticketCode().trim(),
          vehicleType: this.vehicleType()!,
          placas: this.placas().trim(),
          riskQuestions: this.riskQuestions(),
          totalPoints: this.totalPoints(),
          passengers: this.passengersList().join(', ') || undefined,
          canCombineTrips: this.canCombineTrips()[0] === 'Sí' ? true : this.canCombineTrips()[0] === 'No' ? false : null,
          routeInfo: [
            {
              location: this.routeLocation(),
              arrivalTime: this.routeArrivalTime(),
              departureTime: this.routeDepartureTime(),
              overnightDetails: this.routeOvernightDetails(),
            },
          ],
          communication: [
            {
              frequency: this.commFrequency(),
              contactPerson: this.commContactPerson(),
              contactDetails: this.commContactDetails(),
            },
          ],
          departureTime: this.routeDepartureTime() || undefined,
          arrivalTime: this.routeArrivalTime() || undefined,
          overnightData: this.routeOvernightDetails() || undefined,
          conductorNames: this.conductorNames().trim(),
          conductorSignature: this.conductorNames().trim(),
        },
      })
      .subscribe({
        next: gv => {
          const revisor = gv.riskLevel === 'BAJO' ? 'del Supervisor de Pumping' : 'del Jefe de Base o Gerente HSE';
          this.notify.success('Gerenciamiento de viaje enviado', `${gv.code} — pendiente de autorización ${revisor}.`);
          this.modalRef.close(gv);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo registrar el gerenciamiento de viaje.');
        },
      });
  }
}
