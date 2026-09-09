import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { CreateIpercMatrixInput, IpercMatrix } from '../models/iperc.model';
import { IpercService } from '../services/iperc.service';
import { CatalogosService } from '../../../../shared/index';

/** HSE-PLAN-001 Fase 1 — "Conformar equipo evaluador multidisciplinario" + "desglosar actividad". El desglose en tareas se hace después, dentro del detalle. */
@Component({
  selector: 'app-iperc-matrix-dialog',
  imports: [DynadrillInputComponent, DynadrillTextareaComponent, DynadrillSelectComponent, DynadrillButtonComponent, DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iperc-matrix-dialog.html',
  styleUrl: './iperc-matrix-dialog.scss',
})
export class IpercMatrixDialog {
  private readonly ipercService = inject(IpercService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly catalogos = inject(CatalogosService);
  private readonly modalRef = inject(NzModalRef<IpercMatrixDialog, IpercMatrix | undefined>);

  protected readonly actividad = signal('');
  protected readonly ubicacionOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly ubicacion = signal('');
  protected readonly nuevoIntegrante = signal('');
  protected readonly equipoEvaluador = signal<string[]>([]);
  protected readonly submitting = signal(false);

  constructor() {
    this.catalogos.pozos().subscribe(pozos =>
      this.ubicacionOptions.set(pozos.map(p => ({ label: p.nombreCompleto, value: p.nombreCompleto }))),
    );
  }

  protected readonly puedeGuardar = computed(
    () => this.actividad().trim().length > 0 && this.ubicacion().trim().length > 0 && this.equipoEvaluador().length > 0,
  );

  protected agregarUbicacion(nombre: string): void {
    const value = nombre.trim();
    if (!value) return;
    if (!this.ubicacionOptions().some(o => o.value === value)) {
      this.ubicacionOptions.update(opts => [...opts, { label: value, value }]);
    }
    this.ubicacion.set(value);
  }

  protected agregarIntegrante(): void {
    const nombre = this.nuevoIntegrante().trim();
    if (!nombre || this.equipoEvaluador().includes(nombre)) return;
    this.equipoEvaluador.update(equipo => [...equipo, nombre]);
    this.nuevoIntegrante.set('');
  }

  protected quitarIntegrante(nombre: string): void {
    this.equipoEvaluador.update(equipo => equipo.filter(n => n !== nombre));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const input: CreateIpercMatrixInput = {
      actividad: this.actividad().trim(),
      ubicacion: this.ubicacion(),
      equipoEvaluador: this.equipoEvaluador(),
    };

    this.ipercService.create(input).subscribe({
      next: matrix => {
        this.notify.success('Matriz creada', `${matrix.code} creada en Borrador — ahora desglosa la actividad en tareas.`);
        this.modalRef.close(matrix);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo crear la matriz IPERC.');
      },
    });
  }
}
