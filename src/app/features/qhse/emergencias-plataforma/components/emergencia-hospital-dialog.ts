import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import type { Hospital } from '../models/emergencia';
import { EmergenciaService } from '../services/emergencia.service';

/** Agrega un hospital al catálogo al que se evacúa (el equipo HSE lo amplía; no se repite por nombre y ciudad). */
@Component({
  selector: 'app-emergencia-hospital-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillButtonComponent, DynadrillInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eh">
      <dynadrill-input
        label="Nombre del hospital"
        [value]="nombre()"
        (valueChange)="nombre.set($event)"
      />
      <dynadrill-input label="Ciudad" [value]="ciudad()" (valueChange)="ciudad.set($event)" />
      <dynadrill-input
        label="Teléfono (opcional)"
        [value]="telefono()"
        (valueChange)="telefono.set($event)"
      />
    </div>
    <footer class="eh__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!puedeGuardar() || enviando()" (clicked)="guardar()">{{
        enviando() ? 'Guardando…' : 'Agregar hospital'
      }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .eh {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .eh__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border, #e5e4ea);
    }
  `,
})
export class EmergenciaHospitalDialog {
  private readonly servicio = inject(EmergenciaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<EmergenciaHospitalDialog, Hospital | undefined>);

  protected readonly nombre = signal('');
  protected readonly ciudad = signal('');
  protected readonly telefono = signal('');
  protected readonly enviando = signal(false);
  protected readonly puedeGuardar = computed(
    () => this.nombre().trim().length > 0 && this.ciudad().trim().length > 0,
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.enviando()) return;
    this.enviando.set(true);
    const telefono = this.telefono().trim();
    this.servicio
      .agregarHospital({
        nombre: this.nombre().trim(),
        ciudad: this.ciudad().trim(),
        ...(telefono ? { telefono } : {}),
      })
      .subscribe({
        next: (h) => {
          this.notify.success(
            'Hospital agregado',
            `${h.nombre} · ${h.ciudad} ya está en el catálogo.`,
          );
          this.modalRef.close(h);
        },
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo agregar',
            mensajeDeError(err, 'No se pudo agregar el hospital.'),
          );
        },
      });
  }
}
