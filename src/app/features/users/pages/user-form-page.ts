import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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

@Component({
  selector: 'app-user-form-page',
  imports: [
    ReactiveFormsModule,
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillCheckboxComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form-page.html',
  styleUrl: './user-form-page.scss',
})
export class UserFormPage {
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly userId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.userId !== null;

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
      this.usersService.get(Number(this.userId)).subscribe({
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
          this.router.navigate(['/dashboard/usuarios']);
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
      ? this.usersService.update(Number(this.userId), {
          ...rest,
          roleId,
          ...(password ? { password } : {}),
        })
      : this.usersService.create({ ...rest, roleId, password });

    request$.subscribe({
      next: () => {
        this.notify.success('Guardado', this.isEditMode ? 'Usuario actualizado.' : 'Usuario creado.');
        this.router.navigate(['/dashboard/usuarios']);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar el usuario.');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/dashboard/usuarios']);
  }
}
