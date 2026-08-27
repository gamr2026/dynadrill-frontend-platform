import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { CreateInvestigacionInput, IncidenteResultado, INCIDENTE_RESULTADO_LABELS, Investigacion } from '../models/investigacion.model';
import { InvestigacionService } from '../services/investigacion.service';

/**
 * HSE-TRIAGE-002: "puede abrirse directo por daño material significativo o
 * Near Miss con alto potencial, sin haber pasado por una emergencia
 * formal" — hasta ahora esa vía no estaba construida, la única forma de
 * crear una Investigacion era abrirInvestigacion() en Emergencia Nivel
 * 2/3 (emergencia-detail-page.ts). Este diálogo cubre el caso directo,
 * abierto por el staff HSE desde la bandeja — `origenEmergenciaId` queda
 * sin definir, igual que hace el mock cuando no viene en el input.
 */
@Component({
  selector: 'app-investigacion-dialog',
  imports: [DynadrillSelectComponent, DynadrillTextareaComponent, DynadrillInputComponent, DynadrillDatetimePickerComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './investigacion-dialog.html',
  styleUrl: './investigacion-dialog.scss',
})
export class InvestigacionDialog {
  private readonly investigacionService = inject(InvestigacionService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<InvestigacionDialog, Investigacion | undefined>);

  protected readonly resultadoOptions: DynadrillSelectOption[] = Object.entries(INCIDENTE_RESULTADO_LABELS).map(([value, label]) => ({
    label,
    value,
  }));

  protected readonly resultado = signal<IncidenteResultado | null>(null);
  protected readonly descripcionEvento = signal('');
  protected readonly fechaIncidente = signal<Date | null>(new Date());
  protected readonly ubicacion = signal('');
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(
    () => this.resultado() !== null && this.descripcionEvento().trim().length > 0 && this.fechaIncidente() !== null && this.ubicacion().trim().length > 0,
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateInvestigacionInput = {
      resultado: this.resultado()!,
      descripcionEvento: this.descripcionEvento().trim(),
      fechaIncidente: this.fechaIncidente()!.toISOString(),
      ubicacion: this.ubicacion().trim(),
    };

    this.investigacionService.abrir(input).subscribe({
      next: inv => {
        this.notify.success('Investigación abierta', `Investigación ${inv.code} abierta.`);
        this.modalRef.close(inv);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo abrir la investigación.');
      },
    });
  }
}
