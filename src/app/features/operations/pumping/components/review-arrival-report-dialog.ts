import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillInspectionGridComponent,
  DynadrillStepperComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import type { PumpingUnitReport } from '../models/pumping.model';
import type { VehicleInspection } from '../../../maintenance/models/vehicle-inspection.model';

export interface ReviewArrivalReportDialogData {
  operatorName: string;
  unitCode: string;
  report: PumpingUnitReport;
  /** Si viene, se muestra la sección de inspección de vehículos (para salida). */
  inspection?: VehicleInspection;
}

export interface ReviewArrivalReportDialogResult {
  approved: boolean;
  rejectionReason?: string;
}

@Component({
  selector: 'app-review-arrival-report-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillContextCardComponent,
    DynadrillDataTableComponent,
    DynadrillInspectionGridComponent,
    DynadrillButtonComponent,
    DynadrillTextareaComponent,
    DynadrillStepperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-arrival-report-dialog.html',
  styleUrl: './review-arrival-report-dialog.scss',
})
export class ReviewArrivalReportDialog {
  private readonly modalRef = inject(NzModalRef<ReviewArrivalReportDialog, ReviewArrivalReportDialogResult | undefined>);
  private readonly data = inject<ReviewArrivalReportDialogData>(NZ_MODAL_DATA);

  protected readonly operatorName = this.data.operatorName;
  protected readonly unitCode = this.data.unitCode;
  protected readonly report = this.data.report;
  protected readonly inspection = this.data.inspection ?? null;

  /** Mode for inspection-grid: 'salida' when reviewing departure, 'llegada' for arrival */
  protected readonly inspectionMode = this.inspection ? 'salida' : 'llegada';
  /** Whether we're reviewing salida (true) or llegada (false) */
  protected readonly isSalidaReview = !!this.inspection;

  /** Stepper for salida (2 steps: inspection + unit report) */
  protected readonly reviewSteps = ['Inspección de vehículos', 'Reporte de unidad'];
  protected readonly currentReviewStep = signal(0);

  protected readonly showRejectForm = signal(false);
  protected readonly rejectionReason = signal('');

  // ── Vehicle inspection (DYN-SGI-RE-068) ──
  protected readonly inspectionInfoItems = computed<DynadrillContextCardItem[]>(() => {
    const i = this.inspection;
    if (!i) return [];
    return [
      { label: 'Fecha', value: i.fecha },
      { label: 'Punto de partida', value: i.puntoPartida },
      { label: 'Destino', value: i.destino },
      { label: 'Inspeccionado por', value: i.inspeccionadoPor },
      { label: 'Marca', value: i.marca },
      { label: 'Tipo', value: i.tipo },
      { label: 'Modelo', value: i.modelo },
      { label: 'Placa', value: i.placa },
      { label: 'Km inicial', value: String(i.kmInicial) },
      { label: 'Km final', value: String(i.kmFinal) },
    ];
  });

  protected readonly inspectionVehiculoColumns: DynadrillDataTableColumn[] = [
    { key: 'label', header: 'Ítem' },
    { key: 'estado', header: 'Estado' },
  ];

  protected readonly inspectionVehiculoRows = computed(() => {
    const i = this.inspection;
    if (!i) return [];
    return i.checklistVehiculo.map(item => ({
      label: item.label,
      estado: item.estado === 'C' ? 'Cumple' : item.estado === 'NC' ? 'No cumple' : item.estado === 'NA' ? 'N/A' : '—',
    }));
  });

  protected readonly inspectionEquipoRows = computed(() => {
    const i = this.inspection;
    if (!i) return [];
    return i.checklistEquipo.map(item => ({
      label: item.label,
      estado: item.estado === 'C' ? 'Cumple' : item.estado === 'NC' ? 'No cumple' : item.estado === 'NA' ? 'N/A' : '—',
    }));
  });

  protected readonly inspectionConductorItems = computed<DynadrillContextCardItem[]>(() => {
    const i = this.inspection;
    if (!i) return [];
    return [
      { label: 'Licencia vigente', value: i.licenciaVigente ? 'Sí' : 'No' },
      { label: 'Manejo defensivo vigente', value: i.manejoDefensivoVigente ? 'Sí' : 'No' },
      { label: 'Examen médico vigente', value: i.examenMedicoVigente ? 'Sí' : 'No' },
      { label: 'Examen psicosensométrico', value: i.examenPsicosensometrico ? 'Sí' : 'No' },
      { label: 'Documentos de clientes', value: i.documentosClientes ? 'Sí' : 'No' },
      { label: 'Vacunas/certificado', value: i.vacunasCertificado ? 'Sí' : 'No' },
      { label: 'Reúne condiciones para trabajar', value: i.reuneCondicionesParaTrabajar ? 'Sí' : 'No' },
    ];
  });

  // ── General info ──
  protected readonly generalInfoItems = computed<DynadrillContextCardItem[]>(() => {
    const r = this.report;
    return [
      { label: 'Código reporte', value: r.reportCode },
      { label: 'Unidad', value: r.unitCode },
      { label: 'Pozo', value: r.wellName },
      { label: 'Base', value: r.baseName },
      { label: 'Bloque', value: r.blockName },
      { label: 'Cabezal', value: r.headerCode },
      { label: 'Cliente', value: r.clientName },
      { label: 'Origen', value: r.origin },
      { label: 'Destino', value: r.destination },
    ];
  });

  // ── Dates and fuel ──
  protected readonly datesFuelItems = computed<DynadrillContextCardItem[]>(() => {
    const r = this.report;
    if (this.isSalidaReview) {
      return [
        { label: 'Fecha de salida', value: r.departureDate || '—' },
        { label: 'Combustible salida', value: r.fuelDeparture != null ? String(r.fuelDeparture) : '—' },
      ];
    }
    return [
      { label: 'Fecha de salida', value: r.departureDate || '—' },
      { label: 'Combustible salida', value: r.fuelDeparture != null ? String(r.fuelDeparture) : '—' },
      { label: 'Fecha de llegada', value: r.arrivalDate || '—' },
      { label: 'Combustible llegada', value: r.fuelArrival != null ? String(r.fuelArrival) : '—' },
    ];
  });

  // ── Tires ──
  protected readonly tireColumns: DynadrillDataTableColumn[] = [
    { key: 'rowLabel', header: '' },
    { key: 'A', header: 'A' },
    { key: 'B', header: 'B' },
    { key: 'C', header: 'C' },
    { key: 'D', header: 'D' },
  ];

  protected readonly tireRows = computed(() => {
    const t = this.report.tires;
    return [
      { rowLabel: 'Salida', A: t[0]?.salida || '—', B: t[1]?.salida || '—', C: t[2]?.salida || '—', D: t[3]?.salida || '—' },
      { rowLabel: 'Llegada', A: t[0]?.llegada || '—', B: t[1]?.llegada || '—', C: t[2]?.llegada || '—', D: t[3]?.llegada || '—' },
    ];
  });

  // ── Hubodometro ──
  protected readonly hubodometroColumns: DynadrillDataTableColumn[] = [
    { key: 'salida', header: 'Salida' },
    { key: 'centro', header: '' },
    { key: 'llegada', header: 'Llegada' },
  ];

  protected readonly hubodometroRows = computed(() => [
    {
      salida: this.report.hubodometro.map(h => h.salida ?? '—').join(' / '),
      centro: 'Origen → Destino',
      llegada: this.report.hubodometro.map(h => h.llegada ?? '—').join(' / '),
    },
  ]);

  // ── Novelties ──
  protected readonly noveltiesItems = computed<DynadrillContextCardItem[]>(() => {
    const n = this.report.novelties;
    const items: DynadrillContextCardItem[] = [];
    if (n.mecanica) items.push({ label: 'Mecánica', value: n.mecanica });
    if (n.instrumentacion) items.push({ label: 'Instrumentación', value: n.instrumentacion });
    if (n.operaciones) items.push({ label: 'Operaciones', value: n.operaciones });
    if (items.length === 0) items.push({ label: 'Novedades', value: 'Sin novedades reportadas' });
    return items;
  });

  // ── Operability ──
  protected readonly operabilityItems = computed<DynadrillContextCardItem[]>(() => {
    const r = this.report;
    const items: DynadrillContextCardItem[] = [
      { label: 'Unidad operativa', value: r.unitReady === true ? 'Sí' : r.unitReady === false ? 'No' : 'Sin definir' },
      { label: 'Interrumpió operación', value: r.operationInterrupted === true ? 'Sí' : r.operationInterrupted === false ? 'No' : 'Sin definir' },
    ];
    if (r.operationInterrupted && r.interruptionDetail) {
      items.push({ label: 'Detalle interrupción', value: r.interruptionDetail });
    }
    return items;
  });

  // ── Signatures ──
  protected readonly signatureItems = computed<DynadrillContextCardItem[]>(() => {
    const r = this.report;
    if (this.isSalidaReview) {
      return [
        { label: 'Operador salida', value: r.departureOperatorName || '—' },
        { label: 'Fecha firma salida', value: r.departureApprovalDate || '—' },
      ];
    }
    return [
      { label: 'Operador salida', value: r.departureOperatorName || '—' },
      { label: 'Fecha firma salida', value: r.departureApprovalDate || '—' },
      { label: 'Operador llegada', value: r.arrivalOperatorName || '—' },
      { label: 'Fecha firma llegada', value: r.arrivalApprovalDate || '—' },
    ];
  });

  // ── Actions ──

  /** Aprueba la inspección y avanza al paso 2 (reporte de unidad) */
  protected approveInspectionStep(): void {
    this.currentReviewStep.set(1);
    this.showRejectForm.set(false);
    this.rejectionReason.set('');
  }

  protected approve(): void {
    this.modalRef.close({ approved: true });
  }

  protected toggleReject(): void {
    this.showRejectForm.update(v => !v);
  }

  protected confirmReject(): void {
    this.modalRef.close({ approved: false, rejectionReason: this.rejectionReason() });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
