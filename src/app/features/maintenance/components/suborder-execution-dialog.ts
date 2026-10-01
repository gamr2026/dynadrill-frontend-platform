import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { NovedadReadonlyComponent } from '../../../shared/components/novedad-readonly/novedad-readonly';
import { Repuesto, SubOrder } from '../models/maintenance-order.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';

export interface SuborderExecutionDialogData {
  subOrder: SubOrder;
  novedadOriginal: string;
}

@Component({
  selector: 'app-suborder-execution-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    CommonModule,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
    DynadrillInputComponent,
    DynadrillButtonComponent,
    DynadrillIconComponent,
    NovedadReadonlyComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suborder-execution-dialog.html',
  styleUrl: './suborder-execution-dialog.scss',
})
export class SuborderExecutionDialog {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<SuborderExecutionDialog, boolean>);
  protected readonly data = inject<SuborderExecutionDialogData>(NZ_MODAL_DATA);

  protected readonly diagnostico = signal(this.data.subOrder.diagnostico ?? '');
  protected readonly actividadesCorrectivas = signal(this.data.subOrder.actividadesCorrectivas ?? '');
  protected readonly horasTrabajo = signal(this.data.subOrder.horasTrabajo?.toString() ?? '');
  protected readonly repuestos = signal<Repuesto[]>(this.data.subOrder.repuestos ? [...this.data.subOrder.repuestos] : []);
  protected readonly trabajosAdicionales = signal(this.data.subOrder.trabajosAdicionales ?? '');
  protected readonly submitting = signal(false);

  protected readonly wasRejected = this.data.subOrder.status === 'Corrección Solicitada';
  protected readonly isClosed = this.data.subOrder.status === 'Cerrado';

  protected readonly canSubmit = computed(() =>
    this.diagnostico().trim().length > 0 && this.actividadesCorrectivas().trim().length > 0,
  );

  addRepuesto(): void {
    this.repuestos.update(list => [...list, { numeroParte: '', cantidad: 1, descripcion: '' }]);
  }

  removeRepuesto(index: number): void {
    this.repuestos.update(list => list.filter((_, i) => i !== index));
  }

  updateRepuesto(index: number, field: keyof Repuesto, value: string): void {
    this.repuestos.update(list =>
      list.map((r, i) => {
        if (i !== index) return r;
        if (field !== 'cantidad') return { ...r, [field]: value };
        // Mientras el usuario borra el campo para reescribirlo, `Number('') || 1` lo forzaba
        // a 1 en cada tecla — conserva la cantidad anterior hasta que el nuevo valor sea válido.
        const parsed = Number(value);
        return Number.isNaN(parsed) || parsed <= 0 ? r : { ...r, cantidad: parsed };
      }),
    );
  }

  private buildInput() {
    return {
      diagnostico: this.diagnostico(),
      actividadesCorrectivas: this.actividadesCorrectivas(),
      horasTrabajo: this.horasTrabajo() ? Number(this.horasTrabajo()) : undefined,
      repuestos: this.repuestos().filter(r => r.descripcion.trim()),
      trabajosAdicionales: this.trabajosAdicionales().trim() || undefined,
    };
  }

  save(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.ordersService.updateSubOrder(this.data.subOrder.id, this.buildInput()).subscribe({
      next: () => {
        this.notify.success(
          this.isClosed ? 'Cambios guardados' : 'Avance guardado',
          this.isClosed ? `${this.data.subOrder.code} corregida.` : `${this.data.subOrder.code} en ejecución.`,
        );
        this.modalRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar.');
      },
    });
  }

  submitForReview(): void {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.ordersService.updateSubOrder(this.data.subOrder.id, this.buildInput()).subscribe({
      next: () => {
        this.ordersService.submitSubOrderForReview(this.data.subOrder.id).subscribe({
          next: () => {
            this.notify.success('Enviado a revisión', `${this.data.subOrder.code} lista para revisión de cierre.`);
            this.modalRef.close(true);
          },
          error: () => {
            this.submitting.set(false);
            this.notify.error('Error', 'No se pudo enviar a revisión.');
          },
        });
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar.');
      },
    });
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
