import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DynadrillMenuComponent, DynadrillMenuItem } from '@digitec-it-projects/dynadrill-ui';

@Component({
  selector: 'app-sidebar',
  imports: [DynadrillMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly items: DynadrillMenuItem[] = [
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
            { label: 'Pumping', link: '/dashboard/operativo/pumping' },
            { label: 'FCR', link: '/dashboard/operativo/fcr' },
          ],
        },
        { label: 'Mantenimiento', link: '/dashboard/mantenimiento' },
        { label: 'QHSE', link: '/dashboard/qhse' },
      ],
    },
  ];
}
