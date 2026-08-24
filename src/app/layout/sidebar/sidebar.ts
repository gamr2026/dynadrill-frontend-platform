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

    if (roleName === 'Conductor') {
      return [dashboard, { label: 'Inspección de Vehículos', icon: 'tool' as DynadrillIconName, link: '/dashboard/mantenimiento/inspeccion-vehiculos' }];
    }

    if (roleName === 'Supervisor') {
      /**
       * HSE-SITIO-001 asigna "Firmar PTW y Actas" al Supervisor Operativo
       * (a diferencia de IPERC, donde el Supervisor solo participa de
       * forma informativa) — por eso entra a Recibimiento de Sitio pero no
       * a Matrices IPERC.
       */
      return [
        dashboard,
        { label: 'Aprobar Inspecciones', icon: 'tool' as DynadrillIconName, link: '/dashboard/mantenimiento/inspeccion-vehiculos' },
        { label: 'Recibimiento de Sitio (PTW)', icon: 'alert' as DynadrillIconName, link: '/dashboard/qhse/ptw' },
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

    /**
     * A diferencia de Operativo (visible para cualquier rol "de oficina"),
     * QHSE sí se gatea por rol desde el sidebar — igual que Mantenimiento.
     * Antes era un link plano visible para todos (placeholder sin ruta
     * real); ahora que /dashboard/qhse existe de verdad y su roleGuard
     * exige uno de los tres roles HSE (HSE-MASTER-001, "Roles y
     * Responsabilidades"), mostrarlo a todos los demás roles solo los
     * llevaría a un redirect a /dashboard.
     */
    const hse: DynadrillMenuItem[] =
      roleName === 'Técnico HSE' || roleName === 'Coordinador HSE' || roleName === 'Gerente HSE'
        ? [{
            label: 'QHSE',
            icon: 'alert' as DynadrillIconName,
            children: [
              { label: 'IPERC', link: '/dashboard/qhse/iperc' },
              { label: 'Recibimiento de Sitio (PTW)', link: '/dashboard/qhse/ptw' },
              { label: 'Inspecciones de campo', link: '/dashboard/qhse/inspecciones' },
              { label: 'Tarjetas STOP', link: '/dashboard/qhse/stop' },
              { label: 'Stop Work Authority', link: '/dashboard/qhse/swa' },
              { label: 'Gestión de Desechos', link: '/dashboard/qhse/desechos' },
              { label: 'Control de Derrames', link: '/dashboard/qhse/derrames' },
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
              { label: 'Pumping', link: '/operaciones/pumping' },
              { label: 'FCR', link: '/operaciones/fcr' },
            ],
          },
          ...maintenance,
          ...hse,
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
