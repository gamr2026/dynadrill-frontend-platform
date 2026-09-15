import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillIconName,
  DynadrillMenuComponent,
  DynadrillMenuItem,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';
import { SidebarStateService } from '../sidebar-state.service';
import { ReportarDialog } from '../../features/qhse/shared/components/reportar-dialog';

const OPERATIVO_ITEM: DynadrillMenuItem = {
  label: 'Operativo',
  icon: 'file-text',
  children: [
    { label: 'Pumping', link: '/modulos/operativo/pumping' },
    { label: 'FCR', link: '/modulos/operativo/fcr' },
  ],
};

/** Supervisor: además de Pumping/FCR, su bandeja consolidada de solicitudes de cambio de ítems de sus operadores. */
const SUPERVISOR_OPERATIVO_ITEM: DynadrillMenuItem = {
  label: 'Operativo',
  icon: 'file-text',
  children: [
    { label: 'Pumping', link: '/modulos/operativo/pumping' },
    { label: 'FCR', link: '/modulos/operativo/fcr' },
    { label: 'Aprobaciones', link: '/modulos/operativo/pumping/aprobaciones' },
  ],
};

/** Para roles que solo tocan FCR dentro de Operativo (no Pumping): Bodega, Ingeniería de Ventas FCR, Control de Herramientas. */
const FCR_ONLY_ITEM: DynadrillMenuItem = {
  label: 'Operativo',
  icon: 'file-text',
  children: [{ label: 'FCR', link: '/modulos/operativo/fcr' }],
};

const MANTENIMIENTO_ITEM: DynadrillMenuItem = {
  label: 'Mantenimiento',
  icon: 'tool' as DynadrillIconName,
  children: [
    { label: 'Bandeja', link: '/dashboard/mantenimiento' },
    { label: 'Indicadores', link: '/dashboard/mantenimiento/kpis' },
  ],
};

const INVENTARIO_ITEM: DynadrillMenuItem = {
  label: 'Inventario',
  icon: 'tool' as DynadrillIconName,
  children: [
    { label: 'Artículos', link: '/dashboard/inventario/articulos' },
    { label: 'Vehículos', link: '/dashboard/inventario/vehiculos' },
  ],
};

/**
 * Mismas 3 categorías funcionales que la propuesta de composición UI ya
 * validada con el equipo de diseño (Registros/Bitácora, Flujos por fases,
 * Eventos críticos) — 10 ítems planos eran difíciles de escanear. Labels
 * acortados a propósito: el sidebar es angosto y cada nivel de anidamiento
 * le resta espacio horizontal al texto.
 */
const QHSE_ITEM: DynadrillMenuItem = {
  label: 'QHSE',
  icon: 'alert' as DynadrillIconName,
  children: [
    { label: 'Indicadores', link: '/dashboard/qhse/dashboard' },
    {
      label: 'Planificación',
      children: [
        { label: 'IPERC', link: '/dashboard/qhse/iperc' },
        { label: 'Cobertura IPERC por línea', link: '/dashboard/qhse/iperc-cobertura' },
        { label: 'PTW / Recibimiento', link: '/dashboard/qhse/ptw' },
      ],
    },
    {
      label: 'Registros de campo',
      children: [
        { label: 'Inspecciones', link: '/dashboard/qhse/inspecciones' },
        { label: 'Desechos', link: '/dashboard/qhse/desechos' },
        { label: 'Entrega de EPI', link: '/dashboard/qhse/epi' },
      ],
    },
    {
      /**
       * SWA, Derrames, Emergencias e Investigaciones compartían exactamente
       * el mismo diseño (header + KPIs + grilla de tarjetas) — 4 entradas
       * de sidebar para, en esencia, la misma pantalla. Ahora es una sola
       * bandeja con pestañas (EventosCriticosListPage). STOP se queda
       * aparte: es observación preventiva, no un evento ya ocurrido.
       */
      label: 'Eventos críticos',
      children: [
        { label: 'STOP', link: '/dashboard/qhse/stop' },
        { label: 'Incidentes y Emergencias', link: '/dashboard/qhse/eventos' },
      ],
    },
  ],
};

const FACTURACION_ITEM: DynadrillMenuItem = {
  label: 'Facturación',
  icon: 'file-text' as DynadrillIconName,
  children: [
    { label: 'Pedidos', link: '/dashboard/facturacion/pedidos' },
    { label: 'Prefacturas', link: '/dashboard/facturacion/prefacturas' },
    { label: 'Lista de precios', link: '/dashboard/facturacion/lista-precios' },
    { label: 'Reportería', link: '/dashboard/facturacion/reporteria' },
  ],
};

/**
 * Con "Catálogos" (personas/clientes de Pedido) — solo para quien puede
 * gestionarlos (Ventas + admins, ver ModuleRoles.personasWrite en el
 * backend). Facturación usa `FACTURACION_ITEM` a secas: el link llevaría a
 * una pantalla que el roleGuard le rebota igual.
 */
const FACTURACION_ITEM_ADMIN: DynadrillMenuItem = {
  ...FACTURACION_ITEM,
  children: [...FACTURACION_ITEM.children!, { label: 'Catálogos', link: '/dashboard/facturacion/catalogos' }],
};

const ADMINISTRACION_ITEM: DynadrillMenuItem = {
  label: 'Administración',
  icon: 'settings',
  children: [{ label: 'Usuarios', icon: 'users', link: '/dashboard/usuarios' }],
};

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
  private readonly dialogService = inject(DynadrillDialogService);
  protected readonly sidebarState = inject(SidebarStateService);

  /** Solo visible en mobile (ver sidebar.scss) — en desktop "Reportar" vive en el header. */
  protected openReportar(): void {
    this.sidebarState.close();
    this.dialogService.open<ReportarDialog>({ title: 'Reportar', content: ReportarDialog, size: 'small', footer: false });
  }

  /**
   * Cada rol arma su propia lista de forma explícita — a propósito, sin
   * una rama "por defecto" que agregue módulos que nadie pidió. Un rol que
   * no calza con ninguna rama de abajo (o sin roleName todavía, mientras
   * carga la sesión) solo ve Dashboard: es la opción segura, nunca la de
   * "mostrar todo hasta que alguien se queje".
   */
  protected readonly items = computed<DynadrillMenuItem[]>(() => {
    const roleName = this.auth.currentUser()?.roleName;
    const dashboard: DynadrillMenuItem = { label: 'Dashboard', icon: 'home', link: '/dashboard' };

    if (roleName === 'Operador de Mantenimiento') {
      return [dashboard, { label: 'Mis tareas', icon: 'tool' as DynadrillIconName, link: '/dashboard/mantenimiento/mis-tareas' }];
    }

    if (roleName === 'Operador') {
      return [
        dashboard,
        {
          label: 'Módulos',
          icon: 'modules',
          children: [OPERATIVO_ITEM, { label: 'Mantenimiento', icon: 'tool' as DynadrillIconName, link: '/dashboard/mantenimiento/operativo' }],
        },
      ];
    }

    if (roleName === 'Supervisor') {
      // Sin PTW: "Firmar PTW y Actas" quedó mal asignado a este rol en una
      // iteración anterior (corregido también en qhse.routes.ts).
      return [dashboard, { label: 'Módulos', icon: 'modules', children: [SUPERVISOR_OPERATIVO_ITEM] }];
    }

    if (roleName === 'Jefe de Mantenimiento') {
      return [dashboard, MANTENIMIENTO_ITEM];
    }

    if (roleName === 'Bodeguero') {
      return [dashboard, INVENTARIO_ITEM, FCR_ONLY_ITEM];
    }

    // Cuenta de Facturación (ventas@dynadrill.com) — sin FCR, ver [[Ingeniería de Ventas FCR]] abajo.
    if (roleName === 'Ingeniería de Ventas') {
      return [
        dashboard,
        {
          label: 'Facturación',
          icon: 'file-text' as DynadrillIconName,
          children: [
            { label: 'Pedidos', link: '/dashboard/facturacion/pedidos' },
            { label: 'Catálogos', link: '/dashboard/facturacion/catalogos' },
          ],
        },
      ];
    }

    // Cuenta exclusiva de FCR (ventas.fcr@dynadrill.com) — sin Facturación, a
    // pedido del cliente no deben cruzarse (ver ModuleRoles.fcr backend).
    if (roleName === 'Ingeniería de Ventas FCR') {
      return [dashboard, FCR_ONLY_ITEM];
    }

    if (roleName === 'Control de Herramientas') {
      return [dashboard, FCR_ONLY_ITEM];
    }

    if (roleName === 'Supervisor Operaciones FCR') {
      return [dashboard, FCR_ONLY_ITEM];
    }

    if (roleName === 'Técnico HSE' || roleName === 'Coordinador HSE' || roleName === 'Gerente HSE') {
      // Sin FCR_ONLY_ITEM a propósito: QHSE no debe navegar la lista general
      // de tickets Operativo. Sigue teniendo el permiso de backend
      // (ModuleRoles.fcr/fcrRead) para entrar al detalle puntual de un
      // ticket y firmar "Liberado por QHSE" en el checklist de inspección
      // por herramienta cuando le corresponde — solo se le saca el acceso
      // de navegación libre por el menú.
      return [dashboard, QHSE_ITEM];
    }

    if (roleName === 'Facturación') {
      return [dashboard, FACTURACION_ITEM];
    }

    /**
     * Único caso con acceso completo — el único que ve Administración.
     * "Jefe de Base" se trata igual que Superadmin: ya se comportaba como
     * acceso total antes de que este sidebar pasara a listas explícitas
     * por rol, y nadie pidió restringirlo.
     */
    if (roleName === 'Superadmin' || roleName === 'Jefe de Base') {
      return [
        dashboard,
        ADMINISTRACION_ITEM,
        {
          label: 'Módulos',
          icon: 'modules',
          children: [OPERATIVO_ITEM, MANTENIMIENTO_ITEM, INVENTARIO_ITEM, QHSE_ITEM, FACTURACION_ITEM_ADMIN],
        },
      ];
    }

    return [dashboard];
  });

  protected readonly loggingOut = signal(false);

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
