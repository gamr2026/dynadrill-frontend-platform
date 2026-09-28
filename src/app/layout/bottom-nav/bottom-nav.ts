import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavIconComponent } from '../navigation/nav-icon';
import { NavIcon, firstLink } from '../navigation/nav.model';
import { NavigationService } from '../navigation/navigation.service';
import { ShellActionsService } from '../shell-actions.service';

interface BottomNavItem {
  label: string;
  icon: NavIcon;
  link: string;
  active: boolean;
}

/** Máximo de destinos de una barra de navegación inferior (Material 3). */
const MAX_ITEMS = 5;
/** Con más destinos que esto "Reportar" sale de la barra y queda solo en el drawer. */
const MAX_ITEMS_WITH_REPORTAR = 3;

/**
 * Navegación inferior contextual (Nav/BottomNav en Figma): Inicio + los
 * destinos del módulo actual, y "Reportar" si queda espacio.
 */
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
})
export class BottomNav {
  private readonly nav = inject(NavigationService);
  protected readonly actions = inject(ShellActionsService);

  protected readonly items = computed<BottomNavItem[]>(() => {
    const [home] = this.nav.modules();
    const module = this.nav.activeModule();
    const homeItem: BottomNavItem = { label: home.label, icon: home.icon, link: firstLink(home) ?? '/dashboard', active: module.key === home.key };
    if (module.key === home.key) return [homeItem];

    const moduleItems = (module.children ?? []).map(entry => ({
      label: entry.label,
      icon: entry.icon ?? module.icon,
      link: firstLink(entry) ?? '/dashboard',
      active: this.nav.isActive(entry),
    }));
    return [homeItem, ...moduleItems].slice(0, MAX_ITEMS);
  });

  protected readonly showReportar = computed(() => this.items().length <= MAX_ITEMS_WITH_REPORTAR);
}
