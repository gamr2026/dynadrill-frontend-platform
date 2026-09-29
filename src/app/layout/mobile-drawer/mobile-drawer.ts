import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DynadrillAvatarComponent, DynadrillSpinnerComponent } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';
import { NavIconComponent } from '../navigation/nav-icon';
import { firstLink } from '../navigation/nav.model';
import { NavigationService } from '../navigation/navigation.service';
import { ShellActionsService } from '../shell-actions.service';
import { SidebarStateService } from '../sidebar-state.service';

/**
 * Drawer de módulos en móvil (Nav/Drawer en Figma): cambia de módulo y lista los destinos del
 * módulo activo (incluidos los de un grupo); la barra inferior contextual da el acceso rápido.
 */
@Component({
  selector: 'app-mobile-drawer',
  imports: [RouterLink, DynadrillAvatarComponent, DynadrillSpinnerComponent, NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mobile-drawer.html',
  styleUrl: './mobile-drawer.scss',
  host: {
    '[class.mobile-drawer--open]': 'state.open()',
    '[attr.inert]': 'state.open() ? null : ""',
    '(keydown.escape)': 'state.close()',
  },
})
export class MobileDrawer {
  private readonly auth = inject(AuthService);
  protected readonly nav = inject(NavigationService);
  protected readonly actions = inject(ShellActionsService);
  protected readonly state = inject(SidebarStateService);

  protected readonly user = computed(() => this.auth.currentUser());
  protected readonly items = computed(() =>
    this.nav.modules().map(module => ({ module, link: firstLink(module) ?? '/dashboard' })),
  );

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    // Foco al primer destino al abrir — sin esto el foco quedaba en la hamburguesa, detrás del backdrop.
    effect(() => {
      if (this.state.open()) queueMicrotask(() => this.panel().nativeElement.querySelector<HTMLElement>('a')?.focus());
    });
  }
}
