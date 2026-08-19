import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { Role } from '../models/user.model';
import { RolesService, UsersService } from '../services/users.service';

export interface UserFormDialogData {
  userId?: number;
}

/**
 * Contenido de DynadrillDialogService.open() — no es una pagina ruteada,
 * vive dentro del modal. userId llega via NZ_MODAL_DATA en vez de
 * ActivatedRoute; al guardar/cancelar se cierra a si mismo con
 * NzModalRef.close(), el resultado 'saved' le dice a quien lo abrio que
 * debe refrescar la lista.
 */
@Component({
  selector: 'app-user-form-dialog',
  imports: [
    ReactiveFormsModule,
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillCheckboxComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form-dialog.html',
  styleUrl: './user-form-dialog.scss',
})
export class UserFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef);
  private readonly data = inject<UserFormDialogData>(NZ_MODAL_DATA);

  protected readonly isEditMode = this.data.userId != null;

  protected readonly loading = signal(this.isEditMode);
  protected readonly submitting = signal(false);
  protected readonly roles = signal<Role[]>([]);
  protected readonly roleOptions = computed<DynadrillSelectOption[]>(() =>
    this.roles().map(role => ({ label: role.name, value: role.id })),
  );

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    username: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    code: [''],
    phone: [''],
    roleId: this.fb.control<number | null>(null, [Validators.required]),
    status: [true],
  });

  constructor() {
    if (!this.isEditMode) {
      this.form.controls.password.addValidators([Validators.required, Validators.minLength(8)]);
    }

    this.rolesService.list().subscribe(roles => this.roles.set(roles));

    if (this.isEditMode) {
      this.usersService.get(this.data.userId!).subscribe({
        next: user => {
          this.form.patchValue({
            name: user.name,
            username: user.username,
            email: user.email,
            code: user.code,
            phone: user.phone,
            roleId: user.roleId,
            status: user.status,
          });
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.notify.error('Error', 'No se pudo cargar el usuario.');
          this.modalRef.close();
        },
      });
    }
  }

  updateField(field: 'name' | 'username' | 'email' | 'password' | 'code' | 'phone', value: string): void {
    this.form.controls[field].setValue(value);
  }

  updateRole(value: unknown): void {
    this.form.controls.roleId.setValue(typeof value === 'number' ? value : null);
  }

  updateStatus(checked: boolean): void {
    this.form.controls.status.setValue(checked);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { password, ...rest } = this.form.getRawValue();
    const roleId = rest.roleId as number;

    const request$ = this.isEditMode
      ? this.usersService.update(this.data.userId!, {
          ...rest,
          roleId,
          ...(password ? { password } : {}),
        })
      : this.usersService.create({ ...rest, roleId, password });

    request$.subscribe({
      next: () => {
        this.notify.success('Guardado', this.isEditMode ? 'Usuario actualizado.' : 'Usuario creado.');
        this.modalRef.close('saved');
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar el usuario.');
      },
    });
  }

  cancel(): void {
    this.modalRef.close();
  }
}
