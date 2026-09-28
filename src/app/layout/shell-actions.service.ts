import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DynadrillDialogService } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../core/services/auth.service';
import { ReportarDialog } from '../features/qhse/shared/components/reportar-dialog';
import { SidebarStateService } from './sidebar-state.service';

/** Acciones globales del shell — compartidas por el header (desktop), el drawer y la navegación inferior (móvil). */
@Injectable({ providedIn: 'root' })
export class ShellActionsService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly sidebarState = inject(SidebarStateService);

  readonly loggingOut = signal(false);

  /** Acceso rápido QHSE — cualquier usuario autenticado, sin roleGuard (ver reportar-dialog.ts). */
  openReportar(): void {
    this.sidebarState.close();
    this.dialogService.open<ReportarDialog>({ title: 'Reportar', content: ReportarDialog, size: 'small', footer: false });
  }

  /**
   * `/login` es una ruta lazy — sin este estado, el clic no daba ningún
   * feedback mientras se descargaba su chunk y se sentía "colgado".
   */
  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.auth.logout();
    await this.router.navigate(['/login']);
    this.loggingOut.set(false);
  }
}
