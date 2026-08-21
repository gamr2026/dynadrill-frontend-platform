import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DynadrillButtonComponent, DynadrillIconComponent } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  imports: [DynadrillButtonComponent, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
