import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { DynadrillButtonComponent, DynadrillIconComponent, DynadrillNotificationBellComponent, DynadrillSpinnerComponent, type DynadrillNotificationItem } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';
import type { Role, UsuarioPorRol } from '../../features/users/models/user.model';
import { RolesService } from '../../features/users/services/users.service';
import { NotificationsService, AppNotificationItem } from '../../core/services/notifications.service';
import { PageChromeService } from '../page-chrome.service';
import { ShellActionsService } from '../shell-actions.service';
import { SidebarStateService } from '../sidebar-state.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, NzDropDownModule, DynadrillButtonComponent, DynadrillIconComponent, DynadrillNotificationBellComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly notifications = inject(NotificationsService);
  private readonly auth = inject(AuthService);
  private readonly rolesService = inject(RolesService);

  /** Selector "Actuar como" — solo para sesiones abiertas con Superadmin (demo de flujos completos). */
  protected readonly puedeActuarComo = this.auth.puedeActuarComo;
  protected readonly rolActual = computed(() => this.auth.currentUser()?.roleName ?? '');
  protected readonly roles = toSignal(this.rolesService.list().pipe(catchError(() => of([]))), { initialValue: [] });

  protected readonly menuRolesAbierto = signal(false);
  /** Rol con varias personas: se elige con cuál actuar (ej. qué conductor, qué operador de mantenimiento). */
  protected readonly eligiendoUsuario = signal<{ rol: Role; usuarios: UsuarioPorRol[] } | null>(null);

  protected onMenuRolesVisible(visible: boolean): void {
    this.menuRolesAbierto.set(visible);
    if (!visible) this.eligiendoUsuario.set(null);
  }

  protected elegirRol(rol: Role): void {
    // Volver a Superadmin: se actúa de nuevo como la cuenta real, sin persona.
    if (rol.code === 'superadmin') {
      this.cambiarRol(rol);
      return;
    }
    if (!rol.code) {
      this.cambiarRol(rol);
      return;
    }
    // Las vistas de Conductor y Operador de Mantenimiento dependen de la persona: se actúa como una de ellas, no solo como el rol.
    this.rolesService.usuariosPorRol(rol.code).subscribe({
      next: todos => {
        // TRANSICIÓN (puente de ids): las vistas por persona (Conductor, Operador de Mantenimiento) pertenecen a módulos
        // que aún usan ids numéricos de la demo — solo se ofrece a quien tenga `legacyId`. Se retira cuando migren.
        const usuarios = todos.filter(u => u.legacyId != null);
        if (usuarios.length > 1) this.eligiendoUsuario.set({ rol, usuarios });
        else this.cambiarRol(rol, usuarios[0]);
      },
      error: () => this.cambiarRol(rol),
    });
  }

  protected cambiarRol(rol: Role, persona?: UsuarioPorRol): void {
    this.menuRolesAbierto.set(false);
    this.eligiendoUsuario.set(null);
    // El rol se pide al backend por `code` (los ids de rol son UUID); la persona solo afecta a `legacyUserId` (módulos viejos).
    this.auth.switchRole(rol.name, rol.code, persona);
    this.router.navigateByUrl('/dashboard');
  }

  protected readonly sidebarState = inject(SidebarStateService);
  protected readonly actions = inject(ShellActionsService);
  /** En móvil, una pantalla de detalle reemplaza hamburguesa + logo por "← título". */
  protected readonly detail = inject(PageChromeService).detail;

  /** Sin `backLink`, la flecha "atrás" vuelve en el historial del navegador. */
  protected goBack(): void {
    this.location.back();
  }

  protected readonly notificationItems = this.notifications.items;

  onNotificationClick(item: DynadrillNotificationItem): void {
    const { link, alAbrir } = item as AppNotificationItem;
    alAbrir?.();
    if (link) this.router.navigateByUrl(link);
  }
}
