import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { DynadrillButtonComponent, DynadrillIconComponent, DynadrillNotificationBellComponent, DynadrillSpinnerComponent, type DynadrillNotificationItem } from '@digitec-it-projects/dynadrill-ui';
import { NotificationsService, AppNotificationItem } from '../../core/services/notifications.service';
import { PageChromeService } from '../page-chrome.service';
import { ShellActionsService } from '../shell-actions.service';
import { SidebarStateService } from '../sidebar-state.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, NzDropDownModule, DynadrillButtonComponent, DynadrillIconComponent, DynadrillNotificationBellComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly notifications = inject(NotificationsService);
  protected readonly sidebarState = inject(SidebarStateService);
  protected readonly actions = inject(ShellActionsService);
  /** En móvil, una pantalla de detalle reemplaza hamburguesa + logo por "← título". */
  protected readonly detail = inject(PageChromeService).detail;

  /** Sin `backLink`, la flecha "atrás" vuelve en el historial del navegador. */
  protected goBack(): void {
    this.location.back();
  }

  protected readonly notificationItems = this.notifications.items;

  onNotificationClick(item: DynadrillNotificationItem): void {
    const link = (item as AppNotificationItem).link;
    if (link) this.router.navigateByUrl(link);
  }
}
