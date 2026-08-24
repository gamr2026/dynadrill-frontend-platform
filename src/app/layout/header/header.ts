import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DynadrillButtonComponent, DynadrillIconComponent, DynadrillNotificationBellComponent, DynadrillSpinnerComponent, type DynadrillNotificationItem } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService, AppNotificationItem } from '../../core/services/notifications.service';
import { SidebarStateService } from '../sidebar-state.service';

@Component({
  selector: 'app-header',
  imports: [DynadrillButtonComponent, DynadrillIconComponent, DynadrillNotificationBellComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationsService);
  protected readonly sidebarState = inject(SidebarStateService);

  protected readonly notificationItems = this.notifications.items;

  onNotificationClick(item: DynadrillNotificationItem): void {
    const link = (item as AppNotificationItem).link;
    if (link) this.router.navigateByUrl(link);
  }

  protected readonly loggingOut = signal(false);

  /**
   * `/login` es una ruta lazy — sin este estado, el clic no daba ningún
   * feedback mientras se descargaba su chunk y se sentía "colgado".
   */
  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
