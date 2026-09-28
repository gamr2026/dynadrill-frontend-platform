import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { DynadrillButtonComponent, DynadrillDialogService, DynadrillIconComponent, DynadrillNotificationBellComponent, DynadrillSpinnerComponent, type DynadrillNotificationItem } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService, AppNotificationItem } from '../../core/services/notifications.service';
import { SidebarStateService } from '../sidebar-state.service';
import { DetailHeaderService } from '../detail-header.service';
import { ReportarDialog } from '../../features/qhse/shared/components/reportar-dialog';

@Component({
  selector: 'app-header',
  imports: [DynadrillButtonComponent, DynadrillIconComponent, DynadrillNotificationBellComponent, DynadrillSpinnerComponent, NzDropDownModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly notifications = inject(NotificationsService);
  private readonly dialogService = inject(DynadrillDialogService);
  protected readonly sidebarState = inject(SidebarStateService);
  /** Barra "Detail" (Figma Nav/TopAppBar) — solo móvil; ver detail-header.service.ts. */
  protected readonly detail = inject(DetailHeaderService);

  protected goBack(): void {
    const backLink = this.detail.config()?.backLink;
    if (backLink) this.router.navigateByUrl(backLink);
    else this.location.back();
  }

  /** Acceso rápido QHSE — cualquier usuario autenticado, sin roleGuard (ver reportar-dialog.ts). */
  protected openReportar(): void {
    this.dialogService.open<ReportarDialog>({ title: 'Reportar', content: ReportarDialog, size: 'small', footer: false });
  }

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
