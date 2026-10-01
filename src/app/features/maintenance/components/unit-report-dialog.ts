import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDatetimePickerComponent,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillStepperComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  CHASIS_CHECKLIST_LABELS,
  ChecklistDualItem,
  CreateUnitReportInput,
  INSTRUMENTACION_CHECKLIST_LABELS,
  MaintenanceSourceModule,
  PLATAFORMA_CHECKLIST_LABELS,
  UnitReport,
  unitReportCode,
  unitReportHasNovedades,
} from '../models/unit-report.model';
import { UnitReportsService } from '../services/unit-reports.service';
import { UnidadesService } from '../services/unidades.service';
import { Unidad } from '../models/unidad.model';
import { UBICACION_VACIA, UbicacionSelectorComponent, type UbicacionSeleccion } from '../../../shared/index';

const STEPS = ['Datos', 'Métricas', 'Chasis', 'Plataforma', 'Instrum.', 'Problemas', 'Firmas'];

export interface UnitReportDialogData {
  /** Prellena la unidad — usado al ofrecer un Reporte de Unidad desde una Inspección de Vehículos con "No cumple". */
  unidadId?: number;
  /** Prellena el origen — evita que el reporte diga "Pumping" cuando en realidad viene de Inspección de Vehículos. */
  sourceModule?: MaintenanceSourceModule;
  /** Enlaza el reporte con la inspección que lo originó, para poder rastrear si la novedad ya se atendió. */
  originVehicleInspectionId?: number;
}

function toDualItems(labels: string[]): ChecklistDualItem[] {
  return labels.map(label => ({ label, salida: null, llegada: null }));
}

/**
 * Contenido de DynadrillDialogService.open() — calca el formulario físico
 * "Reporte de Unidad" (DYN-MNT-RE-012). El estado del formulario vive en
 * signals planos (no ReactiveFormsModule): los arrays de checklist dual
 * (salida/llegada por ítem) no calzan bien con FormArray sin bastante
 * boilerplate extra, y este patrón ya es consistente con cómo
 * dynadrill-checklist maneja su propio estado.
 *
 * NO se dispara desde Mantenimiento: el Reporte de Unidad lo registra el
 * OPERADOR en su propia área (Pumping/FCR), no el Jefe de Mantenimiento —
 * Mantenimiento solo lo recibe y lo clasifica (MAN-001-A). Se queda acá,
 * sin wiring en maintenance-list-page, listo para moverse/reusarse cuando
 * exista el módulo de Pumping/FCR.
 */
@Component({
  selector: 'app-unit-report-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    CommonModule,
    DynadrillInputComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTextareaComponent,
    DynadrillCheckboxComponent,
    DynadrillButtonComponent,
    DynadrillIconComponent,
    DynadrillStepperComponent,
    DynadrillSelectComponent,
    DynadrillTextComponent,
    UbicacionSelectorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unit-report-dialog.html',
  styleUrl: './unit-report-dialog.scss',
})
export class UnitReportDialog {
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<UnitReportDialog, UnitReport | undefined>);
  private readonly data = inject<UnitReportDialogData>(NZ_MODAL_DATA, { optional: true });

  protected readonly steps = STEPS;
  protected readonly currentStep = signal(0);
  protected readonly submitting = signal(false);

  // El módulo que genera el reporte — se sobreescribe al instanciar desde Pumping, FCR o Vehículos.
  sourceModule: MaintenanceSourceModule = this.data?.sourceModule ?? 'Pumping';

  protected readonly reportNo = signal('');
  protected readonly cliente = signal('');
  /** Pozo / Campo (= "Base") / Bloque — del catálogo, vía <app-ubicacion-selector>. */
  protected readonly ubicacion = signal<UbicacionSeleccion>(UBICACION_VACIA);
  protected readonly unidadId = signal<number | null>(this.data?.unidadId ?? null);
  protected readonly fechaSalida = signal<Date | null>(null);
  protected readonly fechaLlegada = signal<Date | null>(null);

  protected readonly unidades = signal<Unidad[]>([]);
  protected readonly unidadOptions = computed<DynadrillSelectOption[]>(() =>
    this.unidades().map(u => ({ label: `${u.code} — ${u.nombre}`, value: u.id })),
  );
  protected readonly unidadSeleccionada = computed<Unidad | undefined>(() =>
    this.unidades().find(u => u.id === this.unidadId()),
  );
  /** Casillero de horas acumuladas (MAN-002) — pedido explícito del correo del cliente. */
  protected readonly horasAcumuladasLabel = computed(() => {
    const u = this.unidadSeleccionada();
    if (!u || u.tipo !== 'Servicio' || u.horometroActual === undefined) return null;
    const ultimoServicio = u.registrosPrev?.reduce((max, r) => Math.max(max, r.ultimoEnHoras), 0) ?? 0;
    const acumuladas = u.horometroActual - ultimoServicio;
    return `${acumuladas} h acumuladas desde el último mantenimiento (horómetro actual: ${u.horometroActual} h)`;
  });

  protected readonly horometroSalida = signal('');
  protected readonly horometroLlegada = signal('');
  protected readonly odometroSalida = signal('');
  protected readonly odometroLlegada = signal('');
  protected readonly origen = signal('');
  protected readonly destino = signal('');

  protected readonly inspeccionChasis = signal<ChecklistDualItem[]>(toDualItems(CHASIS_CHECKLIST_LABELS));
  protected readonly inspeccionPlataforma = signal<ChecklistDualItem[]>(toDualItems(PLATAFORMA_CHECKLIST_LABELS));
  protected readonly inspeccionInstrumentacion = signal<ChecklistDualItem[]>(toDualItems(INSTRUMENTACION_CHECKLIST_LABELS));

  protected readonly problemasMecanica = signal('');
  protected readonly problemasInstrumentacion = signal('');
  protected readonly problemasOperaciones = signal('');
  protected readonly interrumpioOperacion = signal(false);
  protected readonly detalleInterrupcion = signal('');
  protected readonly listaParaSiguienteOperacion = signal(true);

  protected readonly operadorSalida = signal('');
  protected readonly supervisorSalida = signal('');
  protected readonly operadorLlegada = signal('');
  protected readonly supervisorLlegada = signal('');

  /** No usa `Number(x) || null`: una lectura real de 0 es un valor válido, no "sin lectura". */
  private static parseLectura(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const value = Number(trimmed);
    return Number.isNaN(value) ? null : value;
  }

  /** Advertencia no bloqueante: una lectura que retrocede es una situación real (cambio de equipo, etc.) y debe poder registrarse igual. */
  protected readonly lecturaWarning = computed(() => {
    const u = this.unidadSeleccionada();
    const hSalida = UnitReportDialog.parseLectura(this.horometroSalida());
    const hLlegada = UnitReportDialog.parseLectura(this.horometroLlegada());
    const oSalida = UnitReportDialog.parseLectura(this.odometroSalida());
    const oLlegada = UnitReportDialog.parseLectura(this.odometroLlegada());

    if (hSalida !== null && hLlegada !== null && hLlegada < hSalida) {
      return 'El horómetro de llegada es menor al de salida — verifica las lecturas.';
    }
    if (oSalida !== null && oLlegada !== null && oLlegada < oSalida) {
      return 'El odómetro de llegada es menor al de salida — verifica las lecturas.';
    }
    if (u?.tipo === 'Servicio' && u.horometroActual !== undefined && hLlegada !== null && hLlegada < u.horometroActual) {
      return `El horómetro de llegada (${hLlegada} h) es menor al último registrado para esta unidad (${u.horometroActual} h).`;
    }
    if (u?.tipo === 'Transporte' && u.kmActual !== undefined && oLlegada !== null && oLlegada < u.kmActual) {
      return `El odómetro de llegada (${oLlegada} km) es menor al último registrado para esta unidad (${u.kmActual} km).`;
    }
    return null;
  });

  constructor() {
    this.unidadesService.list().subscribe(unidades => this.unidades.set(unidades));
  }

  toggleChecklist(list: WritableSignal<ChecklistDualItem[]>, index: number, column: 'salida' | 'llegada'): void {
    list.update(items =>
      items.map((item, i) => {
        if (i !== index) return item;
        const current = item[column];
        const next = current === 'ok' ? 'x' : current === 'x' ? null : 'ok';
        return { ...item, [column]: next };
      }),
    );
  }

  next(): void {
    if (this.currentStep() === 0 && (!this.reportNo().trim() || this.ubicacion().pozoId === null || !this.unidadId() || !this.fechaSalida())) {
      this.notify.error('Falta información', 'Completa Reporte N°, Pozo, Unidad y Fecha de Salida antes de continuar.');
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

  /** Antes se podía guardar el reporte completo (7 pasos) sin ninguna firma — next() solo valida el paso 0. */
  protected readonly canSubmit = computed(() => this.operadorSalida().trim() !== '' && this.supervisorSalida().trim() !== '');

  submit(): void {
    if (this.submitting() || !this.unidadId() || !this.canSubmit()) return;
    this.submitting.set(true);

    const input: CreateUnitReportInput = {
      reportNo: this.reportNo(),
      sourceModule: this.sourceModule,
      pozo: this.ubicacion().pozo,
      bloque: this.ubicacion().bloque,
      cliente: this.cliente(),
      base: this.ubicacion().campo,
      unidadId: this.unidadId()!,
      unidad: this.unidadSeleccionada()?.code ?? '',
      fechaSalida: this.fechaSalida()?.toISOString() ?? '',
      fechaLlegada: this.fechaLlegada()?.toISOString() ?? '',
      horometroSalida: this.horometroSalida() ? Number(this.horometroSalida()) : undefined,
      horometroLlegada: this.horometroLlegada() ? Number(this.horometroLlegada()) : undefined,
      odometroSalida: this.odometroSalida() ? Number(this.odometroSalida()) : undefined,
      odometroLlegada: this.odometroLlegada() ? Number(this.odometroLlegada()) : undefined,
      origen: this.origen(),
      destino: this.destino(),
      inspeccionChasis: this.inspeccionChasis(),
      inspeccionPlataforma: this.inspeccionPlataforma(),
      inspeccionInstrumentacion: this.inspeccionInstrumentacion(),
      problemasMecanica: this.problemasMecanica(),
      problemasInstrumentacion: this.problemasInstrumentacion(),
      problemasOperaciones: this.problemasOperaciones(),
      interrumpioOperacion: this.interrumpioOperacion(),
      detalleInterrupcion: this.detalleInterrupcion(),
      listaParaSiguienteOperacion: this.listaParaSiguienteOperacion(),
      operadorSalida: this.operadorSalida(),
      supervisorSalida: this.supervisorSalida(),
      operadorLlegada: this.operadorLlegada(),
      supervisorLlegada: this.supervisorLlegada(),
      originVehicleInspectionId: this.data?.originVehicleInspectionId,
    };

    this.unitReportsService.create(input).subscribe({
      next: report => {
        this.notify.success('Guardado', `Reporte de Unidad ${unitReportCode(report.reportNo)} creado.`);
        if (unitReportHasNovedades(report)) {
          this.notify.info('Novedad detectada', 'Este reporte trae problemas reportados — clasifícalo desde la Bandeja.');
        }
        this.modalRef.close(report);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar el Reporte de Unidad.');
      },
    });
  }
}
