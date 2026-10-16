import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';

/** Largo mínimo que exige el backend para la clave nueva. */
const MIN_LENGTH = 10;

const coinciden = (group: AbstractControl): ValidationErrors | null =>
  group.get('newPassword')?.value === group.get('confirm')?.value ? null : { noCoinciden: true };

/**
 * Cambio de clave obligatorio en el primer ingreso (cuenta con clave provisional). Mientras esté pendiente,
 * el guard de rutas manda aquí y el backend rechaza cualquier otra llamada.
 */
@Component({
  selector: 'app-change-password-page',
  imports: [
    ReactiveFormsModule,
    NgOptimizedImage,
    DynadrillBannerComponent,
    DynadrillInputComponent,
    DynadrillButtonComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './change-password-page.html',
  styleUrl: './login-page.scss',
})
export class ChangePasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly minLength = MIN_LENGTH;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Marca en rojo el campo de la clave actual cuando el backend la rechaza. */
  protected readonly currentInvalid = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(MIN_LENGTH)]],
      confirm: ['', [Validators.required]],
    },
    { validators: coinciden },
  );

  submit(): void {
    if (this.submitting()) return;
    const { currentPassword, newPassword } = this.form.getRawValue();
    const mensaje = this.validar(currentPassword, newPassword);
    if (mensaje) {
      this.form.markAllAsTouched();
      this.errorMessage.set(mensaje);
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.currentInvalid.set(false);

    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err: unknown) => {
        this.submitting.set(false);
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        this.currentInvalid.set(status === 401);
        this.errorMessage.set(
          status === 401
            ? 'La clave actual no es correcta.'
            : status === 400
              ? 'La clave nueva no es válida: debe ser distinta de la actual y tener al menos ' + MIN_LENGTH + ' caracteres.'
              : 'No se pudo conectar con el servidor. Inténtelo de nuevo.',
        );
      },
    });
  }

  /** Salir sin cambiar la clave: cierra la sesión provisional. */
  cancel(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  private validar(actual: string, nueva: string): string | null {
    if (!actual) return 'Escriba su clave actual (la que le entregaron).';
    if (nueva.length < MIN_LENGTH) return `La clave nueva debe tener al menos ${MIN_LENGTH} caracteres.`;
    if (this.form.errors?.['noCoinciden']) return 'La confirmación no coincide con la clave nueva.';
    if (nueva === actual) return 'La clave nueva debe ser distinta de la actual.';
    return null;
  }
}
