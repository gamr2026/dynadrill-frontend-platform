import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillApprovalActionsComponent,
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillInputComponent,
  DynadrillInspectionGridComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillStepperComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  type DynadrillApprovalDecision,
  type DynadrillContextCardItem,
  type DynadrillInspectionItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  PumpingTicket,
  PUMPING_SERVICE_TYPE_LABELS,
  PUMPING_STEP_LABELS,
  createChassisInspectionItems,
  createMotorInspectionItems,
  createArrivalEquipmentItems,
  createInstrumentationItems,
  type PumpingStep,
  type HubodometroEntry,
  type TireEntry,
} from '../../models/pumping.model';
import { PumpingService } from '../../services/pumping.service';

const STEP_KEYS: PumpingStep[] = ['revision_propuesta', 'asignacion', 'en_ejecucion', 'en_ejecucion_llegada', 'en_revision'];

@Component({
  selector: 'app-ticket-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillStepperComponent,
    DynadrillContextCardComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillInspectionGridComponent,
    DynadrillChipGroupComponent,
    DynadrillApprovalActionsComponent,
  ],
  templateUrl: './ticket-detail-page.html',
  styleUrl: './ticket-detail-page.scss',
})
export class TicketDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pumpingService = inject(PumpingService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly ticket = signal<PumpingTicket | null>(null);

  // ── Stepper ──

  protected readonly stepLabels = Object.values(PUMPING_STEP_LABELS);

  protected readonly currentStepIndex = computed(() => {
    const t = this.ticket();
    if (!t) return 0;
    return STEP_KEYS.indexOf(t.currentStep);
  });

  protected readonly currentStep = computed(() => this.ticket()?.currentStep ?? 'revision_propuesta');

  // ── Context card ──

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      { label: 'Ticket', value: t.code },
      { label: 'Cliente', value: t.clientName },
      { label: 'Pozo', value: t.wellName },
      { label: 'Tipo de servicio', value: PUMPING_SERVICE_TYPE_LABELS[t.serviceType] },
      { label: 'Fecha estimada', value: t.estimatedDate || '—' },
      { label: 'Origen', value: t.proposalOrigin },
    ];
  });

  // ══════════════════════════════════════════════
  // PASO 1: Revisión propuesta
  // ══════════════════════════════════════════════

  protected readonly supervisorOptions: DynadrillSelectOption[] = [
    { label: 'Luis Vega', value: 1 },
    { label: 'Ana Ruiz', value: 2 },
    { label: 'Marcos Torres', value: 3 },
  ];
  protected readonly selectedSupervisor = signal<number | null>(null);

  // ══════════════════════════════════════════════
  // PASO 2: Asignación
  // ══════════════════════════════════════════════

  protected readonly operatorOptions: DynadrillSelectOption[] = [
    { label: 'Álvarez Díaz Arturo Salomón — Operador I CTU', value: 1 },
    { label: 'Auquilla Salcán Luis Hernán — Operador de Fluidos', value: 2 },
    { label: 'Benítez Intriago Danny Orlando — Operador II Fishing', value: 3 },
    { label: 'Bravo Rosas Omar Alfredo — Operador II CTU', value: 4 },
  ];
  protected readonly selectedOperators = signal<number[]>([]);

  protected readonly unitOptions: DynadrillSelectOption[] = [
    { label: 'PUM-07', value: 1 },
    { label: 'PUM-15', value: 2 },
    { label: '4-CTV-03', value: 3 },
  ];
  protected readonly selectedUnits = signal<number[]>([]);

  protected readonly chemicalOptions: DynadrillSelectOption[] = [
    { label: 'Biocida QX-12 — gal', value: 1 },
    { label: 'Inhibidor de corrosión — gal', value: 2 },
    { label: 'Surfactante SF-3 — gal', value: 3 },
    { label: 'Fosfato — gal', value: 4 },
    { label: 'Amonio — gal', value: 5 },
  ];
  protected readonly selectedChemicals = signal<number[]>([]);

  // ══════════════════════════════════════════════
  // PASO 3: Ejecución — Reporte de Unidad DYN-MNT-RE-012
  // ══════════════════════════════════════════════

  protected readonly personnelColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Operador' },
    { key: 'role', header: 'Cargo/Rol' },
    { key: 'unitCode', header: 'Unidad asignada' },
  ];

  protected readonly personnelRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return t.operators.map(op => ({
      id: op.id,
      name: op.name,
      role: op.role,
      unitCode: op.unitCode,
    }));
  });

  // Información general del reporte
  protected readonly reportWellName = signal('');
  protected readonly reportBaseName = signal('');
  protected readonly reportBlockName = signal('');
  protected readonly reportHeaderCode = signal('');
  protected readonly reportClientName = signal('');
  protected readonly reportUnitCode = signal('');
  protected readonly reportDepartureDate = signal('');
  protected readonly reportArrivalDate = signal('');
  protected readonly reportFuelDeparture = signal('');
  protected readonly reportFuelArrival = signal('');
  protected readonly reportOrigin = signal('');
  protected readonly reportDestination = signal('');

  // Neumáticos (encabezados A/B/C/D, filas Salida/Llegada)
  protected readonly tires = signal<TireEntry[]>([
    { axle: 'A', salida: '', llegada: '' },
    { axle: 'B', salida: '', llegada: '' },
    { axle: 'C', salida: '', llegada: '' },
    { axle: 'D', salida: '', llegada: '' },
  ]);

  protected readonly tireColumns: DynadrillDataTableColumn[] = [
    { key: 'rowLabel', header: '' },
    { key: 'A', header: 'A' },
    { key: 'B', header: 'B' },
    { key: 'C', header: 'C' },
    { key: 'D', header: 'D' },
  ];

  protected readonly tireRows = computed(() => {
    const t = this.tires();
    return [
      { rowLabel: 'Salida', A: t[0].salida || '—', B: t[1].salida || '—', C: t[2].salida || '—', D: t[3].salida || '—' },
      { rowLabel: 'Llegada', A: t[0].llegada || '—', B: t[1].llegada || '—', C: t[2].llegada || '—', D: t[3].llegada || '—' },
    ];
  });

  // Hubodómetro (con Origen/Destino en la mitad)
  protected readonly hubodometro = signal<HubodometroEntry[]>([
    { label: 'A', salida: null, llegada: null },
    { label: 'B', salida: null, llegada: null },
    { label: 'C', salida: null, llegada: null },
    { label: 'D', salida: null, llegada: null },
  ]);

  protected readonly hubodometroColumns: DynadrillDataTableColumn[] = [
    { key: 'salida', header: 'Salida' },
    { key: 'centro', header: '' },
    { key: 'llegada', header: 'Llegada' },
  ];

  protected readonly hubodometroRows = computed(() => [
    {
      salida: this.hubodometro().map(h => h.salida ?? '—').join(' / '),
      centro: 'Origen',
      llegada: this.hubodometro().map(h => h.llegada ?? '—').join(' / '),
    },
    {
      salida: '',
      centro: 'Destino',
      llegada: '',
    },
  ]);

  // Secciones de inspección
  protected readonly chassisItems = signal<DynadrillInspectionItem[]>(createChassisInspectionItems());
  protected readonly motorItems = signal<DynadrillInspectionItem[]>(createMotorInspectionItems());
  protected readonly arrivalEquipmentItems = signal<DynadrillInspectionItem[]>(createArrivalEquipmentItems());
  protected readonly instrumentationItems = signal<DynadrillInspectionItem[]>(createInstrumentationItems());

  // Novedades
  protected readonly noveltiesMecanica = signal('');
  protected readonly noveltiesInstrumentacion = signal('');
  protected readonly noveltiesOperaciones = signal('');

  // Operatividad
  protected readonly unitReadyOptions = ['Sí', 'No'];
  protected readonly unitReadySelection = signal<string[]>([]);
  protected readonly operationInterruptedOptions = ['Sí', 'No'];
  protected readonly operationInterruptedSelection = signal<string[]>([]);
  protected readonly interruptionDetail = signal('');

  // Firmas (automáticas desde operador asignado)
  protected readonly departureOperatorName = signal('');
  protected readonly arrivalOperatorName = signal('');
  protected readonly departureApprovalDate = signal('');
  protected readonly arrivalApprovalDate = signal('');

  protected readonly departureSignatureName = computed(() => {
    const t = this.ticket();
    if (t?.operators?.length) return t.operators[0].name;
    return this.departureOperatorName() || '—';
  });

  protected readonly departureSignatureDate = computed(() => {
    if (this.departureApprovalDate()) return this.departureApprovalDate();
    if (this.reportDepartureDate()) return this.reportDepartureDate();
    return new Date().toISOString().split('T')[0];
  });

  protected readonly arrivalSignatureName = computed(() => {
    const t = this.ticket();
    if (t?.operators?.length) return t.operators[t.operators.length > 1 ? 1 : 0].name;
    return this.arrivalOperatorName() || '—';
  });

  protected readonly arrivalSignatureDate = computed(() => {
    if (this.arrivalApprovalDate()) return this.arrivalApprovalDate();
    if (this.reportArrivalDate()) return this.reportArrivalDate();
    return new Date().toISOString().split('T')[0];
  });

  // Datos de salida en solo lectura para la vista de llegada
  protected readonly arrivalGeneralInfoItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Pozo', value: this.reportWellName() || '—' },
    { label: 'Base', value: this.reportBaseName() || '—' },
    { label: 'Bloque', value: this.reportBlockName() || '—' },
    { label: 'Cabezal', value: this.reportHeaderCode() || '—' },
    { label: 'Cliente', value: this.reportClientName() || '—' },
    { label: 'Unidad', value: this.reportUnitCode() || '—' },
  ]);

  protected readonly arrivalFuelReadonlyItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Fecha de salida', value: this.reportDepartureDate() || '—' },
    { label: 'Combustible salida', value: this.reportFuelDeparture() || '—' },
  ]);

  // ══════════════════════════════════════════════
  // PASO 4: Revisión — resumen + aprobación
  // ══════════════════════════════════════════════

  protected readonly decision = signal<DynadrillApprovalDecision>(null);

  protected readonly chemicalColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Químico' },
    { key: 'quantityAssigned', header: 'Asignado' },
    { key: 'quantityUsed', header: 'Usado' },
    { key: 'quantityReturned', header: 'Devuelto' },
    { key: 'unit', header: 'Unidad' },
  ];

  protected readonly chemicalRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return t.chemicals.map(c => ({
      id: c.id,
      name: c.name,
      quantityAssigned: c.quantityAssigned,
      quantityUsed: c.quantityUsed,
      quantityReturned: c.quantityReturned,
      unit: c.unit,
    }));
  });

  protected readonly reviewContextItems = computed<DynadrillContextCardItem[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    return [
      { label: 'Ticket', value: t.code },
      { label: 'Cliente', value: t.clientName },
      { label: 'Pozo', value: t.wellName },
      { label: 'Tipo de servicio', value: PUMPING_SERVICE_TYPE_LABELS[t.serviceType] },
      { label: 'Supervisor', value: t.assignedSupervisor || '—' },
      { label: 'Unidad', value: t.unitCode || '—' },
      { label: 'Reporte de unidad', value: t.unitReport ? 'Completado' : 'Pendiente' },
    ];
  });

  // ══════════════════════════════════════════════
  // Constructor
  // ══════════════════════════════════════════════

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.pumpingService.getTicket(id).subscribe({
      next: ticket => {
        this.ticket.set(ticket);
        this.loading.set(false);
        this.initFromTicket(ticket);
      },
      error: () => this.loading.set(false),
    });
  }

  // ══════════════════════════════════════════════
  // Acciones
  // ══════════════════════════════════════════════

  protected saveSupervisor(): void {
    const supervisorId = this.selectedSupervisor();
    const t = this.ticket();
    if (!supervisorId || !t) return;
    this.submitting.set(true);
    this.pumpingService.assignSupervisor(t.id, supervisorId).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        this.notify.success('Guardado', 'Supervisor asignado correctamente.');
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo asignar el supervisor.');
      },
    });
  }

  protected saveAssignments(): void {
    const t = this.ticket();
    if (!t) return;
    this.submitting.set(true);
    this.pumpingService.assignResources(t.id, {
      operatorIds: this.selectedOperators(),
      unitIds: this.selectedUnits(),
      chemicalIds: this.selectedChemicals(),
    }).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        this.notify.success('Guardado', 'Asignaciones guardadas correctamente.');
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudieron guardar las asignaciones.');
      },
    });
  }

  protected saveUnitReport(): void {
    const t = this.ticket();
    if (!t) return;

    const report = {
      reportCode: `RU-${t.code.replace('PUMP-', '')}`,
      unitCode: this.reportUnitCode(),
      wellName: this.reportWellName(),
      baseName: this.reportBaseName(),
      blockName: this.reportBlockName(),
      headerCode: this.reportHeaderCode(),
      clientName: this.reportClientName(),
      departureDate: this.reportDepartureDate(),
      arrivalDate: this.reportArrivalDate(),
      fuelDeparture: Number(this.reportFuelDeparture()) || null,
      fuelArrival: Number(this.reportFuelArrival()) || null,
      hubodometro: this.hubodometro(),
      tires: this.tires(),
      origin: this.reportOrigin(),
      destination: this.reportDestination(),
      chassisInspection: this.chassisItems(),
      motorInspection: this.motorItems(),
      arrivalEquipmentInspection: this.arrivalEquipmentItems(),
      instrumentationInspection: this.instrumentationItems(),
      novelties: {
        mecanica: this.noveltiesMecanica(),
        instrumentacion: this.noveltiesInstrumentacion(),
        operaciones: this.noveltiesOperaciones(),
      },
      unitReady: this.unitReadySelection()[0] === 'Sí' ? true : this.unitReadySelection()[0] === 'No' ? false : null,
      operationInterrupted: this.operationInterruptedSelection()[0] === 'Sí' ? true : this.operationInterruptedSelection()[0] === 'No' ? false : null,
      interruptionDetail: this.interruptionDetail(),
      departureOperatorName: this.departureOperatorName(),
      departureApprovalDate: this.departureApprovalDate(),
      arrivalOperatorName: this.arrivalOperatorName(),
      arrivalApprovalDate: this.arrivalApprovalDate(),
    };

    this.submitting.set(true);
    this.pumpingService.saveUnitReport(t.id, report).subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        this.notify.success('Guardado', 'Reporte de unidad guardado correctamente.');
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar el reporte.');
      },
    });
  }

  protected approveTicket(): void {
    const t = this.ticket();
    if (!t || this.decision() !== 'approved') return;
    this.submitting.set(true);
    this.pumpingService.approveTicket(t.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.notify.success('Aprobado', 'Ticket aprobado correctamente.');
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo aprobar el ticket.');
      },
    });
  }

  // ══════════════════════════════════════════════
  // Event handlers
  // ══════════════════════════════════════════════

  protected onSupervisorChange(value: unknown): void {
    this.selectedSupervisor.set(typeof value === 'number' ? value : null);
  }

  protected onOperatorsChange(value: unknown): void {
    this.selectedOperators.set(Array.isArray(value) ? value : []);
  }

  protected onUnitsChange(value: unknown): void {
    this.selectedUnits.set(Array.isArray(value) ? value : []);
  }

  protected onChemicalsChange(value: unknown): void {
    this.selectedChemicals.set(Array.isArray(value) ? value : []);
  }

  protected onDecisionChange(decision: DynadrillApprovalDecision): void {
    this.decision.set(decision);
  }

  protected onInspectionChange(
    section: 'chassisItems' | 'motorItems' | 'arrivalEquipmentItems' | 'instrumentationItems',
    updated: DynadrillInspectionItem,
  ): void {
    this[section].update(items =>
      items.map(item => (item.id === updated.id ? updated : item)),
    );
  }

  protected goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  // ══════════════════════════════════════════════
  // Init
  // ══════════════════════════════════════════════

  private initFromTicket(ticket: PumpingTicket): void {
    if (ticket.assignedSupervisor) {
      const opt = this.supervisorOptions.find(o => o.label === ticket.assignedSupervisor);
      if (opt) this.selectedSupervisor.set(opt.value as number);
    }

    // Pre-fill report general info from ticket
    this.reportWellName.set(ticket.wellName);
    this.reportClientName.set(ticket.clientName);
    this.reportUnitCode.set(ticket.unitCode || '');

    if (ticket.unitReport) {
      const r = ticket.unitReport;
      this.reportBaseName.set(r.baseName);
      this.reportBlockName.set(r.blockName);
      this.reportHeaderCode.set(r.headerCode);
      this.reportDepartureDate.set(r.departureDate);
      this.reportArrivalDate.set(r.arrivalDate);
      this.reportFuelDeparture.set(r.fuelDeparture != null ? String(r.fuelDeparture) : '');
      this.reportFuelArrival.set(r.fuelArrival != null ? String(r.fuelArrival) : '');
      this.reportOrigin.set(r.origin);
      this.reportDestination.set(r.destination);
      this.hubodometro.set(r.hubodometro);
      if (r.tires) this.tires.set(r.tires);
      this.chassisItems.set(r.chassisInspection);
      this.motorItems.set(r.motorInspection);
      this.arrivalEquipmentItems.set(r.arrivalEquipmentInspection);
      this.instrumentationItems.set(r.instrumentationInspection);
      this.noveltiesMecanica.set(r.novelties.mecanica);
      this.noveltiesInstrumentacion.set(r.novelties.instrumentacion);
      this.noveltiesOperaciones.set(r.novelties.operaciones);
      this.unitReadySelection.set(r.unitReady === true ? ['Sí'] : r.unitReady === false ? ['No'] : []);
      this.operationInterruptedSelection.set(r.operationInterrupted === true ? ['Sí'] : r.operationInterrupted === false ? ['No'] : []);
      this.interruptionDetail.set(r.interruptionDetail);
      this.departureOperatorName.set(r.departureOperatorName);
      this.departureApprovalDate.set(r.departureApprovalDate || '');
      this.arrivalOperatorName.set(r.arrivalOperatorName);
      this.arrivalApprovalDate.set(r.arrivalApprovalDate || '');
    }
  }
}
