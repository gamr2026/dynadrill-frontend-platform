import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DynadrillDialogService, DynadrillIconComponent } from '@digitec-it-projects/dynadrill-ui';
import { SidebarStateService } from '../sidebar-state.service';
import { ReportarDialog } from '../../features/qhse/shared/components/reportar-dialog';

/**
 * Barra de navegación inferior — solo móvil (<840px), ver shell.scss. Tres
 * destinos fijos (Figma Nav/BottomNav): Inicio, Módulos (abre el drawer con
 * el menú completo del rol) y Reportar (acceso rápido universal).
 */
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
})
export class BottomNav {
  private readonly dialogService = inject(DynadrillDialogService);
  protected readonly sidebarState = inject(SidebarStateService);

  protected openReportar(): void {
    this.sidebarState.close();
    this.dialogService.open<ReportarDialog>({ title: 'Reportar', content: ReportarDialog, size: 'small', footer: false });
  }
}
