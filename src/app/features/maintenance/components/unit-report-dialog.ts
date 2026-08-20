import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, WritableSignal, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDatetimePickerComponent,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillStepperComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  CHASIS_CHECKLIST_LABELS,
  ChecklistDualItem,
  CreateUnitReportInput,
  INSTRUMENTACION_CHECKLIST_LABELS,
  PLATAFORMA_CHECKLIST_LABELS,
  UnitReport,
  unitReportHasNovedades,
} from '../models/unit-report.model';
import { UnitReportsService } from '../services/unit-reports.service';

const STEPS = ['Datos', 'Métricas', 'Chasis', 'Plataforma', 'Instrum.', 'Problemas', 'Firmas'];

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
  imports: [
    CommonModule,
    DynadrillInputComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTextareaComponent,
    DynadrillCheckboxComponent,
    DynadrillButtonComponent,
    DynadrillIconComponent,
    DynadrillStepperComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unit-report-dialog.html',
  styleUrl: './unit-report-dialog.scss',
})
export class UnitReportDialog {
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<UnitReportDialog, UnitReport | undefined>);

  protected readonly steps = STEPS;
  protected readonly currentStep = signal(0);
  protected readonly submitting = signal(false);

  protected readonly reportNo = signal('');
  protected readonly pozo = signal('');
  protected readonly bloque = signal('');
  protected readonly cliente = signal('');
  protected readonly base = signal('');
  protected readonly unidad = signal('');
  protected readonly fechaSalida = signal<Date | null>(null);
  protected readonly fechaLlegada = signal<Date | null>(null);

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
    if (this.currentStep() === 0 && (!this.reportNo().trim() || !this.pozo().trim() || !this.unidad().trim() || !this.fechaSalida())) {
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

  submit(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    const input: CreateUnitReportInput = {
      reportNo: this.reportNo(),
      pozo: this.pozo(),
      bloque: this.bloque(),
      cliente: this.cliente(),
      base: this.base(),
      unidad: this.unidad(),
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
    };

    this.unitReportsService.create(input).subscribe({
      next: report => {
        this.notify.success('Guardado', `Reporte de Unidad N° ${report.reportNo} creado.`);
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
