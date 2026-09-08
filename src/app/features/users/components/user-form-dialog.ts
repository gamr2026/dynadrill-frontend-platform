import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { OperatorSpecialty, Role } from '../models/user.model';
import { RolesService, UsersService } from '../services/users.service';

export interface UserFormDialogData {
  userId?: number;
}

const OPERATOR_ROLE_NAME = 'Operador de Mantenimiento';
const SPECIALTY_OPTIONS: DynadrillSelectOption[] = [
  { label: 'Mecánico', value: 'Mecánico' },
  { label: 'Instrumental', value: 'Instrumental' },
];

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
    DynadrillDatetimePickerComponent,
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
  protected readonly specialtyOptions = SPECIALTY_OPTIONS;
  protected readonly selectedRoleId = signal<number | null>(null);
  /** Solo "Operador de Mantenimiento" necesita especialidad — decide a qué tipo de sub-orden puede asignarse. */
  protected readonly isOperatorRole = computed(
    () => this.roles().find(r => r.id === this.selectedRoleId())?.name === OPERATOR_ROLE_NAME,
  );

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    username: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    cedula: [''],
    phone: [''],
    roleId: this.fb.control<number | null>(null, [Validators.required]),
    specialty: this.fb.control<OperatorSpecialty | null>(null),
    status: [true],
    // ── Datos de RRHH (campos_empleado.xlsx) — todos opcionales ──
    cargo: [''],
    departamento: [''],
    tipoContrato: [''],
    sucursal: [''],
    categoria: [''],
    centroCosto: [''],
    cargasActivas: this.fb.control<number | null>(null),
    empleadoActivo: [true],
  });

  /** Fuera del form group, mismo patrón que investigacion-dialog.ts: dynadrill-datetime-picker trabaja con Date, no con el string ISO que guarda el modelo. */
  protected readonly fechaIngreso = signal<Date | null>(null);

  constructor() {
    if (!this.isEditMode) {
      this.form.controls.password.addValidators([Validators.required, Validators.minLength(8)]);
    }

    this.rolesService.list().subscribe(roles => this.roles.set(roles));

    // `isOperatorRole` depende de `roles()` y `selectedRoleId()`, poblados por dos peticiones HTTP
    // independientes sin orden garantizado. Antes este chequeo era un `if` de una sola vez justo
    // después de cargar el usuario (línea ~126 antigua): si `roles()` aún no había llegado en ese
    // instante, el validator de "especialidad" nunca se agregaba, aunque `isOperatorRole()` pasara
    // a `true` después — un `effect()` lo re-evalúa cada vez que cualquiera de las dos cambia.
    effect(() => {
      const specialty = this.form.controls.specialty;
      if (this.isOperatorRole()) {
        if (!specialty.hasValidator(Validators.required)) {
          specialty.addValidators([Validators.required]);
          specialty.updateValueAndValidity();
        }
      } else if (specialty.hasValidator(Validators.required)) {
        specialty.removeValidators([Validators.required]);
        specialty.updateValueAndValidity();
      }
    });

    if (this.isEditMode) {
      this.usersService.get(this.data.userId!).subscribe({
        next: user => {
          this.form.patchValue({
            name: user.name,
            username: user.username,
            email: user.email,
            cedula: user.cedula ?? '',
            phone: user.phone,
            roleId: user.roleId,
            specialty: user.specialty ?? null,
            status: user.status,
            cargo: user.cargo ?? '',
            departamento: user.departamento ?? '',
            tipoContrato: user.tipoContrato ?? '',
            sucursal: user.sucursal ?? '',
            categoria: user.categoria ?? '',
            centroCosto: user.centroCosto ?? '',
            cargasActivas: user.cargasActivas ?? null,
            empleadoActivo: user.empleadoActivo ?? true,
          });
          this.fechaIngreso.set(user.fechaIngreso ? new Date(user.fechaIngreso) : null);
          this.selectedRoleId.set(user.roleId);
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

  updateField(
    field: 'name' | 'username' | 'email' | 'password' | 'cedula' | 'phone' | 'cargo' | 'departamento' | 'tipoContrato' | 'sucursal' | 'categoria' | 'centroCosto',
    value: string,
  ): void {
    this.form.controls[field].setValue(value);
  }

  updateCargasActivas(value: string): void {
    const n = Number(value);
    this.form.controls.cargasActivas.setValue(value.trim() === '' || Number.isNaN(n) ? null : n);
  }

  updateEmpleadoActivo(checked: boolean): void {
    this.form.controls.empleadoActivo.setValue(checked);
  }

  updateRole(value: unknown): void {
    const roleId = typeof value === 'number' ? value : null;
    this.form.controls.roleId.setValue(roleId);
    this.selectedRoleId.set(roleId);
    // El validator required/no-required lo maneja el effect() de arriba, reactivo a isOperatorRole().
    // Aquí solo se limpia el valor si deja de aplicar, para no dejar una especialidad obsoleta.
    if (!this.isOperatorRole()) {
      this.form.controls.specialty.setValue(null);
    }
  }

  updateSpecialty(value: unknown): void {
    this.form.controls.specialty.setValue(value === 'Mecánico' || value === 'Instrumental' ? value : null);
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
    const { password, cargasActivas, ...rest } = this.form.getRawValue();
    const roleId = rest.roleId as number;
    const specialty = rest.specialty ?? undefined;
    const fechaIngreso = this.fechaIngreso()?.toISOString();

    const request$ = this.isEditMode
      ? this.usersService.update(this.data.userId!, {
          ...rest,
          roleId,
          specialty,
          cargasActivas: cargasActivas ?? undefined,
          fechaIngreso,
          ...(password ? { password } : {}),
        })
      : this.usersService.create({ ...rest, roleId, specialty, cargasActivas: cargasActivas ?? undefined, fechaIngreso, password });

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
