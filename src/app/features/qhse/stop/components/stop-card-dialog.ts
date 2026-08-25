import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  DynadrillUploadZoneComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { CreateStopCardInput, STOP_CATEGORIAS, STOP_TIPO_LABELS, StopCard, StopCategoria, StopTipo } from '../models/stop-card.model';
import { StopCardService } from '../services/stop-card.service';

/**
 * "Cualquier Trabajador... tiene autoridad y obligación de observar"
 * (HSE-SEGUIMIENTO-002) — este diálogo se abre tanto desde la bandeja de
 * STOP (staff HSE) como desde "Reportar" en el header (cualquier usuario
 * autenticado), sin pasar por el roleGuard de QHSE.
 */
@Component({
  selector: 'app-stop-card-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillChipGroupComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillUploadZoneComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stop-card-dialog.html',
  styleUrl: './stop-card-dialog.scss',
})
export class StopCardDialog {
  private readonly stopService = inject(StopCardService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<StopCardDialog, StopCard | undefined>);

  protected readonly tipoOptions = Object.values(STOP_TIPO_LABELS);
  protected readonly categoriaOptions = [...STOP_CATEGORIAS];

  protected readonly tipoLabel = signal<string[]>([STOP_TIPO_LABELS.condicion_insegura]);
  protected readonly categorias = signal<string[]>([]);
  protected readonly descripcion = signal('');
  protected readonly riesgoPotencial = signal('');
  protected readonly accionCorrectivaInmediata = signal('');
  protected readonly observadorNombre = signal(this.auth.currentUser()?.name ?? '');
  protected readonly observadoNombre = signal('');
  protected readonly ubicacion = signal('');
  protected readonly fotoFileName = signal('');
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(
    () => this.categorias().length > 0 && this.descripcion().trim().length > 0 && this.riesgoPotencial().trim().length > 0,
  );

  protected marcarAnonimo(): void {
    this.observadoNombre.set('Anónimo');
  }

  protected onFotoUpload(file: NzUploadFile): void {
    this.fotoFileName.set(file.name ?? 'foto.jpg');
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const tipo: StopTipo = this.tipoLabel()[0] === STOP_TIPO_LABELS.acto_inseguro ? 'acto_inseguro' : 'condicion_insegura';
    const input: CreateStopCardInput = {
      tipo,
      categorias: this.categorias() as StopCategoria[],
      descripcion: this.descripcion(),
      riesgoPotencial: this.riesgoPotencial(),
      accionCorrectivaInmediata: this.accionCorrectivaInmediata(),
      observadorNombre: this.observadorNombre(),
      observadoNombre: this.observadoNombre() || undefined,
      ubicacion: this.ubicacion() || undefined,
      fotoFileName: this.fotoFileName() || undefined,
    };

    this.stopService.create(input).subscribe({
      next: card => {
        this.notify.success('Registrada', `Tarjeta STOP ${card.code} registrada.`);
        this.modalRef.close(card);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar la tarjeta STOP.');
      },
    });
  }
}
