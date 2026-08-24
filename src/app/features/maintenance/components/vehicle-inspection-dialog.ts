import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
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
  vehicleInspectionBlockedBySeatbelt,
  vehicleInspectionHasNoCumple,
} from '../models/vehicle-inspection.model';
import { VehicleInspectionsService } from '../services/vehicle-inspections.service';
import { UnidadesService } from '../services/unidades.service';
import { Unidad } from '../models/unidad.model';
import { UnitReportDialog, UnitReportDialogData } from './unit-report-dialog';
import { AuthService } from '../../../core/services/auth.service';

const STEPS = ['Datos', 'Vehículo', 'Equipo', 'Conductor'];

export interface VehicleInspectionDialogData {
  /** Si viene, el diálogo abre en modo edición prellenado con este registro. */
  existing?: VehicleInspection;
}

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
  private readonly data = inject<VehicleInspectionDialogData | null>(NZ_MODAL_DATA, { optional: true });
  private readonly existingId = this.data?.existing?.id ?? null;
  protected readonly isEditMode = this.existingId !== null;

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

  protected readonly fechaMatricula = signal<Date | null>(null);
  protected readonly caducidadMatricula = signal<Date | null>(null);
  protected readonly caducidadPoliza = signal<Date | null>(null);
  protected readonly vigenciaOtroDocumento = signal<Date | null>(null);

  protected readonly kmInicial = signal('');
  protected readonly kmFinal = signal('');
  protected readonly proximoMantenimiento = signal<Date | null>(null);

  protected readonly checklistVehiculo = signal<VehicleChecklistItem[]>(toChecklistItems(VEHICLE_CHECKLIST_VEHICULO));
  protected readonly checklistEquipo = signal<VehicleChecklistItem[]>(toChecklistItems(VEHICLE_CHECKLIST_EQUIPO));
  protected readonly seatbeltBlocked = computed(() => vehicleInspectionBlockedBySeatbelt({ checklistVehiculo: this.checklistVehiculo() }));

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

    const existing = this.data?.existing;
    if (existing) {
      this.unidadId.set(existing.unidadId);
      this.fecha.set(new Date(existing.fecha));
      this.puntoPartida.set(existing.puntoPartida);
      this.destino.set(existing.destino);
      this.inspeccionadoPor.set(existing.inspeccionadoPor);
      this.marca.set(existing.marca);
      this.tipo.set(existing.tipo);
      this.modelo.set(existing.modelo);
      this.anioFabricacion.set(existing.anioFabricacion);
      this.placa.set(existing.placa);
      this.fechaMatricula.set(existing.fechaMatricula ? new Date(existing.fechaMatricula) : null);
      this.caducidadMatricula.set(existing.caducidadMatricula ? new Date(existing.caducidadMatricula) : null);
      this.caducidadPoliza.set(existing.caducidadPoliza ? new Date(existing.caducidadPoliza) : null);
      this.vigenciaOtroDocumento.set(existing.vigenciaOtroDocumento ? new Date(existing.vigenciaOtroDocumento) : null);
      this.kmInicial.set(String(existing.kmInicial ?? ''));
      this.kmFinal.set(String(existing.kmFinal ?? ''));
      this.proximoMantenimiento.set(existing.proximoMantenimiento ? new Date(existing.proximoMantenimiento) : null);
      this.checklistVehiculo.set(existing.checklistVehiculo);
      this.checklistEquipo.set(existing.checklistEquipo);
      this.licenciaVigente.set(existing.licenciaVigente);
      this.manejoDefensivoVigente.set(existing.manejoDefensivoVigente);
      this.examenMedicoVigente.set(existing.examenMedicoVigente);
      this.examenPsicosensometrico.set(existing.examenPsicosensometrico);
      this.documentosClientes.set(existing.documentosClientes);
      this.vacunasCertificado.set(existing.vacunasCertificado);
      this.reuneCondicionesParaTrabajar.set(existing.reuneCondicionesParaTrabajar);
      this.observacionesConductor.set(existing.observacionesConductor ?? '');
      this.supervisorNombre.set(existing.supervisorNombre ?? '');
    }
  }

  /** Clic principal: cicla vacío → Cumple → No cumple → vacío. N/A queda aparte (ver setNA). */
  cycleEstado(list: WritableSignal<VehicleChecklistItem[]>, index: number): void {
    const next: Record<'C' | 'NC' | 'NA' | 'none', ChecklistEstado> = { none: 'C', C: 'NC', NC: null, NA: 'C' };
    list.update(items => items.map((item, i) => (i === index ? { ...item, estado: next[item.estado ?? 'none'] } : item)));
  }

  setNA(list: WritableSignal<VehicleChecklistItem[]>, index: number): void {
    list.update(items => items.map((item, i) => (i === index ? { ...item, estado: item.estado === 'NA' ? null : 'NA' } : item)));
  }

  markAll(list: WritableSignal<VehicleChecklistItem[]>, estado: 'C' | 'NC'): void {
    list.update(items => items.map(item => ({ ...item, estado })));
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
      fechaMatricula: this.fechaMatricula()?.toISOString(),
      caducidadMatricula: this.caducidadMatricula()?.toISOString(),
      caducidadPoliza: this.caducidadPoliza()?.toISOString(),
      vigenciaOtroDocumento: this.vigenciaOtroDocumento()?.toISOString(),
      kmInicial: Number(this.kmInicial()) || 0,
      kmFinal: Number(this.kmFinal()) || 0,
      proximoMantenimiento: this.proximoMantenimiento()?.toISOString(),
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

    if (this.isEditMode) {
      this.inspectionsService.update(this.existingId!, input).subscribe({
        next: inspection => {
          this.notify.success('Guardado', `Inspección de ${inspection.unidadCode} actualizada.`);
          this.modalRef.close(inspection);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudo actualizar la inspección.');
        },
      });
      return;
    }

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
