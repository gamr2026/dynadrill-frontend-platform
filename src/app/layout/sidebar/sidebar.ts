import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DynadrillIconName, DynadrillMenuComponent, DynadrillMenuItem } from '@digitec-it-projects/dynadrill-ui';
import { NavEntry, NavIcon } from '../navigation/nav.model';
import { NavigationService } from '../navigation/navigation.service';

/** `dynadrill-icon` no trae todo el set de la navegación — el más cercano disponible. */
const MENU_ICON: Record<NavIcon, DynadrillIconName> = {
  home: 'home',
  modules: 'modules',
  tool: 'tool',
  shield: 'alert',
  box: 'box',
  'file-text': 'file-text',
  users: 'users',
  alert: 'alert',
  gauge: 'clock',
  check: 'check',
  list: 'file-text',
  route: 'location',
  chart: 'file-text',
  truck: 'box',
};

/** Sub-ítems sin ícono — igual que Nav/SidebarSubItem en Figma. */
function toMenuItem(entry: NavEntry): DynadrillMenuItem {
  return { label: entry.label, link: entry.link, children: entry.children?.map(toMenuItem) };
}

/** Sidebar permanente de escritorio — en móvil lo reemplazan el drawer y la navegación inferior. */
@Component({
  selector: 'app-sidebar',
  imports: [DynadrillMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="app-sidebar" aria-label="Navegación principal">
      <dynadrill-menu [items]="items()" />
    </nav>
  `,
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private readonly nav = inject(NavigationService);

  protected readonly items = computed<DynadrillMenuItem[]>(() =>
    this.nav.modules().map(module => ({
      label: module.label,
      icon: MENU_ICON[module.icon],
      link: module.link,
      children: module.children?.map(toMenuItem),
    })),
  );
}
