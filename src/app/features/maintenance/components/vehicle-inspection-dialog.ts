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
import { RolesService } from '../../users/services/users.service';
import { parseLocalDateString } from '../../../shared/utils';

/** Código de rol (roles.code) — estable, ver backend role-code.ts. */
const SUPERVISOR_ROLE_CODE = 'supervisor';

const STEPS = ['Datos', 'Vehículo', 'Equipo', 'Conductor'];

export interface VehicleInspectionDialogData {
  /** Si viene, el diálogo abre prellenado con este registro (edición si id > 0, alta prellenada si id <= 0). */
  existing?: VehicleInspection;
  /** true = solo lectura: se ve el detalle pero no se puede guardar (ni se llama al backend). */
  readonly?: boolean;
  /** true = el select de Unidad queda bloqueado — para la inspección de llegada, donde la unidad ya se fijó en la salida. */
  lockUnidad?: boolean;
  /** Código de la unidad ya asignada al operador — la precarga y (con lockUnidad) la fija, para no pedirla de nuevo. */
  unidadCodeAsignada?: string;
  /** Nombre del supervisor a dejar preseleccionado en el paso "Conductor" (ej. el supervisor asignado al ticket de Pumping). */
  supervisorNombre?: string;
  /** 'salida' (default): solo pide kilometraje inicial. 'llegada': pide el final — pedirlos juntos en la salida no tiene sentido si recién va a viajar. */
  modo?: 'salida' | 'llegada';
}

function toChecklistItems(labels: string[]): VehicleChecklistItem[] {
  return labels.map(label => ({ label, estado: null }));
}

/** Parsea a Date local, o null si el valor no es una fecha válida (evita Invalid Date que revienta al serializar). */
function parseFechaSegura(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const d = parseLocalDateString(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date -> ISO, tolerando null/Invalid Date. */
function isoOrUndefined(d: Date | null): string | undefined {
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
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
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<VehicleInspectionDialog, VehicleInspection | undefined>);
  private readonly data = inject<VehicleInspectionDialogData | null>(NZ_MODAL_DATA, { optional: true });
  // id <= 0 = registro de ejemplo no persistido (ver createMockCompletedInspection en pumping): se prellenar pero se guarda como alta nueva, nunca PUT.
  private readonly existingId = (this.data?.existing?.id ?? 0) > 0 ? this.data!.existing!.id : null;
  protected readonly isEditMode = this.existingId !== null;
  protected readonly readonly = this.data?.readonly ?? false;
  protected readonly unidadLocked = this.data?.lockUnidad ?? false;
  /** Kilometraje final (odómetro de regreso) solo tiene sentido en la inspección de llegada. */
  protected readonly esLlegada = this.data?.modo === 'llegada';

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
  /** Explica de dónde sale la fecha auto-calculada de próximo mantenimiento (o por qué no se pudo calcular). */
  protected readonly proximoMantenimientoLeyenda = signal('');

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
  /** Conductores alternativos que sí reúnen las condiciones — para sugerir un cambio cuando el elegido no las cumple. */
  protected readonly conductoresSugeridos = computed<DynadrillSelectOption[]>(() =>
    this.conductoresPermisos()
      .filter(c => c.nombre !== this.inspeccionadoPor() && conductorReuneCondiciones(c))
      .map(c => ({ label: c.nombre, value: c.nombre })),
  );
  protected readonly observacionesConductor = signal('');
  protected readonly supervisorNombre = signal(this.data?.supervisorNombre ?? '');
  /**
   * Supervisores activos del sistema — se elige de la lista, no se escribe a
   * mano. Se siembra ya con el supervisor que llega por `data` (el asignado
   * al ticket de Pumping) para que el select nunca quede vacío aunque la
   * llamada de red falle o tarde.
   */
  protected readonly supervisorOptions = signal<DynadrillSelectOption[]>(
    this.data?.supervisorNombre ? [{ label: this.data.supervisorNombre, value: this.data.supervisorNombre }] : [],
  );

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
    // Medianoche local para no mostrar un día antes en UTC-5; tolerante a datos malos.
    if (unidad.fechaMatricula) this.fechaMatricula.set(parseFechaSegura(unidad.fechaMatricula));
    if (unidad.caducidadMatricula) this.caducidadMatricula.set(parseFechaSegura(unidad.caducidadMatricula));
    if (unidad.caducidadPoliza) this.caducidadPoliza.set(parseFechaSegura(unidad.caducidadPoliza));
    if (unidad.vigenciaOtroDocumento) this.vigenciaOtroDocumento.set(parseFechaSegura(unidad.vigenciaOtroDocumento));
    // El kilometraje se precarga como sugerencia pero queda EDITABLE (no se
    // bloquea como Marca/Modelo/Placa): es una lectura física del odómetro
    // y `Unidad.kmActual` puede estar desactualizado — el inspector lo
    // ajusta contra el tablero.
    if (unidad.kmActual != null && !this.kmInicial()) this.kmInicial.set(String(unidad.kmActual));
    this.calcularProximoMantenimiento(unidad);
  }

  /**
   * Misma regla de "6 meses" ya usada en calcularAlertas() (unidad.model.ts,
   * MESES_SIN_HORAS/diasLimite = 6*30) — Servicio la usa como respaldo por
   * tiempo cuando no llega a las 250h, y Auxiliar la usa como su regla
   * principal. Es la única regla de las 3 que da una FECHA calculable;
   * Transporte se controla por kilometraje (cada 5.000 km), no por
   * calendario, así que ahí se deja manual — inventar una fecha a partir de
   * un supuesto de km/día no está respaldado por ninguna regla real.
   */
  private calcularProximoMantenimiento(unidad: Unidad): void {
    if (this.proximoMantenimiento()) return; // no pisa un valor ya cargado (edición)
    const DIAS_INTERVALO = 180;
    const base = unidad.tipo === 'Servicio' ? unidad.fechaUltimoMantenimiento : unidad.tipo === 'Auxiliar' ? unidad.fechaUltimoMantenimientoAux : undefined;
    if (!base) {
      this.proximoMantenimientoLeyenda.set(
        unidad.tipo === 'Transporte'
          ? 'Transporte se controla por kilometraje (cada 5.000 km), no por fecha calendario — completar manualmente según el odómetro.'
          : `Esta unidad no tiene fecha de último mantenimiento registrada — no se puede calcular. Completar manualmente y registrar el mantenimiento en Unidades para que se calcule solo la próxima vez.`,
      );
      return;
    }
    const fecha = new Date(base);
    fecha.setDate(fecha.getDate() + DIAS_INTERVALO);
    this.proximoMantenimiento.set(fecha);
    this.proximoMantenimientoLeyenda.set(
      unidad.tipo === 'Servicio'
        ? `Calculado: 6 meses (180 días) desde el último mantenimiento (${base}) — regla de respaldo por tiempo si no se alcanzan antes las 250h de horómetro.`
        : `Calculado: 6 meses (180 días) desde el último mantenimiento (${base}) — regla semestral para unidades Auxiliares.`,
    );
  }

  constructor() {
    this.unidadesService.list().subscribe(unidades => {
      this.unidades.set(unidades);
      // 1) Registro de salida con unidadId que no resuelve (datos de ejemplo): se corrige por código.
      const ex = this.data?.existing;
      if (ex && !unidades.some(u => u.id === this.unidadId())) {
        const porCodigo = unidades.find(u => u.code === ex.unidadCode);
        if (porCodigo) this.unidadId.set(porCodigo.id);
      }
      // 2) Inspección de salida: la unidad ya se la asignó el Supervisor —
      //    se precarga (y con lockUnidad, se fija) en vez de pedirla de nuevo.
      const codigoAsignado = this.data?.unidadCodeAsignada;
      if (codigoAsignado && this.unidadId() === null) {
        const asignada = unidades.find(u => u.code === codigoAsignado);
        if (asignada) this.onUnidadChange(asignada.id);
      }
      // 3) Prellenado de llegada (id <= 0): la descripción del vehículo se
      //    toma del registro REAL de la unidad, no de lo que venga en `existing`.
      if (ex && this.existingId === null && this.unidadId() !== null) {
        this.onUnidadChange(this.unidadId());
      }
    });
    this.inspectionsService.listConductoresPermisos().subscribe(permisos => this.conductoresPermisos.set(permisos));

    // "Nombre del Supervisor": se precargan los supervisores activos del
    // sistema vía `GET /api/roles/supervisor/usuarios` — un endpoint liviano
    // (id + nombre) accesible a cualquier autenticado, a diferencia de
    // `GET /api/users` que es solo Superadmin.
    this.rolesService.usuariosPorRol(SUPERVISOR_ROLE_CODE).subscribe({
      next: usuarios => {
        const nombres = [...new Set(usuarios.map(u => u.name))];
        // Conserva el supervisor preseleccionado aunque no esté en la lista
        // de activos (ej. cambió de rol después de asignarse al ticket).
        const preseleccionado = this.supervisorNombre();
        if (preseleccionado && !nombres.includes(preseleccionado)) nombres.unshift(preseleccionado);
        this.supervisorOptions.set(nombres.map(n => ({ label: n, value: n })));
      },
      // Si falla, queda al menos el supervisor sembrado desde `data`.
      error: () => {},
    });

    const existing = this.data?.existing;
    if (existing) {
      this.unidadId.set(existing.unidadId);
      this.fecha.set(parseFechaSegura(existing.fecha) ?? new Date());
      this.puntoPartida.set(existing.puntoPartida);
      this.destino.set(existing.destino);
      this.inspeccionadoPor.set(existing.inspeccionadoPor);
      this.marca.set(existing.marca);
      this.tipo.set(existing.tipo);
      this.modelo.set(existing.modelo);
      this.anioFabricacion.set(existing.anioFabricacion);
      this.placa.set(existing.placa);
      this.fechaMatricula.set(parseFechaSegura(existing.fechaMatricula));
      this.caducidadMatricula.set(parseFechaSegura(existing.caducidadMatricula));
      this.caducidadPoliza.set(parseFechaSegura(existing.caducidadPoliza));
      this.vigenciaOtroDocumento.set(parseFechaSegura(existing.vigenciaOtroDocumento));
      // 0 = sin lectura (nunca es un odómetro real) -> se muestra vacío.
      this.kmInicial.set(existing.kmInicial ? String(existing.kmInicial) : '');
      this.kmFinal.set(existing.kmFinal ? String(existing.kmFinal) : '');
      this.proximoMantenimiento.set(parseFechaSegura(existing.proximoMantenimiento));
      this.checklistVehiculo.set(existing.checklistVehiculo);
      this.checklistEquipo.set(existing.checklistEquipo);
      // Los 6 documentos del conductor y "reúne condiciones" ya no se restauran del registro guardado:
      // se derivan en vivo de conductorSeleccionado() (inspeccionadoPor, seteado arriba) contra la base simulada.
      this.observacionesConductor.set(existing.observacionesConductor ?? '');
      // El supervisor del ticket (data.supervisorNombre) gana sobre el guardado en el registro.
      this.supervisorNombre.set(this.data?.supervisorNombre || existing.supervisorNombre || '');
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
      fecha: isoOrUndefined(this.fecha()) ?? new Date().toISOString(),
      puntoPartida: this.puntoPartida(),
      destino: this.destino(),
      inspeccionadoPor: this.inspeccionadoPor(),
      marca: this.marca(),
      tipo: this.tipo(),
      modelo: this.modelo(),
      anioFabricacion: this.anioFabricacion(),
      placa: this.placa(),
      fechaMatricula: isoOrUndefined(this.fechaMatricula()),
      caducidadMatricula: isoOrUndefined(this.caducidadMatricula()),
      caducidadPoliza: isoOrUndefined(this.caducidadPoliza()),
      vigenciaOtroDocumento: isoOrUndefined(this.vigenciaOtroDocumento()),
      kmInicial: Number(this.kmInicial()) || 0,
      kmFinal: Number(this.kmFinal()) || 0,
      proximoMantenimiento: isoOrUndefined(this.proximoMantenimiento()),
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
