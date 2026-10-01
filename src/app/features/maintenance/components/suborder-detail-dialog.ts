import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { NovedadReadonlyComponent } from '../../../shared/components/novedad-readonly/novedad-readonly';
import { SubOrder } from '../models/maintenance-order.model';

export interface SuborderDetailDialogData {
  subOrder: SubOrder;
  orderCode: string;
  novedadOriginal: string;
}

/** Vista de solo lectura — no dispara ninguna acción, solo consulta el estado completo de la sub-orden. */
@Component({
  selector: 'app-suborder-detail-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [CommonModule, DynadrillTextComponent, DynadrillButtonComponent, NovedadReadonlyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suborder-detail-dialog.html',
  styleUrl: './suborder-detail-dialog.scss',
})
export class SuborderDetailDialog {
  private readonly modalRef = inject(NzModalRef);
  protected readonly data = inject<SuborderDetailDialogData>(NZ_MODAL_DATA);

  protected readonly assignmentLabel =
    this.data.subOrder.type === 'Operativo'
      ? this.data.subOrder.status === 'Derivado a Pumping'
        ? 'Derivado a Pumping'
        : 'Pendiente de derivar a Pumping'
      : (this.data.subOrder.assignedUserName ?? 'Sin asignar todavía');

  close(): void {
    this.modalRef.close();
  }
}
