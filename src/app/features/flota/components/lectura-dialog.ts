import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillNotificationService } from '@digitec-it-projects/dynadrill-ui';
import type { LecturaFlota, TipoLecturaFlota, UnidadFlota } from '../models/unidad-flota.model';
import { FlotaUnidadesService } from '../services/flota-unidades.service';
import { formatoNumero, mensajeDeError } from '../utils/flota.util';

export interface LecturaDialogData {
  unidad: UnidadFlota;
}

/** Registra a mano el horómetro (unidades de servicio) o el kilometraje (transporte). El backend rechaza una lectura menor que la anterior. */
@Component({
  selector: 'app-lectura-dialog',
  imports: [DynadrillInputComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lectura-dialog">
      <p class="lectura-dialog__actual">
        Lectura vigente: <strong>{{ vigenteTexto }}</strong>
      </p>
      <dynadrill-input [label]="etiqueta" type="number" [value]="valor()" (valueChange)="valor.set($event)" />
      <div class="lectura-dialog__actions">
        <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
        <dynadrill-button [disabled]="!puedeGuardar()" (clicked)="guardar()">
          {{ enviando() ? 'Guardando…' : 'Registrar lectura' }}
        </dynadrill-button>
      </div>
    </div>
  `,
  styles: `
    .lectura-dialog { display: flex; flex-direction: column; gap: 12px; }
    .lectura-dialog__actual { margin: 0; color: var(--text-muted, #5c5870); }
    .lectura-dialog__actions { display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border, #e5e4ea); padding-top: 16px; }
  `,
})
export class LecturaDialog {
  private readonly flota = inject(FlotaUnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<LecturaDialog, LecturaFlota | undefined>);
  private readonly unidad = inject<LecturaDialogData>(NZ_MODAL_DATA).unidad;

  protected readonly tipo: TipoLecturaFlota = this.unidad.tipo === 'servicio' ? 'horometro' : 'odometro';
  protected readonly etiqueta = this.tipo === 'horometro' ? 'Horómetro (h)' : 'Kilometraje (km)';
  private readonly sufijo = this.tipo === 'horometro' ? 'h' : 'km';
  protected readonly vigenteTexto = (() => {
    const l = this.tipo === 'horometro' ? this.unidad.horometro : this.unidad.odometro;
    return l ? `${formatoNumero(l.valor)} ${this.sufijo}` : 'sin lecturas';
  })();

  protected readonly valor = signal('');
  protected readonly enviando = signal(false);
  protected readonly puedeGuardar = computed(() => this.valor().trim() !== '' && !Number.isNaN(Number(this.valor())) && !this.enviando());

  protected guardar(): void {
    if (!this.puedeGuardar()) return;
    this.enviando.set(true);
    this.flota.registrarLectura(this.unidad.id, this.tipo, Number(this.valor())).subscribe({
      next: l => {
        this.notify.success('Lectura registrada', `${this.unidad.codigo}: ${formatoNumero(l.valor)} ${this.sufijo}.`);
        this.modalRef.close(l);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.notify.error('No se pudo registrar', mensajeDeError(e, 'No se pudo registrar la lectura.'));
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
