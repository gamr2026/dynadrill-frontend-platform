import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  DynadrillApprovalActionsComponent,
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
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
  PumpingUnitReport,
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
import { CreateUnitReportInput, unitReportHasNovedades } from '../../../../maintenance/models/unit-report.model';
import { UnitReportsService } from '../../../../maintenance/services/unit-reports.service';
import { UnidadesService } from '../../../../maintenance/services/unidades.service';
import {
  VehicleInspection,
  VEHICLE_CHECKLIST_VEHICULO,
  VEHICLE_CHECKLIST_EQUIPO,
  vehicleInspectionIsUsable,
} from '../../../../maintenance/models/vehicle-inspection.model';
import { VehicleInspectionDialog, VehicleInspectionDialogData } from '../../../../maintenance/components/vehicle-inspection-dialog';
import { VehicleInspectionsService } from '../../../../maintenance/services/vehicle-inspections.service';
import { ReviewArrivalReportDialog, ReviewArrivalReportDialogData, ReviewArrivalReportDialogResult } from '../../components/review-arrival-report-dialog';
import { MaintenanceOrdersService } from '../../../../maintenance/services/maintenance-orders.service';
import { MaintenanceOrderWithSubOrders, SubOrder, SubOrderStatus } from '../../../../maintenance/models/maintenance-order.model';
import { SuborderDetailDialog, SuborderDetailDialogData } from '../../../../maintenance/components/suborder-detail-dialog';
import { forkJoin, map } from 'rxjs';

/** Genera una inspección mock de ejemplo para ver detalle en llegada */
function createMockCompletedInspection(operatorName: string, unitCode: string): VehicleInspection {
  return {
    id: 999,
    unidadId: 1,
    unidadCode: unitCode,
    fecha: new Date().toISOString().split('T')[0],
    puntoPartida: 'Base Coco',
    destino: 'Pozo Beta-9',
    inspeccionadoPor: operatorName,
    marca: 'Kenworth',
    tipo: 'Cabezal',
    modelo: 'T800',
    anioFabricacion: '2022',
    placa: 'PBA-1234',
    fechaMatricula: '2026-01-15',
    caducidadMatricula: '2027-01-15',
    caducidadPoliza: '2027-06-30',
    kmInicial: 45200,
    kmFinal: 45380,
    proximoMantenimiento: '46000',
    checklistVehiculo: VEHICLE_CHECKLIST_VEHICULO.map(label => ({ label, estado: 'C' as const })),
    checklistEquipo: VEHICLE_CHECKLIST_EQUIPO.map(label => ({ label, estado: 'C' as const })),
    licenciaVigente: true,
    manejoDefensivoVigente: true,
    examenMedicoVigente: true,
    examenPsicosensometrico: true,
    documentosClientes: true,
    vacunasCertificado: true,
    reuneCondicionesParaTrabajar: true,
    observacionesConductor: 'Sin novedades',
    supervisorNombre: 'Luis Vega',
    supervisorApprovedBy: 'Luis Vega',
    supervisorApprovedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

const STEP_KEYS: PumpingStep[] = ['revision_propuesta', 'asignacion', 'en_ejecucion', 'revisar_reportes_salida', 'en_ejecucion_llegada', 'mantenimiento', 'revisar_reportes_llegada', 'en_revision'];

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
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly vehicleInspectionsService = inject(VehicleInspectionsService);
  private readonly maintenanceOrdersService = inject(MaintenanceOrdersService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly ticket = signal<PumpingTicket | null>(null);
  protected readonly viewMode = signal<string>(''); // 'asignar' | 'resumen' | ''
  protected readonly maintenanceOrders = signal<MaintenanceOrderWithSubOrders[]>([]);

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
    { label: 'CAM-04', value: 4 },
    { label: 'CAM-08', value: 5 },
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
  // PASO 2: Asignación — Resumen
  // ══════════════════════════════════════════════

  protected readonly assignmentSummaryColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Operador' },
    { key: 'role', header: 'Cargo/Rol' },
    { key: 'unitCode', header: 'Unidad asignada' },
    { key: 'inspectionStatus', header: 'Inspección', type: 'badge' },
    { key: 'reportStatus', header: 'Reporte de unidad', type: 'badge' },
  ];

  protected readonly assignmentSummaryRows = computed(() => {
    const t = this.ticket();
    if (!t || t.operators.length === 0) {
      // Datos de ejemplo para vista previa
      return [
        {
          id: 1, name: 'Jorge Salinas', role: 'Operador Mecánico', unitCode: 'PUM-07',
          inspectionStatus: { text: 'Realizada', tone: 'success' as const },
          reportStatus: { text: 'Completado', tone: 'success' as const },
        },
        {
          id: 2, name: 'David Cevallos', role: 'Operador Instrumental', unitCode: 'PUM-07',
          inspectionStatus: { text: 'Realizada', tone: 'success' as const },
          reportStatus: { text: 'Completado', tone: 'success' as const },
        },
        {
          id: 10, name: 'Marco Ruiz', role: 'Operador', unitCode: 'PUM-07',
          inspectionStatus: { text: 'Pendiente', tone: 'warning' as const },
          reportStatus: { text: 'Pendiente', tone: 'warning' as const },
        },
      ];
    }
    return t.operators.map(op => ({
      id: op.id,
      name: op.name,
      role: op.role,
      unitCode: op.unitCode,
      inspectionStatus: { text: 'Pendiente', tone: 'warning' as const },
      reportStatus: { text: 'Pendiente', tone: 'warning' as const },
    }));
  });

  /** Verifica si todos los operadores tienen inspección y reporte completados */
  protected readonly allOperatorsReady = computed(() => {
    const rows = this.assignmentSummaryRows();
    return rows.length > 0 && rows.every(
      r => r.inspectionStatus.text === 'Realizada' && r.reportStatus.text === 'Completado',
    );
  });

  protected readonly chemicalSummaryColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Químico' },
    { key: 'quantityAssigned', header: 'Cantidad asignada' },
    { key: 'unit', header: 'Unidad' },
  ];

  protected readonly chemicalSummaryRows = computed(() => {
    const t = this.ticket();
    if (!t || t.chemicals.length === 0) {
      // Datos de ejemplo
      return [
        { id: 1, name: 'Biocida QX-12', quantityAssigned: 40, unit: 'gal' },
        { id: 2, name: 'Inhibidor de corrosión', quantityAssigned: 20, unit: 'gal' },
        { id: 3, name: 'Surfactante SF-3', quantityAssigned: 15, unit: 'gal' },
      ];
    }
    return t.chemicals.map(c => ({
      id: c.id,
      name: c.name,
      quantityAssigned: c.quantityAssigned,
      unit: c.unit,
    }));
  });

  // ══════════════════════════════════════════════
  // PASO 2: Asignación — Formulario con operador-unidad vinculado
  // ══════════════════════════════════════════════

  protected readonly operatorAssignments = signal<{ operatorId: number; unitId: number | null }[]>([]);

  protected onOperatorAdded(value: unknown): void {
    const ids = Array.isArray(value) ? value as number[] : [];
    this.selectedOperators.set(ids);
    // Sincronizar assignments: agregar nuevos, quitar eliminados
    this.operatorAssignments.update(current => {
      const existing = current.filter(a => ids.includes(a.operatorId));
      const newIds = ids.filter(id => !current.some(a => a.operatorId === id));
      return [...existing, ...newIds.map(id => ({ operatorId: id, unitId: null }))];
    });
  }

  protected onOperatorUnitChange(operatorId: number, unitId: unknown): void {
    this.operatorAssignments.update(assignments =>
      assignments.map(a => a.operatorId === operatorId ? { ...a, unitId: unitId as number } : a),
    );
    // Actualizar selectedUnits con todas las unidades asignadas
    const allUnits = this.operatorAssignments()
      .map(a => a.unitId)
      .filter((id): id is number => id !== null);
    this.selectedUnits.set([...new Set(allUnits)]);
  }

  protected getOperatorName(operatorId: number): string {
    return this.operatorOptions.find(o => o.value === operatorId)?.label ?? '';
  }

  protected getOperatorUnit(operatorId: number): number | null {
    return this.operatorAssignments().find(a => a.operatorId === operatorId)?.unitId ?? null;
  }

  protected readonly allOperatorsHaveUnits = computed(() => {
    const assignments = this.operatorAssignments();
    return assignments.length > 0 && assignments.every(a => a.unitId !== null);
  });

  // ══════════════════════════════════════════════
  // Supervisor: Revisar reportes de salida
  // ══════════════════════════════════════════════

  protected readonly reviewSalidaColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Operador' },
    { key: 'role', header: 'Cargo/Rol' },
    { key: 'unitCode', header: 'Unidad asignada' },
    { key: 'inspectionStatus', header: 'Inspección de Vehículos (DYN-SGI-RE-068)', type: 'badge' },
    { key: 'reportStatus', header: 'Reporte de Unidad (DYN-MNT-RE-012)', type: 'badge' },
  ];

  protected readonly reviewSalidaRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const rejected = this.rejectedSalidaOperators();
    const approved = this.approvedSalidaOperators();
    return t.operators.map(op => ({
      id: op.id,
      name: op.name,
      role: op.role,
      unitCode: op.unitCode,
      inspectionStatus: { text: 'Realizada', tone: 'success' as const },
      reportStatus: rejected.has(op.id)
        ? { text: 'Rechazado', tone: 'error' as const }
        : approved.has(op.id)
          ? { text: 'Aprobado', tone: 'success' as const }
          : { text: 'Completado', tone: 'success' as const },
      approved: false,
    }));
  });

  // Trackeo de aprobaciones por operador para salida
  protected readonly approvedSalidaOperators = signal<Set<number>>(new Set());
  protected readonly rejectedSalidaOperators = signal<Set<number>>(new Set());
  protected readonly salidaRejectionReasons = signal<Map<number, string>>(new Map());

  protected isOperatorSalidaApproved(row: Record<string, unknown>): boolean {
    return this.approvedSalidaOperators().has(row['id'] as number);
  }

  protected canReviewSalida(row: Record<string, unknown>): boolean {
    const insp = row['inspectionStatus'] as { text: string };
    const report = row['reportStatus'] as { text: string };
    return insp.text === 'Realizada' && report.text === 'Completado';
  }

  protected isOperatorSalidaRejected(row: Record<string, unknown>): boolean {
    return this.rejectedSalidaOperators().has(row['id'] as number);
  }

  protected viewSalidaRejectionReason(row: Record<string, unknown>): void {
    const id = row['id'] as number;
    const reason = this.salidaRejectionReasons().get(id) || 'Sin motivo especificado.';
    this.notify.error(`Motivo de rechazo — ${row['name']}`, reason);
  }

  protected approveSalidaOperator(row: Record<string, unknown>): void {
    const t = this.ticket();
    if (!t?.unitReport) {
      this.notify.error('Sin reporte', 'No hay reporte de unidad disponible para revisar.');
      return;
    }

    const operatorName = row['name'] as string;
    const unitCode = row['unitCode'] as string;
    const inspection = createMockCompletedInspection(operatorName, unitCode);

    const ref = this.dialog.open<ReviewArrivalReportDialog, ReviewArrivalReportDialogData>({
      title: 'Revisar inspección y reporte de salida',
      content: ReviewArrivalReportDialog,
      data: {
        operatorName,
        unitCode,
        report: t.unitReport,
        inspection,
      },
      size: 'large',
      footer: false,
    });

    ref.afterClose.subscribe((result: ReviewArrivalReportDialogResult | undefined) => {
      if (!result) return;

      const id = row['id'] as number;
      if (result.approved) {
        this.approvedSalidaOperators.update(set => {
          const updated = new Set(set);
          updated.add(id);
          return updated;
        });
        this.notify.success('Aprobado', `Reporte de salida de ${row['name']} aprobado.`);
      } else {
        this.rejectedSalidaOperators.update(set => {
          const updated = new Set(set);
          updated.add(id);
          return updated;
        });
        this.salidaRejectionReasons.update(map => {
          const updated = new Map(map);
          updated.set(id, result.rejectionReason ?? '');
          return updated;
        });
        this.notify.error('Rechazado', `Reporte de ${row['name']} rechazado.`);
      }
    });
  }

  protected readonly allSalidaApproved = computed(() => {
    const rows = this.reviewSalidaRows();
    const approved = this.approvedSalidaOperators();
    return rows.length > 0 && rows.every(r => approved.has(r.id));
  });

  // ══════════════════════════════════════════════
  // Supervisor: Revisar reportes de llegada (sin inspección)
  // ══════════════════════════════════════════════

  protected readonly reviewLlegadaColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Operador' },
    { key: 'role', header: 'Cargo/Rol' },
    { key: 'unitCode', header: 'Unidad asignada' },
    { key: 'reportStatus', header: 'Reporte de Unidad (DYN-MNT-RE-012)', type: 'badge' },
  ];

  protected readonly reviewLlegadaRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const rejected = this.rejectedLlegadaOperators();
    const approved = this.approvedLlegadaOperators();
    return t.operators.map(op => ({
      id: op.id,
      name: op.name,
      role: op.role,
      unitCode: op.unitCode,
      reportStatus: rejected.has(op.id)
        ? { text: 'Rechazado', tone: 'error' as const }
        : approved.has(op.id)
          ? { text: 'Aprobado', tone: 'success' as const }
          : { text: 'Completado', tone: 'success' as const },
    }));
  });

  // Trackeo de aprobaciones por operador para llegada
  protected readonly approvedLlegadaOperators = signal<Set<number>>(new Set());
  protected readonly rejectedLlegadaOperators = signal<Set<number>>(new Set());
  protected readonly rejectionReasons = signal<Map<number, string>>(new Map());

  protected isOperatorLlegadaApproved(row: Record<string, unknown>): boolean {
    return this.approvedLlegadaOperators().has(row['id'] as number);
  }

  protected isOperatorLlegadaRejected(row: Record<string, unknown>): boolean {
    return this.rejectedLlegadaOperators().has(row['id'] as number);
  }

  protected viewRejectionReason(row: Record<string, unknown>): void {
    const id = row['id'] as number;
    const reason = this.rejectionReasons().get(id) || 'Sin motivo especificado.';
    this.notify.error(`Motivo de rechazo — ${row['name']}`, reason);
  }

  protected canReviewLlegada(row: Record<string, unknown>): boolean {
    const report = row['reportStatus'] as { text: string };
    return report.text === 'Completado';
  }

  protected approveLlegadaOperator(row: Record<string, unknown>): void {
    const t = this.ticket();
    if (!t?.unitReport) {
      this.notify.error('Sin reporte', 'No hay reporte de unidad disponible para revisar.');
      return;
    }

    const ref = this.dialog.open<ReviewArrivalReportDialog, ReviewArrivalReportDialogData>({
      title: 'Revisar reporte de llegada',
      content: ReviewArrivalReportDialog,
      data: {
        operatorName: row['name'] as string,
        unitCode: row['unitCode'] as string,
        report: t.unitReport,
      },
      size: 'large',
      footer: false,
    });

    ref.afterClose.subscribe((result: ReviewArrivalReportDialogResult | undefined) => {
      if (!result) return;

      const id = row['id'] as number;
      if (result.approved) {
        this.approvedLlegadaOperators.update(set => {
          const updated = new Set(set);
          updated.add(id);
          return updated;
        });
        this.notify.success('Aprobado', `Reporte de llegada de ${row['name']} aprobado.`);
      } else {
        this.rejectedLlegadaOperators.update(set => {
          const updated = new Set(set);
          updated.add(id);
          return updated;
        });
        this.rejectionReasons.update(map => {
          const updated = new Map(map);
          updated.set(id, result.rejectionReason ?? '');
          return updated;
        });
        this.notify.error('Rechazado', `Reporte de ${row['name']} rechazado.`);
      }
    });
  }

  protected readonly allLlegadaApproved = computed(() => {
    const rows = this.reviewLlegadaRows();
    const approved = this.approvedLlegadaOperators();
    return rows.length > 0 && rows.every(r => approved.has(r.id));
  });

  protected approveAllSalidaReports(): void {
    const t = this.ticket();
    if (!t) return;
    this.submitting.set(true);
    this.pumpingService.advanceStep(t.id, 'en_ejecucion_llegada').subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        this.notify.success('Aprobado', 'Todos los reportes de salida han sido aprobados. Avanza a En ejecución (Llegada).');
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo avanzar el ticket.');
      },
    });
  }

  protected approveAllLlegadaReports(): void {
    const t = this.ticket();
    if (!t) return;
    this.submitting.set(true);
    this.pumpingService.advanceStep(t.id, 'en_revision').subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        this.notify.success('Aprobado', 'Todos los reportes de llegada han sido aprobados.');
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo avanzar el ticket.');
      },
    });
  }

  // ══════════════════════════════════════════════
  // PASO 3: Ejecución — Reporte de Unidad DYN-MNT-RE-012
  // ══════════════════════════════════════════════

  protected readonly personnelColumns: DynadrillDataTableColumn[] = [
    { key: 'name', header: 'Operador' },
    { key: 'role', header: 'Cargo/Rol' },
    { key: 'unitCode', header: 'Unidad asignada' },
  ];

  protected readonly isOperador = computed(() => this.roleName() === 'Operador');

  protected readonly personnelRows = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    const currentUser = this.auth.currentUser();
    const rows = t.operators.map(op => ({
      id: op.id,
      name: op.name,
      role: op.role,
      unitCode: op.unitCode,
    }));
    // Si es operador, solo muestra su propia fila
    if (this.isOperador() && currentUser) {
      return rows.filter(r => r.name === currentUser.name);
    }
    return rows;
  });

  // Trackeo de inspecciones realizadas por operador (id -> VehicleInspection)
  protected readonly completedInspections = signal<Map<number, unknown>>(new Map());

  protected hasCompletedInspection(row: Record<string, unknown>): boolean {
    return this.completedInspections().has(row['id'] as number);
  }

  /** Verifica si todos los operadores de la tabla tienen inspección realizada */
  protected readonly allInspectionsCompleted = computed(() => {
    const rows = this.personnelRows();
    const completed = this.completedInspections();
    if (rows.length === 0) return false;
    return rows.every(r => completed.has(r.id));
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
    this.viewMode.set(this.route.snapshot.queryParamMap.get('mode') ?? '');
    this.pumpingService.getTicket(id).subscribe({
      next: ticket => {
        // Validar que el rol puede ver este estado
        if (!this.canAccessStep(ticket.currentStep)) {
          this.notify.error('Acceso denegado', 'No tienes permisos para ver este ticket en su estado actual.');
          this.router.navigate(['..'], { relativeTo: this.route });
          return;
        }
        this.ticket.set(ticket);
        this.loading.set(false);
        this.initFromTicket(ticket);
        this.loadMaintenanceOrders();
      },
      error: () => this.loading.set(false),
    });
  }

  private canAccessStep(step: PumpingStep): boolean {
    const role = this.roleName();
    if (role === 'Jefe de Base') return step === 'revision_propuesta';
    if (role === 'Supervisor') return step === 'asignacion' || step === 'revisar_reportes_salida' || step === 'mantenimiento' || step === 'revisar_reportes_llegada';
    if (role === 'Operador') return step === 'en_ejecucion' || step === 'en_ejecucion_llegada';
    return false;
  }

  // ══════════════════════════════════════════════
  // Mantenimientos asociados a la unidad del ticket
  // ══════════════════════════════════════════════

  private loadMaintenanceOrders(): void {
    this.maintenanceOrdersService.list().subscribe({
      next: orders => this.maintenanceOrders.set(orders),
    });
  }

  /** Texto resumen de mantenimientos para una unidad: "Mecánico — En Ejecución, Operativo — Pendiente" */
  protected maintenanceStatusForUnit(unitCode: string): string {
    const orders = this.maintenanceOrders().filter(o => o.unidad === unitCode);
    if (orders.length === 0) return 'Sin mantenimientos';
    const lines = orders.flatMap(o =>
      o.subOrders.map(sub => `${sub.type} — ${sub.status}`),
    );
    return lines.join('\n');
  }

  /** Sub-órdenes Operativo de la unidad del ticket */
  protected readonly operativoSubOrders = computed(() => {
    const t = this.ticket();
    if (!t) return [];
    return this.maintenanceOrders()
      .filter(o => o.unidad === t.unitCode)
      .flatMap(o => o.subOrders.filter(s => s.type === 'Operativo'));
  });

  /** Todas las sub-órdenes Operativo están cerradas o no hay ninguna */
  protected readonly allOperativoResolved = computed(() => {
    const subs = this.operativoSubOrders();
    if (subs.length === 0) return true;
    return subs.every(s => s.status === 'Cerrado');
  });

  protected reviewOperativoMaintenance(sub: SubOrder): void {
    const order = this.maintenanceOrders().find(o => o.subOrders.some(s => s.id === sub.id));
    const unitReports = this.unitReportsService.list();
    unitReports.subscribe(reports => {
      const report = order ? reports.find(r => r.id === order.unitReportId) : undefined;
      const novedadOriginal = report?.problemasOperaciones || '';
      this.dialog.open<SuborderDetailDialog, SuborderDetailDialogData>({
        title: 'Revisar mantenimiento operativo — ' + sub.code,
        content: SuborderDetailDialog,
        data: { subOrder: sub, orderCode: order?.code ?? '', novedadOriginal },
        footer: false,
      });
    });
  }

  protected approveMaintenanceStep(): void {
    const t = this.ticket();
    if (!t) return;
    this.submitting.set(true);
    this.pumpingService.advanceStep(t.id, 'revisar_reportes_llegada').subscribe({
      next: updated => {
        this.ticket.set(updated);
        this.submitting.set(false);
        this.notify.success('Mantenimiento revisado', 'El ticket avanza a Revisar reportes de llegada.');
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo avanzar el ticket.');
      },
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
        this.advanceToNextStep(t);
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

    this.validateTransporteUnits().subscribe(errorMessage => {
      if (errorMessage) {
        this.submitting.set(false);
        this.notify.error('Unidad no disponible', errorMessage);
        return;
      }

      this.pumpingService.assignResources(t.id, {
        operatorIds: this.selectedOperators(),
        unitIds: this.selectedUnits(),
        chemicalIds: this.selectedChemicals(),
      }).subscribe({
        next: updated => {
          this.ticket.set(updated);
          this.submitting.set(false);
          this.notify.success('Guardado', 'Asignaciones guardadas correctamente.');
          this.advanceToNextStep(t);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudieron guardar las asignaciones.');
        },
      });
    });
  }

  /**
   * Plan 2026, 5.3/5.4: ninguna unidad de Transporte puede salir a un
   * servicio sin una Inspección de Vehículos aprobada por el Supervisor y
   * sin el bloqueo de la Nota 1 (cinturón de seguridad). Devuelve el
   * motivo del bloqueo, o null si todas las unidades de Transporte
   * seleccionadas están en regla.
   */
  private validateTransporteUnits() {
    const selectedCodes = this.unitOptions
      .filter(o => this.selectedUnits().includes(o.value as number))
      .map(o => o.label);

    return forkJoin({
      unidades: this.unidadesService.list(),
      inspections: this.vehicleInspectionsService.list(),
    }).pipe(
      map(({ unidades, inspections }) => {
        const transporteCodes = unidades
          .filter(u => u.tipo === 'Transporte' && selectedCodes.includes(u.code))
          .map(u => u.code);

        for (const code of transporteCodes) {
          const forUnit = inspections
            .filter((i: VehicleInspection) => i.unidadCode === code)
            .sort((a: VehicleInspection, b: VehicleInspection) => b.fecha.localeCompare(a.fecha));
          const latest = forUnit[0];

          if (!latest) {
            return `${code} no tiene ninguna Inspección de Vehículos registrada.`;
          }
          if (!latest.supervisorApprovedBy) {
            return `${code} tiene una inspección pendiente de aprobación del Supervisor.`;
          }
          if (!vehicleInspectionIsUsable(latest)) {
            return `${code} está bloqueada por la inspección — falla en cinturón de seguridad (Nota 1, DYN-SGI-RE-068).`;
          }
        }
        return null;
      }),
    );
  }

  protected saveUnitReport(): void {
    const t = this.ticket();
    if (!t) return;

    // Validar que la inspección esté realizada antes de enviar
    if (!this.allInspectionsCompleted()) {
      this.notify.error(
        'Inspección pendiente',
        'Debe realizar la inspección de vehículos antes de enviar el reporte de unidad.',
      );
      return;
    }

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
        this.bridgeToMaintenance(t, report);
        this.advanceToNextStep(t);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar el reporte.');
      },
    });
  }

  /**
   * Cada acción de guardado (asignar supervisor, asignar recursos, enviar
   * reporte de unidad) persistía su propio paso pero nunca movía el ticket
   * al siguiente paso del wizard — el ticket se quedaba pegado donde
   * estaba aunque el toast dijera "Guardado".
   */
  private readonly NEXT_STEP: Partial<Record<PumpingStep, PumpingStep>> = {
    revision_propuesta: 'asignacion',
    asignacion: 'en_ejecucion',
    en_ejecucion: 'revisar_reportes_salida',
    revisar_reportes_salida: 'en_ejecucion_llegada',
    en_ejecucion_llegada: 'mantenimiento',
    mantenimiento: 'revisar_reportes_llegada',
  };

  private advanceToNextStep(t: PumpingTicket): void {
    const nextStep = this.NEXT_STEP[t.currentStep];
    if (!nextStep) return;

    this.pumpingService.advanceStep(t.id, nextStep).subscribe({
      next: updated => this.ticket.set(updated),
      error: () => this.notify.error('Error', 'No se pudo avanzar el ticket al siguiente paso.'),
    });
  }

  /**
   * Puente automático y silencioso hacia Mantenimiento: si el reporte trae
   * novedades, crea (o actualiza, si ya existía uno para este ticket) un
   * UnitReport para que aparezca en la Bandeja del Jefe — sin pedirle un
   * paso extra al Operador de Pumping. No bloquea el guardado del reporte
   * de Pumping si algo falla acá.
   */
  private bridgeToMaintenance(t: PumpingTicket, report: PumpingUnitReport): void {
    if (!unitReportHasNovedades({
      problemasMecanica: report.novelties.mecanica,
      problemasInstrumentacion: report.novelties.instrumentacion,
      problemasOperaciones: report.novelties.operaciones,
    })) {
      return;
    }

    const unitCode = report.unitCode || t.unitCode;
    this.unidadesService.list().subscribe(unidades => {
      const unidad = unidades.find(u => u.code === unitCode);
      if (!unidad) {
        this.notify.error('No se sincronizó con Mantenimiento', `No se encontró la unidad '${unitCode}' — el reporte de Pumping sí quedó guardado.`);
        return;
      }

      const input: CreateUnitReportInput = {
        sourceModule: 'Pumping',
        originTicketId: t.id,
        reportNo: t.code.replace('PUMP-', ''),
        pozo: t.wellName,
        cliente: t.clientName,
        bloque: report.blockName,
        base: report.baseName,
        unidad: unitCode,
        unidadId: unidad.id,
        fechaSalida: report.departureDate || t.estimatedDate,
        fechaLlegada: report.arrivalDate || new Date().toISOString(),
        origen: report.origin,
        destino: report.destination,
        inspeccionChasis: [],
        inspeccionPlataforma: [],
        inspeccionInstrumentacion: [],
        problemasMecanica: report.novelties.mecanica,
        problemasInstrumentacion: report.novelties.instrumentacion,
        problemasOperaciones: report.novelties.operaciones,
        interrumpioOperacion: report.operationInterrupted ?? false,
        detalleInterrupcion: report.interruptionDetail,
        listaParaSiguienteOperacion: report.unitReady ?? true,
        operadorSalida: report.departureOperatorName,
        operadorLlegada: report.arrivalOperatorName,
        supervisorSalida: t.assignedSupervisor || '',
        supervisorLlegada: t.assignedSupervisor || '',
      };

      this.unitReportsService.list().subscribe(existingReports => {
        const existing = existingReports.find(r => r.originTicketId === t.id);
        const save$ = existing ? this.unitReportsService.update(existing.id, input) : this.unitReportsService.create(input);
        save$.subscribe({
          next: () => this.notify.success('Sincronizado', 'La novedad se envió a la Bandeja de Mantenimiento.'),
          error: () => this.notify.error('No se sincronizó con Mantenimiento', 'El reporte de Pumping sí quedó guardado, pero no se pudo enviar la novedad a la Bandeja.'),
        });
      });
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

  /**
   * Abre el dialog de inspección de vehículos (DYN-SGI-RE-068)
   * para el operador seleccionado en la tabla de personal asignado.
   */
  protected openInspection(row: Record<string, unknown>): void {
    const ref = this.dialog.open<VehicleInspectionDialog>({
      title: 'Inspección de Vehículos — DYN-SGI-RE-068',
      content: VehicleInspectionDialog,
      size: 'large',
      footer: false,
    });
    ref.afterClose.subscribe(result => {
      if (result) {
        const operatorId = row['id'] as number;
        this.completedInspections.update(map => {
          const updated = new Map(map);
          updated.set(operatorId, result);
          return updated;
        });
        this.notify.success('Inspección guardada', `Inspección realizada por ${row['name']}.`);
      }
    });
  }

  /**
   * Abre el dialog de inspección en modo lectura para ver el detalle
   * de la inspección ya realizada.
   */
  protected viewInspection(row: Record<string, unknown>): void {
    const operatorId = row['id'] as number;
    const existing = this.completedInspections().get(operatorId) as VehicleInspection | undefined;
    if (!existing) return;
    this.dialog.open<VehicleInspectionDialog, VehicleInspectionDialogData>({
      title: 'Detalle de Inspección — DYN-SGI-RE-068',
      content: VehicleInspectionDialog,
      data: { existing },
      size: 'large',
      footer: false,
    });
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

    // En llegada, las inspecciones ya se realizaron en salida
    if (ticket.currentStep === 'en_ejecucion_llegada') {
      const inspMap = new Map<number, VehicleInspection>();
      for (const op of ticket.operators) {
        inspMap.set(op.id, createMockCompletedInspection(op.name, op.unitCode));
      }
      this.completedInspections.set(inspMap);
    }

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
