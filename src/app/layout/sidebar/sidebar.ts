import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DynadrillButtonComponent, DynadrillIconComponent, DynadrillMenuComponent, DynadrillMenuItem } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';
import { SidebarStateService } from '../sidebar-state.service';

@Component({
  selector: 'app-sidebar',
  imports: [DynadrillMenuComponent, DynadrillButtonComponent, DynadrillIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly sidebarState = inject(SidebarStateService);

  /**
   * El módulo de Mantenimiento solo aparece para quien tiene un rol de ese
   * flujo, y cada uno apunta a su propia vista (Jefe: bandeja completa;
   * Operador: solo sus tareas asignadas) — antes cualquier usuario logueado
   * veía la bandeja completa, que era justo la confusión reportada.
   */
  protected readonly items = computed<DynadrillMenuItem[]>(() => {
    const roleName = this.auth.currentUser()?.roleName;
    const maintenanceLink =
      roleName === 'Jefe de Mantenimiento'
        ? { label: 'Mantenimiento', link: '/dashboard/mantenimiento' }
        : roleName === 'Operador de Mantenimiento'
          ? { label: 'Mantenimiento', link: '/dashboard/mantenimiento/mis-tareas' }
          : null;

    return [
      { label: 'Dashboard', icon: 'home', link: '/dashboard' },
      {
        label: 'Administración',
        icon: 'settings',
        children: [{ label: 'Usuarios', icon: 'users', link: '/dashboard/usuarios' }],
      },
      {
        label: 'Módulos',
        children: [
          {
            label: 'Operativo',
            children: [
              { label: 'Pumping', link: '/operaciones/pumping' },
              { label: 'FCR', link: '/operaciones/fcr' },
            ],
          },
          ...(maintenanceLink ? [maintenanceLink] : []),
          { label: 'QHSE', link: '/dashboard/qhse' },
        ],
      },
    ];
  });

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
