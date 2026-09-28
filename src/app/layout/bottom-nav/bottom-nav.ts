import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { DynadrillDialogService, DynadrillIconComponent, DynadrillIconName } from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';
import { SidebarStateService } from '../sidebar-state.service';
import { ReportarDialog } from '../../features/qhse/shared/components/reportar-dialog';

interface BottomNavItem {
  label: string;
  link: string;
  /** Ícono de la librería; si no existe uno equivalente, `svg` trae los trazos (Lucide, 24px). */
  icon?: DynadrillIconName;
  svg?: string[];
  /** Coincidencia exacta de la ruta (solo Inicio) — el resto queda activo también en sus subrutas. */
  exact?: boolean;
  /** Roles que ven el destino; sin definir lo ve cualquiera. Mismo criterio que los roleGuard de la ruta. */
  roles?: string[];
}

const INICIO: BottomNavItem = { label: 'Inicio', link: '/dashboard', icon: 'home', exact: true };

/** Mismos roles que facturacion.routes.ts (FACTURACION_ROLES / PEDIDO_ROLES). */
const FACTURACION_ROLES = ['Facturación', 'Superadmin', 'Jefe de Base'];
const PEDIDO_ROLES = [...FACTURACION_ROLES, 'Ingeniería de Ventas'];

/**
 * Barra inferior contextual por módulo (Figma Nav/BottomNav: 3–5 destinos).
 * Cada módulo con su propio menú rápido declara aquí sus destinos; fuera de
 * ellos se muestra la barra por defecto (Inicio, Módulos, Reportar).
 */
const MODULOS: { prefix: string; items: BottomNavItem[] }[] = [
  {
    prefix: '/dashboard/facturacion',
    items: [
      INICIO,
      { label: 'Pedidos', link: '/dashboard/facturacion/pedidos', icon: 'file-text', roles: PEDIDO_ROLES },
      {
        label: 'Prefacturas',
        link: '/dashboard/facturacion/prefacturas',
        svg: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8', 'M12 18V6'],
        roles: FACTURACION_ROLES,
      },
      {
        label: 'Precios',
        link: '/dashboard/facturacion/lista-precios',
        svg: [
          'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42Z',
          'M7.5 7.5h.01',
        ],
        roles: FACTURACION_ROLES,
      },
      {
        label: 'Reportes',
        link: '/dashboard/facturacion/reporteria',
        svg: ['M3 3v16a2 2 0 0 0 2 2h16', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
        roles: FACTURACION_ROLES,
      },
    ],
  },
];

/**
 * Barra de navegación inferior — solo móvil (<840px), ver shell.scss. Por
 * defecto: Inicio, Módulos (abre el drawer con el menú completo del rol) y
 * Reportar (acceso rápido universal). Dentro de un módulo con menú propio
 * (ver MODULOS) pasa a mostrar sus destinos, y "Reportar" queda en el drawer.
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly sidebarState = inject(SidebarStateService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Destinos del módulo actual visibles para el rol; con menos de 3 no vale la pena una barra contextual → barra por defecto. */
  protected readonly moduleItems = computed<BottomNavItem[] | null>(() => {
    const url = this.url();
    const modulo = MODULOS.find(m => url === m.prefix || url.startsWith(m.prefix + '/') || url.startsWith(m.prefix + '?'));
    if (!modulo) return null;
    const role = this.auth.currentUser()?.roleName ?? '';
    const items = modulo.items.filter(item => !item.roles || item.roles.includes(role));
    return items.length >= 3 ? items : null;
  });

  protected openReportar(): void {
    this.sidebarState.close();
    this.dialogService.open<ReportarDialog>({ title: 'Reportar', content: ReportarDialog, size: 'small', footer: false });
  }
}
