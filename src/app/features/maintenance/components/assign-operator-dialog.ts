import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { SubOrder } from '../models/maintenance-order.model';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { RolesService, UsersService } from '../../users/services/users.service';
import { AuthService } from '../../../core/services/auth.service';

export interface AssignOperatorDialogData {
  subOrder: SubOrder;
}

const OPERATOR_ROLE_NAME = 'Operador de Mantenimiento';

/** El Jefe de Mantenimiento asigna un Operador de Mantenimiento a una sub-orden Mecánico/Instrumental. */
@Component({
  selector: 'app-assign-operator-dialog',
  imports: [DynadrillTextComponent, DynadrillSelectComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assign-operator-dialog.html',
  styleUrl: './assign-operator-dialog.scss',
})
export class AssignOperatorDialog {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<AssignOperatorDialog, boolean>);
  protected readonly data = inject<AssignOperatorDialogData>(NZ_MODAL_DATA);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly selectedUserId = signal<number | null>(this.data.subOrder.assignedUserId ?? null);
  protected readonly operatorOptions = signal<DynadrillSelectOption[]>([]);
  private readonly operatorNames = new Map<number, string>();

  protected readonly canConfirm = computed(() => this.selectedUserId() != null);

  constructor() {
    this.rolesService.list().subscribe(roles => {
      const operatorRole = roles.find(r => r.name === OPERATOR_ROLE_NAME);
      this.usersService.list().subscribe(users => {
        const operators = users.filter(
          u => u.status && u.roleId === operatorRole?.id && u.specialty === this.data.subOrder.type,
        );
        operators.forEach(u => this.operatorNames.set(u.id, u.name));
        this.operatorOptions.set(operators.map(u => ({ label: u.name, value: u.id })));
        this.loading.set(false);
      });
    });
  }

  selectUser(value: unknown): void {
    this.selectedUserId.set(typeof value === 'number' ? value : null);
  }

  confirm(): void {
    if (!this.canConfirm() || this.submitting()) return;
    const userId = this.selectedUserId()!;
    const userName = this.operatorNames.get(userId) ?? '';
    this.submitting.set(true);
    const assignedByName = this.auth.currentUser()?.name ?? '';
    this.ordersService.assignOperator(this.data.subOrder.id, userId, userName, assignedByName).subscribe({
      next: () => {
        this.notify.success('Operador asignado', `${this.data.subOrder.code} → ${userName}.`);
        this.modalRef.close(true);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo asignar el operador.');
      },
    });
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
