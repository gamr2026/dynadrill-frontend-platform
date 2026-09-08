import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { DynadrillButtonComponent, DynadrillInputComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, DynadrillInputComponent, DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err: unknown) => {
        this.submitting.set(false);
        const isAuthError = err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403);
        this.errorMessage.set(
          isAuthError ? 'Correo o contraseña incorrectos.' : 'No se pudo conectar con el servidor. Inténtalo de nuevo.',
        );
      },
    });
  }
}
