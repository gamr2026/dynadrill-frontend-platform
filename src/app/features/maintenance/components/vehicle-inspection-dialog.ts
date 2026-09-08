import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
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
  ConductorPermisos,
  conductorPermisosPorVencer,
  conductorReuneCondiciones,
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
import { RolesService, UsersService } from '../../users/services/users.service';
import { parseLocalDateString, toLocalDateString } from '../../../shared/utils';

const SUPERVISOR_ROLE_NAME = 'Supervisor';

const STEPS = ['Datos', 'Vehículo', 'Equipo', 'Conductor'];

export interface VehicleInspectionDialogData {
  /** Si viene, el diálogo abre en modo edición prellenado con este registro. */
  existing?: VehicleInspection;
  /** true = solo lectura: se ve el detalle pero no se puede guardar (ni se llama al backend). */
  readonly?: boolean;
}

function toChecklistItems(labels: string[]): VehicleChecklistItem[] {
  return labels.map(label => ({ label, estado: null }));
}

/** Medianoche LOCAL: `new Date('2026-01-10')` es UTC y en Ecuador (UTC-5) el date-picker lo muestra un día antes. */
function parseIsoLocal(iso: string): Date {
  return new Date(iso.slice(0, 10) + 'T00:00:00');
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
  private readonly rolesService = inject(RolesService);
  private readonly usersService = inject(UsersService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<VehicleInspectionDialog, VehicleInspection | undefined>);
  private readonly data = inject<VehicleInspectionDialogData | null>(NZ_MODAL_DATA, { optional: true });
  // id <= 0 = registro de ejemplo no persistido (ver createMockCompletedInspection en pumping): se prellenar pero se guarda como alta nueva, nunca PUT.
  private readonly existingId = (this.data?.existing?.id ?? 0) > 0 ? this.data!.existing!.id : null;
  protected readonly isEditMode = this.existingId !== null;
  protected readonly readonly = this.data?.readonly ?? false;

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

  /**
   * Marca/Tipo/Modelo/Año/Placa se toman del registro maestro de la Unidad
   * y quedan bloqueados una vez elegida — no se editan aquí para no
   * introducir inconsistencias con Inventario. Si el registro maestro está
   * incompleto o mal, se corrige en Inventario (PATCH .../patrimonio).
   */
  protected readonly vehiculoDataLocked = computed(() => this.unidadId() !== null);

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

  /**
   * FACT del cliente (presentación del módulo, 2026-09-01): los 6
   * documentos del conductor ya no se marcan a mano — vienen de una base
   * de RRHH/QHSE simulada (todavía no existe una real) y determinan solas
   * si se puede guardar la inspección.
   */
  protected readonly conductoresPermisos = signal<ConductorPermisos[]>([]);
  protected readonly conductorOptions = computed<DynadrillSelectOption[]>(() => this.conductoresPermisos().map(c => ({ label: c.nombre, value: c.nombre })));
  protected readonly conductorSeleccionado = computed<ConductorPermisos | null>(
    () => this.conductoresPermisos().find(c => c.nombre === this.inspeccionadoPor()) ?? null,
  );
  protected readonly reuneCondicionesParaTrabajar = computed(() => {
    const c = this.conductorSeleccionado();
    return !!c && conductorReuneCondiciones(c);
  });
  protected readonly permisosPorVencer = computed(() => {
    const c = this.conductorSeleccionado();
    return c ? conductorPermisosPorVencer(c) : [];
  });
  protected readonly observacionesConductor = signal('');
  protected readonly supervisorNombre = signal('');
  /** Supervisores activos en el sistema — se elige de la lista, no se escribe a mano. */
  protected readonly supervisorOptions = signal<DynadrillSelectOption[]>([]);

  /** El wizard permitía avanzar por los pasos de checklist (Vehículo/Equipo) sin marcar ningún ítem — next() solo valida el paso 0. */
  protected readonly checklistCompleto = computed(
    () => this.checklistVehiculo().every(i => i.estado !== null) && this.checklistEquipo().every(i => i.estado !== null),
  );

  protected readonly puedeGuardar = computed(
    () => !!this.unidadId() && !!this.conductorSeleccionado() && this.reuneCondicionesParaTrabajar() && this.checklistCompleto(),
  );

  /**
   * Al elegir la unidad, precarga sus datos patrimoniales (Marca/Tipo/
   * Modelo/Año/Placa) desde el registro de la Unidad — el inspector ya no
   * los reescribe a mano. Quedan editables por si el registro está
   * incompleto o desactualizado.
   */
  protected onUnidadChange(unidadId: number | null): void {
    this.unidadId.set(unidadId);
    const unidad = this.unidades().find(u => u.id === unidadId);
    if (!unidad) return;
    if (unidad.marca) this.marca.set(unidad.marca);
    if (unidad.modelo) this.modelo.set(unidad.modelo);
    if (unidad.anio) this.anioFabricacion.set(unidad.anio);
    if (unidad.placa) this.placa.set(unidad.placa);
    if (unidad.categoriaPeso) this.tipo.set(unidad.categoriaPeso);
    // Documentos legales del vehículo: vienen del patrimonio de la Unidad
    // (Inventario) y quedan bloqueados, igual que Marca/Modelo/Placa.
    // Medianoche local (ver parseIsoLocal) para no mostrar un día antes en UTC-5.
    if (unidad.fechaMatricula) this.fechaMatricula.set(parseIsoLocal(unidad.fechaMatricula));
    if (unidad.caducidadMatricula) this.caducidadMatricula.set(parseIsoLocal(unidad.caducidadMatricula));
    if (unidad.caducidadPoliza) this.caducidadPoliza.set(parseIsoLocal(unidad.caducidadPoliza));
    if (unidad.vigenciaOtroDocumento) this.vigenciaOtroDocumento.set(parseIsoLocal(unidad.vigenciaOtroDocumento));
    // El kilometraje se precarga como sugerencia pero queda EDITABLE (no se
    // bloquea como Marca/Modelo/Placa): es una lectura física del odómetro
    // y `Unidad.kmActual` puede estar desactualizado — el inspector lo
    // ajusta contra el tablero.
    if (unidad.kmActual != null && !this.kmInicial()) this.kmInicial.set(String(unidad.kmActual));
  }

  constructor() {
    this.unidadesService.list().subscribe(unidades => this.unidades.set(unidades));
    this.inspectionsService.listConductoresPermisos().subscribe(permisos => this.conductoresPermisos.set(permisos));

    // "Nombre del Supervisor": se precargan los supervisores activos del
    // sistema (rol Supervisor) — se elige de la lista, no se tipea.
    this.rolesService.list().subscribe(roles => {
      const supervisorRole = roles.find(r => r.name === SUPERVISOR_ROLE_NAME);
      if (!supervisorRole) return;
      this.usersService.list().subscribe(users => {
        const nombres = [
          ...new Set(users.filter(u => u.status && u.roleId === supervisorRole.id).map(u => u.name)),
        ];
        this.supervisorOptions.set(nombres.map(n => ({ label: n, value: n })));
      });
    });

    const existing = this.data?.existing;
    if (existing) {
      this.unidadId.set(existing.unidadId);
      this.fecha.set(parseLocalDateString(existing.fecha));
      this.puntoPartida.set(existing.puntoPartida);
      this.destino.set(existing.destino);
      this.inspeccionadoPor.set(existing.inspeccionadoPor);
      this.marca.set(existing.marca);
      this.tipo.set(existing.tipo);
      this.modelo.set(existing.modelo);
      this.anioFabricacion.set(existing.anioFabricacion);
      this.placa.set(existing.placa);
      this.fechaMatricula.set(existing.fechaMatricula ? parseLocalDateString(existing.fechaMatricula) : null);
      this.caducidadMatricula.set(existing.caducidadMatricula ? parseLocalDateString(existing.caducidadMatricula) : null);
      this.caducidadPoliza.set(existing.caducidadPoliza ? parseLocalDateString(existing.caducidadPoliza) : null);
      this.vigenciaOtroDocumento.set(existing.vigenciaOtroDocumento ? parseLocalDateString(existing.vigenciaOtroDocumento) : null);
      this.kmInicial.set(String(existing.kmInicial ?? ''));
      this.kmFinal.set(String(existing.kmFinal ?? ''));
      this.proximoMantenimiento.set(existing.proximoMantenimiento ? parseLocalDateString(existing.proximoMantenimiento) : null);
      this.checklistVehiculo.set(existing.checklistVehiculo);
      this.checklistEquipo.set(existing.checklistEquipo);
      // Los 6 documentos del conductor y "reúne condiciones" ya no se restauran del registro guardado:
      // se derivan en vivo de conductorSeleccionado() (inspeccionadoPor, seteado arriba) contra la base simulada.
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
    if (this.currentStep() === 0 && (!this.unidadId() || !this.fecha() || !this.puntoPartida().trim() || !this.inspeccionadoPor())) {
      this.notify.error('Falta información', 'Completa Unidad, Fecha, Punto de partida y Conductor antes de continuar.');
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
    const conductor = this.conductorSeleccionado();
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
      licenciaVigente: conductor?.licenciaVigente ?? false,
      manejoDefensivoVigente: conductor?.manejoDefensivoVigente ?? false,
      examenMedicoVigente: conductor?.examenMedicoVigente ?? false,
      examenPsicosensometrico: conductor?.examenPsicosensometrico ?? false,
      documentosClientes: conductor?.documentosClientes ?? false,
      vacunasCertificado: conductor?.vacunasCertificado ?? false,
      reuneCondicionesParaTrabajar: this.reuneCondicionesParaTrabajar(),
      observacionesConductor: this.observacionesConductor() || undefined,
      supervisorNombre: this.supervisorNombre() || undefined,
    };
  }

  async submit(): Promise<void> {
    if (this.readonly || this.submitting() || !this.puedeGuardar()) return;
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
