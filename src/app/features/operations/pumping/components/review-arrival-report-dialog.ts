import { formatDate } from '@angular/common';
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
import { DocumentoPdfService } from '../../../../shared/documentos';
import { ReporteUnidadHoja } from '../../../../shared/documentos/formatos/reporte-unidad-hoja';

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
  /** Pantalla completa en móvil (formulario largo) — ver styles.scss. */
  host: { class: 'app-dialog-fullscreen-mobile' },
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
  private readonly documentoPdf = inject(DocumentoPdfService);

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

  // ── Tarjetas con la context-card nueva (variant="card"): datos agrupados con ícono ──

  /** "29/09/2026 19:54" — el valor llega como ISO ("2026-09-29T19:54:28.628Z"); si no se puede leer, se muestra tal cual. */
  private fechaLegible(valor: string | undefined | null): string {
    if (!valor) return '—';
    try {
      return formatDate(valor, 'dd/MM/yyyy HH:mm', 'es');
    } catch {
      return valor;
    }
  }

  private siNo(valor: boolean | null | undefined): string {
    return valor === true ? 'Sí' : valor === false ? 'No' : 'Sin definir';
  }

  /** Punto de color según Sí/No: verde si cumple, rojo si no. */
  private punto(valor: boolean | null | undefined): 'success' | 'error' | undefined {
    return valor === true ? 'success' : valor === false ? 'error' : undefined;
  }

  protected readonly inspectionInfoGroups = computed<DynadrillContextCardItem[][]>(() => {
    const i = this.inspection;
    if (!i) return [];
    return [
      [{ label: 'Inspeccionado por', value: i.inspeccionadoPor || '—', icon: 'users' }],
      [
        { label: 'Marca', value: i.marca || '—', icon: 'tool' },
        { label: 'Modelo', value: i.modelo || '—', icon: 'tool' },
      ],
      [
        { label: 'Tipo', value: i.tipo || '—', icon: 'modules' },
        { label: 'Placa', value: i.placa || '—', icon: 'file-text', badgeVariant: 'brand' },
      ],
      [
        { label: 'Punto de partida', value: i.puntoPartida || '—', icon: 'location' },
        { label: 'Destino', value: i.destino || '—', icon: 'location' },
      ],
      [
        { label: 'Km inicial', value: String(i.kmInicial ?? '—'), icon: 'modules' },
        { label: 'Km final', value: String(i.kmFinal ?? '—'), icon: 'modules' },
      ],
      [{ label: 'Fecha de la inspección', value: this.fechaLegible(i.fecha), icon: 'calendar' }],
    ];
  });

  protected readonly inspectionConductorGroups = computed<DynadrillContextCardItem[][]>(() => {
    const i = this.inspection;
    if (!i) return [];
    const item = (label: string, valor: boolean | null | undefined): DynadrillContextCardItem => ({
      label,
      value: this.siNo(valor),
      icon: 'file-text',
      dotVariant: this.punto(valor),
    });
    return [
      [item('Licencia vigente', i.licenciaVigente), item('Manejo defensivo vigente', i.manejoDefensivoVigente)],
      [item('Examen médico vigente', i.examenMedicoVigente), item('Examen psicosensométrico', i.examenPsicosensometrico)],
      [item('Documentos de clientes', i.documentosClientes), item('Vacunas/certificado', i.vacunasCertificado)],
      [item('Reúne condiciones para trabajar', i.reuneCondicionesParaTrabajar)],
    ];
  });

  protected readonly datesFuelGroups = computed<DynadrillContextCardItem[][]>(() => {
    const r = this.report;
    const combustible = (v: number | null | undefined): string => (v != null ? `${v} gal` : '—');
    const grupos: DynadrillContextCardItem[][] = [
      [
        { label: 'Fecha de salida', value: this.fechaLegible(r.departureDate), icon: 'calendar' },
        { label: 'Combustible salida', value: combustible(r.fuelDeparture), icon: 'tool' },
      ],
    ];
    if (!this.isSalidaReview) {
      grupos.push([
        { label: 'Fecha de llegada', value: this.fechaLegible(r.arrivalDate), icon: 'calendar' },
        { label: 'Combustible llegada', value: combustible(r.fuelArrival), icon: 'tool' },
      ]);
    }
    return grupos;
  });

  protected readonly noveltiesGroups = computed<DynadrillContextCardItem[][]>(() => {
    const n = this.report.novelties;
    const grupos: DynadrillContextCardItem[][] = [];
    if (n.mecanica) grupos.push([{ label: 'Mecánica', value: n.mecanica, icon: 'tool' }]);
    if (n.instrumentacion) grupos.push([{ label: 'Instrumentación', value: n.instrumentacion, icon: 'tool' }]);
    if (n.operaciones) grupos.push([{ label: 'Operaciones', value: n.operaciones, icon: 'tool' }]);
    if (grupos.length === 0) grupos.push([{ label: 'Novedades', value: 'Sin novedades reportadas', icon: 'file-text', dotVariant: 'success' }]);
    return grupos;
  });

  protected readonly operabilityGroups = computed<DynadrillContextCardItem[][]>(() => {
    const r = this.report;
    const grupos: DynadrillContextCardItem[][] = [
      [
        { label: 'Unidad operativa', value: this.siNo(r.unitReady), icon: 'tool', dotVariant: this.punto(r.unitReady) },
        { label: 'Interrumpió operación', value: this.siNo(r.operationInterrupted), icon: 'alert', dotVariant: r.operationInterrupted === true ? 'error' : this.punto(r.operationInterrupted === false ? true : undefined) },
      ],
    ];
    if (r.operationInterrupted && r.interruptionDetail) {
      grupos.push([{ label: 'Detalle de la interrupción', value: r.interruptionDetail, icon: 'file-text' }]);
    }
    return grupos;
  });

  protected readonly signatureGroups = computed<DynadrillContextCardItem[][]>(() => {
    const r = this.report;
    const grupos: DynadrillContextCardItem[][] = [
      [
        { label: 'Operador salida', value: r.departureOperatorName || '—', icon: 'users' },
        { label: 'Fecha del reporte de salida', value: this.fechaLegible(r.departureApprovalDate), icon: 'calendar' },
      ],
    ];
    if (!this.isSalidaReview) {
      grupos.push([
        { label: 'Operador llegada', value: r.arrivalOperatorName || '—', icon: 'users' },
        { label: 'Fecha del reporte de llegada', value: this.fechaLegible(r.arrivalApprovalDate), icon: 'calendar' },
      ]);
    }
    return grupos;
  });

  // ── General info ──
  /** Misma tarjeta que en los primeros pasos del ticket (variant="card"): datos agrupados con ícono. */
  protected readonly generalInfoGroups = computed<DynadrillContextCardItem[][]>(() => {
    const r = this.report;
    return [
      [{ label: 'Cliente', value: r.clientName || '—', icon: 'users' }],
      [
        { label: 'Pozo', value: r.wellName || '—', icon: 'location' },
        { label: 'Base', value: r.baseName || '—', icon: 'location' },
      ],
      [
        { label: 'Bloque', value: r.blockName || '—', icon: 'modules' },
        { label: 'Cabezal', value: r.headerCode || '—', icon: 'tool' },
      ],
      [
        { label: 'Unidad', value: r.unitCode || '—', icon: 'tool', badgeVariant: 'brand' },
        { label: 'Código reporte', value: r.reportCode || '—', icon: 'file-text' },
      ],
      [
        { label: 'Origen', value: r.origin || '—', icon: 'location' },
        { label: 'Destino', value: r.destination || '—', icon: 'location' },
      ],
    ];
  });

  // ── Dates and fuel ──
  // ── Tires (PSI por llanta — máximo 4) ──
  protected readonly tireColumns: DynadrillDataTableColumn[] = [
    { key: 'rowLabel', header: '' },
    ...this.report.tires.map(t => ({ key: t.position, header: t.position })),
  ];

  protected readonly tireRows = computed(() => {
    const t = this.report.tires;
    const salida: Record<string, string> = { rowLabel: 'Salida' };
    const llegada: Record<string, string> = { rowLabel: 'Llegada' };
    for (const tire of t) {
      salida[tire.position] = tire.salida || '—';
      llegada[tire.position] = tire.llegada || '—';
    }
    return [salida, llegada];
  });

  // ── Hubodómetro (lectura por eje, tomada en Origen y en Destino) ──
  protected readonly hubodometroColumns: DynadrillDataTableColumn[] = [
    { key: 'centro', header: '' },
    { key: 'salida', header: 'Salida' },
    { key: 'llegada', header: 'Llegada' },
  ];

  protected readonly hubodometroRows = computed(() => [
    {
      centro: 'Origen',
      salida: this.report.hubodometroOrigen.map(h => h.salida ?? '—').join(' / '),
      llegada: this.report.hubodometroOrigen.map(h => h.llegada ?? '—').join(' / '),
    },
    {
      centro: 'Destino',
      salida: this.report.hubodometroDestino.map(h => h.salida ?? '—').join(' / '),
      llegada: this.report.hubodometroDestino.map(h => h.llegada ?? '—').join(' / '),
    },
  ]);

  // ── Novelties ──
  // ── Operability ──
  // ── Signatures ──
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

  /** PDF del Reporte de Unidad (formato DYN-MNT-RE-012) con lo registrado hasta este momento. */
  protected verPdf(): void {
    this.documentoPdf.abrir({
      titulo: `Reporte de Unidad — ${this.report.reportCode}`,
      component: ReporteUnidadHoja,
      inputs: { reporte: this.report },
      nombreArchivo: `Reporte de Unidad ${this.report.reportCode}`,
    });
  }
}
