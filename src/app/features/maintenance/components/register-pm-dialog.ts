import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  DynadrillUploadZoneComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AlertaPreventiva, AlertaPreventivaNivel } from '../models/unidad.model';
import { RegistrarPMInput, UnidadesService } from '../services/unidades.service';
import { AuthService } from '../../../core/services/auth.service';

const EJECUTADO_POR_OPTIONS: DynadrillSelectOption[] = [
  { label: 'Interno (Dynadrill)', value: 'Interno' },
  { label: 'Tercero', value: 'Tercero' },
];

export interface RegisterPMDialogData {
  alerta: AlertaPreventiva;
}

const NIVEL_VARIANT: Record<AlertaPreventivaNivel, DynadrillTagVariant> = {
  rojo: 'error', amarillo: 'warning', verde: 'success',
};
const NIVEL_LABEL: Record<AlertaPreventivaNivel, string> = {
  rojo: 'Vencido', amarillo: 'Próximo', verde: 'Al día',
};

@Component({
  selector: 'app-register-pm-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
    DynadrillTagComponent,
    DynadrillSelectComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register-pm-dialog.html',
  styleUrl: './register-pm-dialog.scss',
})
export class RegisterPMDialog {
  protected readonly data = inject<RegisterPMDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<RegisterPMDialog, boolean>);
  private readonly unidadesService = inject(UnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly alerta = this.data.alerta;
  protected readonly nivelVariant = NIVEL_VARIANT;
  protected readonly nivelLabel = NIVEL_LABEL;
  protected readonly ejecutadoPorOptions = EJECUTADO_POR_OPTIONS;

  /**
   * Por el Plan de Mantenimiento 2026: las unidades de Servicio se
   * mantienen siempre internas (Dynadrill); solo camiones/camionetas
   * (Transporte) y equipos auxiliares se derivan a terceros. `tipoServicio`
   * solo se llena en alertas de Servicio (ver calcularAlertas).
   */
  protected readonly permiteTercero = computed(() => !this.alerta.tipoServicio);

  protected readonly valorMetrica = signal(String(this.alerta.valorActual ?? ''));
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly responsable = signal(this.auth.currentUser()?.name ?? '');
  protected readonly observaciones = signal('');
  /**
   * Reemplaza la casilla simple de antes: el checklist de fábrica (propio
   * de cada marca de unidad) se adjunta como documento. Obligatorio
   * siempre — tanto si el mantenimiento lo ejecuta Dynadrill (Interno)
   * como si lo ejecuta un Tercero, el checklist es aparte del informe que
   * entrega el proveedor (informeExterno), no lo reemplaza.
   */
  protected readonly checklistFabricante = signal<NzUploadFile | null>(null);
  protected readonly ejecutadoPor = signal<'Interno' | 'Tercero'>('Interno');
  protected readonly proveedor = signal('');
  protected readonly informeExterno = signal<NzUploadFile | null>(null);
  protected readonly submitting = signal(false);

  protected readonly canConfirm = computed(() => {
    if (this.alerta.unidad === 'horas' && !this.valorMetrica().trim()) return false;
    if (this.alerta.unidad === 'km' && !this.valorMetrica().trim()) return false;
    if (this.ejecutadoPor() === 'Tercero' && !this.proveedor().trim()) return false;
    if (!this.checklistFabricante()) return false;
    return this.fecha() !== null && !!this.responsable().trim();
  });

  onInformeSeleccionado(file: NzUploadFile): void {
    this.informeExterno.set(file);
  }

  onChecklistFabricanteSeleccionado(file: NzUploadFile): void {
    this.checklistFabricante.set(file);
  }

  confirm(): void {
    if (!this.canConfirm() || this.submitting()) return;
    this.submitting.set(true);

    const input: RegistrarPMInput = {
      fecha: this.fecha()!.toISOString().slice(0, 10),
      responsable: this.responsable().trim(),
      observaciones: this.observaciones().trim() || undefined,
      checklistFabricanteArchivo: this.checklistFabricante()?.name,
      ejecutadoPor: this.permiteTercero() ? this.ejecutadoPor() : 'Interno',
      proveedor: this.permiteTercero() && this.ejecutadoPor() === 'Tercero' ? this.proveedor().trim() : undefined,
    };

    if (this.alerta.unidad === 'horas') {
      input.horometroAlMomento = Number(this.valorMetrica());
      input.tipoServicio = this.alerta.tipoServicio;
    } else if (this.alerta.unidad === 'km') {
      input.kmAlMomento = Number(this.valorMetrica());
    }

    this.unidadesService.registrarMantenimiento(this.alerta.unidadId, input).subscribe({
      next: () => {
        this.notify.success('PM registrado', `Mantenimiento de ${this.alerta.unidadCode} registrado correctamente.`);
        this.modalRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar el mantenimiento.');
      },
    });
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
