import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillCheckboxComponent, DynadrillDatetimePickerComponent, DynadrillInputComponent, DynadrillNotificationService, DynadrillTextareaComponent } from '@digitec-it-projects/dynadrill-ui';
import { Unidad, UpdatePatrimonioInput } from '../../maintenance/models/unidad.model';
import { UnidadesService } from '../../maintenance/services/unidades.service';

export interface VehiculoPatrimonioDialogData {
  unidad: Unidad;
}

@Component({
  selector: 'app-vehiculo-patrimonio-dialog',
  imports: [DynadrillInputComponent, DynadrillDatetimePickerComponent, DynadrillTextareaComponent, DynadrillCheckboxComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehiculo-patrimonio-dialog.html',
  styleUrl: './vehiculo-patrimonio-dialog.scss',
})
export class VehiculoPatrimonioDialog {
  private readonly unidadesService = inject(UnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<VehiculoPatrimonioDialog, Unidad | undefined>);
  private readonly data = inject<VehiculoPatrimonioDialogData>(NZ_MODAL_DATA);

  protected readonly targetUnidad = this.data.unidad;

  protected readonly placa = signal(this.data.unidad.placa ?? '');
  protected readonly marca = signal(this.data.unidad.marca ?? '');
  protected readonly modelo = signal(this.data.unidad.modelo ?? '');
  protected readonly anio = signal(this.data.unidad.anio ?? '');
  protected readonly fechaMatricula = signal<Date | null>(this.parseIso(this.data.unidad.fechaMatricula));
  protected readonly caducidadMatricula = signal<Date | null>(this.parseIso(this.data.unidad.caducidadMatricula));
  protected readonly caducidadPoliza = signal<Date | null>(this.parseIso(this.data.unidad.caducidadPoliza));
  protected readonly vigenciaOtroDocumento = signal<Date | null>(this.parseIso(this.data.unidad.vigenciaOtroDocumento));
  protected readonly responsablePatrimonial = signal(this.data.unidad.responsablePatrimonial ?? '');
  protected readonly predeterminado = signal(this.data.unidad.predeterminado ?? false);
  protected readonly activo = signal(this.data.unidad.activo ?? true);
  protected readonly notaInventario = signal(this.data.unidad.notaInventario ?? '');

  protected readonly submitting = signal(false);

  /** Parsea como medianoche LOCAL (no UTC): `new Date('2026-01-10')` es UTC y en Ecuador (UTC-5) se muestra un día antes en el date-picker. */
  private parseIso(iso: string | undefined): Date | null {
    return iso ? new Date(iso.slice(0, 10) + 'T00:00:00') : null;
  }

  protected save(): void {
    if (this.submitting()) return;
    this.submitting.set(true);

    const input: UpdatePatrimonioInput = {
      placa: this.placa().trim() || undefined,
      marca: this.marca().trim() || undefined,
      modelo: this.modelo().trim() || undefined,
      anio: this.anio().trim() || undefined,
      fechaMatricula: this.fechaMatricula()?.toISOString(),
      caducidadMatricula: this.caducidadMatricula()?.toISOString(),
      caducidadPoliza: this.caducidadPoliza()?.toISOString(),
      vigenciaOtroDocumento: this.vigenciaOtroDocumento()?.toISOString(),
      responsablePatrimonial: this.responsablePatrimonial().trim() || undefined,
      predeterminado: this.predeterminado(),
      activo: this.activo(),
      notaInventario: this.notaInventario().trim() || undefined,
    };

    this.unidadesService.updatePatrimonio(this.targetUnidad.id, input).subscribe({
      next: unidad => {
        this.notify.success('Datos guardados', `${unidad.code} actualizado.`);
        this.modalRef.close(unidad);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar los datos patrimoniales.');
      },
    });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
