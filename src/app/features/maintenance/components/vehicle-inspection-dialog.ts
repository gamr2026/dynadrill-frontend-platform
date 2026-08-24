import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDatetimePickerComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillStepperComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ChecklistEstado,
  CreateVehicleInspectionInput,
  VEHICLE_CHECKLIST_EQUIPO,
  VEHICLE_CHECKLIST_VEHICULO,
  VehicleChecklistItem,
  VehicleInspection,
  vehicleInspectionHasNoCumple,
} from '../models/vehicle-inspection.model';
import { VehicleInspectionsService } from '../services/vehicle-inspections.service';
import { UnidadesService } from '../services/unidades.service';
import { Unidad } from '../models/unidad.model';
import { UnitReportDialog, UnitReportDialogData } from './unit-report-dialog';
import { AuthService } from '../../../core/services/auth.service';

const STEPS = ['Datos', 'Vehículo', 'Equipo', 'Conductor'];

function toChecklistItems(labels: string[]): VehicleChecklistItem[] {
  return labels.map(label => ({ label, estado: null }));
}

/**
 * DYN-SGI-RE-068 — checklist previo a la salida de vehículos de apoyo
 * (camionetas/camiones/cabezales). Lo llena el rol Conductor — separado de
 * "Operador" (Pumping/FCR) porque los "Documentos del conductor" del
 * formato (licencia, manejo defensivo, examen médico) son atestación
 * personal de quien maneja.
 */
@Component({
  selector: 'app-vehicle-inspection-dialog',
  imports: [
    CommonModule,
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTextareaComponent,
    DynadrillCheckboxComponent,
    DynadrillButtonComponent,
    DynadrillStepperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehicle-inspection-dialog.html',
  styleUrl: './vehicle-inspection-dialog.scss',
})
export class VehicleInspectionDialog {
  private readonly inspectionsService = inject(VehicleInspectionsService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<VehicleInspectionDialog, VehicleInspection | undefined>);

  protected readonly steps = STEPS;
  protected readonly currentStep = signal(0);
  protected readonly submitting = signal(false);

  protected readonly unidades = signal<Unidad[]>([]);
  protected readonly unidadOptions = computed<DynadrillSelectOption[]>(() =>
    this.unidades().filter(u => u.tipo === 'Transporte').map(u => ({ label: `${u.code} — ${u.nombre}`, value: u.id })),
  );

  protected readonly unidadId = signal<number | null>(null);
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly puntoPartida = signal('');
  protected readonly destino = signal('');
  protected readonly inspeccionadoPor = signal(this.auth.currentUser()?.name ?? '');

  protected readonly marca = signal('');
  protected readonly tipo = signal('');
  protected readonly modelo = signal('');
  protected readonly anioFabricacion = signal('');
  protected readonly placa = signal('');

  protected readonly fechaMatricula = signal('');
  protected readonly caducidadMatricula = signal('');
  protected readonly caducidadPoliza = signal('');
  protected readonly vigenciaOtroDocumento = signal('');

  protected readonly kmInicial = signal('');
  protected readonly kmFinal = signal('');
  protected readonly proximoMantenimiento = signal('');

  protected readonly checklistVehiculo = signal<VehicleChecklistItem[]>(toChecklistItems(VEHICLE_CHECKLIST_VEHICULO));
  protected readonly checklistEquipo = signal<VehicleChecklistItem[]>(toChecklistItems(VEHICLE_CHECKLIST_EQUIPO));

  protected readonly licenciaVigente = signal(false);
  protected readonly manejoDefensivoVigente = signal(false);
  protected readonly examenMedicoVigente = signal(false);
  protected readonly examenPsicosensometrico = signal(false);
  protected readonly documentosClientes = signal(false);
  protected readonly vacunasCertificado = signal(false);
  protected readonly reuneCondicionesParaTrabajar = signal(true);
  protected readonly observacionesConductor = signal('');
  protected readonly supervisorNombre = signal('');

  constructor() {
    this.unidadesService.list().subscribe(unidades => this.unidades.set(unidades));
  }

  setEstado(list: WritableSignal<VehicleChecklistItem[]>, index: number, estado: ChecklistEstado): void {
    list.update(items => items.map((item, i) => (i === index ? { ...item, estado: item.estado === estado ? null : estado } : item)));
  }

  next(): void {
    if (this.currentStep() === 0 && (!this.unidadId() || !this.fecha() || !this.puntoPartida().trim())) {
      this.notify.error('Falta información', 'Completa Unidad, Fecha y Punto de partida antes de continuar.');
      return;
    }
    this.currentStep.update(i => Math.min(i + 1, STEPS.length - 1));
  }

  back(): void {
    this.currentStep.update(i => Math.max(i - 1, 0));
  }

  cancel(): void {
    this.modalRef.close();
  }

  private buildInput(): CreateVehicleInspectionInput {
    const unidad = this.unidades().find(u => u.id === this.unidadId());
    return {
      unidadId: this.unidadId()!,
      unidadCode: unidad?.code ?? '',
      fecha: this.fecha()!.toISOString(),
      puntoPartida: this.puntoPartida(),
      destino: this.destino(),
      inspeccionadoPor: this.inspeccionadoPor(),
      marca: this.marca(),
      tipo: this.tipo(),
      modelo: this.modelo(),
      anioFabricacion: this.anioFabricacion(),
      placa: this.placa(),
      fechaMatricula: this.fechaMatricula() || undefined,
      caducidadMatricula: this.caducidadMatricula() || undefined,
      caducidadPoliza: this.caducidadPoliza() || undefined,
      vigenciaOtroDocumento: this.vigenciaOtroDocumento() || undefined,
      kmInicial: Number(this.kmInicial()) || 0,
      kmFinal: Number(this.kmFinal()) || 0,
      proximoMantenimiento: this.proximoMantenimiento() || undefined,
      checklistVehiculo: this.checklistVehiculo(),
      checklistEquipo: this.checklistEquipo(),
      licenciaVigente: this.licenciaVigente(),
      manejoDefensivoVigente: this.manejoDefensivoVigente(),
      examenMedicoVigente: this.examenMedicoVigente(),
      examenPsicosensometrico: this.examenPsicosensometrico(),
      documentosClientes: this.documentosClientes(),
      vacunasCertificado: this.vacunasCertificado(),
      reuneCondicionesParaTrabajar: this.reuneCondicionesParaTrabajar(),
      observacionesConductor: this.observacionesConductor() || undefined,
      supervisorNombre: this.supervisorNombre() || undefined,
    };
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    const input = this.buildInput();

    this.inspectionsService.create(input).subscribe({
      next: async inspection => {
        this.notify.success('Guardado', `Inspección de ${inspection.unidadCode} registrada.`);
        // Se espera a que termine el flujo del Reporte de Unidad (si aplica)
        // antes de cerrar — así quien reabre la lista ya ve el enlace hecho,
        // en vez de tener que adivinar que hubo un segundo paso pendiente.
        if (vehicleInspectionHasNoCumple(inspection)) {
          await this.offerUnitReport(inspection);
        }
        this.modalRef.close(inspection);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar la inspección.');
      },
    });
  }

  /**
   * Plan 2026, 5.4: "para tomar acción sobre una falla reportada en este
   * check list, se deberá llenar el formato de Reporte de Unidad".
   */
  private async offerUnitReport(inspection: VehicleInspection): Promise<void> {
    const confirmed = await this.dialogService.confirm({
      title: 'Falla detectada en la inspección',
      content: `${inspection.unidadCode} tiene al menos un ítem "No cumple". ¿Generar el Reporte de Unidad para darle seguimiento?`,
      okText: 'Generar Reporte de Unidad',
    });
    if (!confirmed) return;

    const ref = this.dialogService.open<UnitReportDialog, UnitReportDialogData>({
      title: 'Reporte de Unidad',
      content: UnitReportDialog,
      data: { unidadId: inspection.unidadId, sourceModule: 'Vehículos', originVehicleInspectionId: inspection.id },
      footer: false,
    });

    await new Promise<void>(resolve => ref.afterClose.subscribe(() => resolve()));
  }
}
