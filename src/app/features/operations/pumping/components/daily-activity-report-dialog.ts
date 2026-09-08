import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
  type DynadrillContextCardItem,
} from '@digitec-it-projects/dynadrill-ui';
import type { DailyActivityEntry, DailyActivityReport } from '../models/pumping.model';
import { parseLocalDateString, toLocalDateString } from '../../../../shared/utils';

export interface DailyActivityReportDialogData {
  ticketCode: string;
  cliente: string;
  pozo: string;
  campoBloque: string;
  supervisor: string;
  /** Pre-fill from existing report if editing */
  existing?: DailyActivityReport;
}

export interface DailyActivityReportDialogResult {
  saved: boolean;
  report?: DailyActivityReport;
}

@Component({
  selector: 'app-daily-activity-report-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillContextCardComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTextareaComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-activity-report-dialog.html',
  styleUrl: './daily-activity-report-dialog.scss',
})
export class DailyActivityReportDialog {
  private readonly modalRef = inject(NzModalRef<DailyActivityReportDialog, DailyActivityReportDialogResult | undefined>);
  private readonly data = inject<DailyActivityReportDialogData>(NZ_MODAL_DATA);

  // ── Header info ──
  // dynadrill-datetime-picker trabaja con Date, no con el string ISO que guarda DailyActivityReport.fecha
  // (mismo patrón que travel-management-dialog.ts). Tipado `Date | null` porque el picker permite limpiar
  // el campo (allowClear) y emite null pese a que su tipo declarado diga Date — canSave/save() lo validan.
  protected readonly fecha = signal<Date | null>(this.data.existing?.fecha ? parseLocalDateString(this.data.existing.fecha) : new Date());
  protected readonly numero = signal(this.data.existing?.numero ?? '');
  protected readonly cliente = signal(this.data.existing?.cliente ?? this.data.cliente);
  protected readonly ordenContrato = signal(this.data.existing?.ordenContrato ?? '');
  protected readonly pozo = signal(this.data.existing?.pozo ?? this.data.pozo);
  protected readonly representanteCliente = signal(this.data.existing?.representanteCliente ?? '');
  protected readonly campoBloque = signal(this.data.existing?.campoBloque ?? this.data.campoBloque);
  protected readonly cargo = signal(this.data.existing?.cargo ?? '');
  protected readonly taladro = signal(this.data.existing?.taladro ?? '');

  protected readonly headerItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Documento', value: 'DYN-SGI-RE-047 V11' },
    { label: 'Ticket', value: this.data.ticketCode },
  ]);

  // ── Activities ──
  protected readonly actividades = signal<DailyActivityEntry[]>(
    this.data.existing?.actividades ?? [
      { inicio: '', fin: '', horas: null, detalle: '' },
      { inicio: '', fin: '', horas: null, detalle: '' },
      { inicio: '', fin: '', horas: null, detalle: '' },
      { inicio: '', fin: '', horas: null, detalle: '' },
      { inicio: '', fin: '', horas: null, detalle: '' },
      { inicio: '', fin: '', horas: null, detalle: '' },
    ],
  );

  protected addActivity(): void {
    this.actividades.update(list => [...list, { inicio: '', fin: '', horas: null, detalle: '' }]);
  }

  protected removeActivity(index: number): void {
    this.actividades.update(list => list.filter((_, i) => i !== index));
  }

  protected onActivityChange(index: number, field: keyof DailyActivityEntry, value: string): void {
    this.actividades.update(list =>
      list.map((entry, i) => {
        if (i !== index) return entry;
        const updated = { ...entry, [field]: field === 'horas' ? (Number(value) || null) : value };
        // Auto-calculate horas from inicio and fin
        if ((field === 'inicio' || field === 'fin') && updated.inicio && updated.fin) {
          updated.horas = this.calculateHours(updated.inicio, updated.fin);
        }
        return updated;
      }),
    );
  }

  private calculateHours(inicio: string, fin: string): number | null {
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    return Math.round((diff / 60) * 100) / 100;
  }

  // ── Time summaries ──
  protected readonly tiempoProductivo = signal(this.data.existing?.tiempoProductivo?.toString() ?? '');
  protected readonly tiempoNoProductivo = signal(this.data.existing?.tiempoNoProductivo?.toString() ?? '');

  protected readonly tiempoTotal = computed(() => {
    const totalFromActivities = this.actividades()
      .reduce((sum, a) => sum + (a.horas ?? 0), 0);
    return Math.round(totalFromActivities * 100) / 100;
  });

  // ── Observations ──
  protected readonly observaciones = signal(this.data.existing?.observaciones ?? '');

  // ── Signatures ──
  protected readonly nombreSupervisor = signal(this.data.existing?.nombreSupervisor ?? this.data.supervisor);
  protected readonly nombreCliente = signal(this.data.existing?.nombreCliente ?? '');
  protected readonly ciSupervisor = signal(this.data.existing?.ciSupervisor ?? '');
  protected readonly ciCliente = signal(this.data.existing?.ciCliente ?? '');

  // ── File upload ──
  protected readonly uploadState = signal<'idle' | 'uploaded'>('idle');
  protected readonly uploadFileName = signal('');
  protected readonly uploadedFileData = signal<string | null>(this.data.existing?.archivoAdjunto ?? null);

  protected onFileSelected(file: NzUploadFile): void {
    this.uploadFileName.set(file.name ?? '');
    this.uploadedFileData.set(file.name ?? null);
    this.uploadState.set('uploaded');
    // Auto-fill fields from uploaded document (simulated)
    if (!this.numero()) {
      this.numero.set(`RAO-${this.data.ticketCode.replace('PUMP-', '')}`);
    }
  }

  // ── Validation ──
  protected readonly canSave = computed(() => {
    const acts = this.actividades();
    const hasAtLeastOneActivity = acts.some(a => a.detalle.trim() !== '');
    return this.fecha() !== null && this.cliente() !== '' && hasAtLeastOneActivity;
  });

  // ── Actions ──
  protected save(): void {
    const fecha = this.fecha();
    if (!fecha) return;
    const report: DailyActivityReport = {
      fecha: toLocalDateString(fecha),
      numero: this.numero(),
      cliente: this.cliente(),
      ordenContrato: this.ordenContrato(),
      pozo: this.pozo(),
      representanteCliente: this.representanteCliente(),
      campoBloque: this.campoBloque(),
      cargo: this.cargo(),
      taladro: this.taladro(),
      actividades: this.actividades().filter(a => a.detalle.trim() !== ''),
      tiempoProductivo: Number(this.tiempoProductivo()) || null,
      tiempoNoProductivo: Number(this.tiempoNoProductivo()) || null,
      tiempoTotal: this.tiempoTotal(),
      observaciones: this.observaciones(),
      nombreSupervisor: this.nombreSupervisor(),
      nombreCliente: this.nombreCliente(),
      firmaSupervisor: this.nombreSupervisor(),
      firmaCliente: this.nombreCliente(),
      ciSupervisor: this.ciSupervisor(),
      ciCliente: this.ciCliente(),
      archivoAdjunto: this.uploadedFileData(),
    };
    this.modalRef.close({ saved: true, report });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
