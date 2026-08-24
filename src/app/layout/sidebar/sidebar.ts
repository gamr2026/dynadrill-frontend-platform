import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DynadrillButtonComponent, DynadrillIconComponent, DynadrillIconName, DynadrillMenuComponent, DynadrillMenuItem, DynadrillSpinnerComponent } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';
import { SidebarStateService } from '../sidebar-state.service';

@Component({
  selector: 'app-sidebar',
  imports: [DynadrillMenuComponent, DynadrillButtonComponent, DynadrillIconComponent, DynadrillSpinnerComponent],
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
   * flujo. Por ahora, de los tres roles de Mantenimiento, solo el Jefe ve
   * el resto de la aplicación (Administración, Operativo, QHSE) — Operador
   * de Mantenimiento y Conductor ven ÚNICAMENTE su propia pantalla: nada
   * de otros módulos, ni Administración.
   */
  protected readonly items = computed<DynadrillMenuItem[]>(() => {
    const roleName = this.auth.currentUser()?.roleName;
    const dashboard: DynadrillMenuItem = { label: 'Dashboard', icon: 'home', link: '/dashboard' };

    if (roleName === 'Operador de Mantenimiento') {
      return [dashboard, { label: 'Mis tareas', icon: 'tool' as DynadrillIconName, link: '/dashboard/mantenimiento/mis-tareas' }];
    }

    if (roleName === 'Supervisor') {
      return [
        dashboard,
        { label: 'Aprobar Inspecciones', icon: 'tool' as DynadrillIconName, link: '/dashboard/mantenimiento/inspeccion-vehiculos' },
        {
          label: 'Módulos',
          icon: 'modules',
          children: [
            {
              label: 'Operativo',
              icon: 'file-text',
              children: [
                { label: 'Pumping', link: '/modulos/operativo/pumping' },
                { label: 'FCR', link: '/modulos/operativo/fcr' },
              ],
            },
          ],
        },
      ];
    }

    const maintenance: DynadrillMenuItem[] =
      roleName === 'Jefe de Mantenimiento'
        ? [{
            label: 'Mantenimiento',
            icon: 'tool' as DynadrillIconName,
            children: [
              { label: 'Bandeja', link: '/dashboard/mantenimiento' },
              { label: 'Indicadores', link: '/dashboard/mantenimiento/kpis' },
            ],
          }]
        : [];

    return [
      dashboard,
      {
        label: 'Administración',
        icon: 'settings',
        children: [{ label: 'Usuarios', icon: 'users', link: '/dashboard/usuarios' }],
      },
      {
        label: 'Módulos',
        icon: 'modules',
        children: [
          {
            label: 'Operativo',
            icon: 'file-text',
            children: [
              { label: 'Pumping', link: '/modulos/operativo/pumping' },
              { label: 'FCR', link: '/modulos/operativo/fcr' },
            ],
          },
          ...maintenance,
          { label: 'QHSE', link: '/dashboard/qhse' },
        ],
      },
    ];
  });

  protected readonly loggingOut = signal(false);

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
