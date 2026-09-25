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

/**
 * Supervisor Pumping (supervisor.pumping@dynadrill.com): solo Pumping y su
 * bandeja de Aprobaciones — nunca FCR (eso queda para el Supervisor genérico,
 * ver PUMPING_APROBACIONES_ITEM más abajo).
 */
const PUMPING_APROBACIONES_ITEM: DynadrillMenuItem = {
  label: 'Operativo',
  icon: 'file-text',
  children: [
    { label: 'Pumping', link: '/modulos/operativo/pumping' },
    { label: 'Aprobaciones', link: '/modulos/operativo/pumping/aprobaciones' },
  ],
};

/** Para roles que solo tocan FCR dentro de Operativo (no Pumping): Bodega, Ingeniería de Ventas FCR, Operador FCR. */
const FCR_ONLY_ITEM: DynadrillMenuItem = {
  label: 'Operativo',
  icon: 'file-text',
  children: [{ label: 'FCR', link: '/modulos/operativo/fcr' }],
};

/** Jefe de Base: solo Operativo > Pumping (sin FCR ni Aprobaciones). */
const PUMPING_ONLY_ITEM: DynadrillMenuItem = {
  label: 'Operativo',
  icon: 'file-text',
  children: [{ label: 'Pumping', link: '/modulos/operativo/pumping' }],
};

const MANTENIMIENTO_ITEM: DynadrillMenuItem = {
  label: 'Mantenimiento',
  icon: 'tool' as DynadrillIconName,
  children: [
    { label: 'Bandeja', link: '/dashboard/mantenimiento' },
    { label: 'Indicadores', link: '/dashboard/mantenimiento/kpis' },
  ],
};

/** Solo Jefe de Base/Superadmin autorizan (ver ModuleRoles.gerenciamientoViajeApprove en el backend) — Jefe de Mantenimiento no entra, por eso no vive dentro de MANTENIMIENTO_ITEM. */
const GERENCIAMIENTO_VIAJE_ITEM: DynadrillMenuItem = {
  label: 'Gerenciamiento de Viaje',
  icon: 'tool' as DynadrillIconName,
  link: '/dashboard/mantenimiento/gerenciamiento-viaje',
};

const INVENTARIO_ITEM: DynadrillMenuItem = {
  label: 'Inventario',
  icon: 'tool' as DynadrillIconName,
  children: [
    { label: 'Artículos', link: '/dashboard/inventario/articulos' },
    { label: 'Vehículos', link: '/dashboard/inventario/vehiculos' },
    { label: 'Despachos a Facturación', link: '/dashboard/inventario/despachos' },
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
        { label: 'PTW / Recibimiento', link: '/dashboard/qhse/ptw' },
        { label: 'Documentos por pedido', link: '/dashboard/qhse/documentos' },
        { label: 'Cumplimiento legal', link: '/dashboard/qhse/legal' },
        { label: 'Objetivos ambientales', link: '/dashboard/qhse/objetivos-ambientales' },
      ],
    },
    {
      label: 'Registros de campo',
      children: [
        { label: 'Inspecciones', link: '/dashboard/qhse/inspecciones' },
        { label: 'Desechos', link: '/dashboard/qhse/desechos' },
        { label: 'Aspectos ambientales', link: '/dashboard/qhse/aspectos-ambientales' },
        { label: 'Entrega de EPI', link: '/dashboard/qhse/epi' },
        { label: 'Checklist de equipos', link: '/dashboard/qhse/checklist-equipos' },
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

    // operador@dynadrill.com — solo Pumping (nunca FCR, eso es de "Operador FCR" abajo) + su
    // Mantenimiento operativo.
    if (roleName === 'Operador') {
      return [
        dashboard,
        {
          label: 'Módulos',
          icon: 'modules',
          children: [PUMPING_ONLY_ITEM, { label: 'Mantenimiento', icon: 'tool' as DynadrillIconName, link: '/dashboard/mantenimiento/operativo' }],
        },
      ];
    }

    // operador.fcr@dynadrill.com — solo FCR (nunca Pumping).
    if (roleName === 'Operador FCR') {
      return [dashboard, FCR_ONLY_ITEM];
    }

    if (roleName === 'Supervisor') {
      // Sin PTW: "Firmar PTW y Actas" quedó mal asignado a este rol en una
      // iteración anterior (corregido también en qhse.routes.ts). Solo FCR:
      // Pumping y Aprobaciones ahora son del rol "Supervisor Pumping" (abajo).
      return [dashboard, { label: 'Módulos', icon: 'modules', children: [FCR_ONLY_ITEM] }];
    }

    // supervisor.pumping@dynadrill.com — mismas acciones que Supervisor pero
    // acotado a Pumping y su bandeja de Aprobaciones (nunca FCR). También
    // autoriza/rechaza Gerenciamiento de Viaje de riesgo BAJO (DYN-SGI-RE-049).
    if (roleName === 'Supervisor Pumping') {
      return [dashboard, { label: 'Módulos', icon: 'modules', children: [PUMPING_APROBACIONES_ITEM] }, GERENCIAMIENTO_VIAJE_ITEM];
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

    if (roleName === 'Supervisor Operaciones FCR') {
      return [dashboard, FCR_ONLY_ITEM];
    }

    if (roleName === 'Técnico HSE' || roleName === 'Coordinador HSE') {
      // Con FCR_ONLY_ITEM: QHSE firma "Liberado por QHSE" en el checklist de
      // inspección por herramienta (ModuleRoles.fcr/fcrRead ya lo permitía a
      // nivel backend), pero sin esta entrada de menú no tenía forma de
      // encontrar el ticket donde le toca firmar — antes solo entraba si
      // alguien le pasaba el link directo. Mismo ítem (sin Pumping) que
      // Bodeguero/Operador FCR/Ingeniería de Ventas FCR.
      return [dashboard, QHSE_ITEM, FCR_ONLY_ITEM];
    }

    // Gerente HSE: mismo acceso que Técnico/Coordinador HSE, más
    // Gerenciamiento de Viaje (autoriza MEDIO/ALTO junto con Jefe de Base).
    if (roleName === 'Gerente HSE') {
      return [dashboard, QHSE_ITEM, FCR_ONLY_ITEM, GERENCIAMIENTO_VIAJE_ITEM];
    }

    if (roleName === 'Facturación') {
      return [dashboard, FACTURACION_ITEM];
    }

    /**
     * A nivel de backend "Jefe de Base" sigue con acceso total (ver
     * ADMIN_ROLE_CODES) — esto es solo el sidebar: a pedido del cliente, en
     * la UI solo debe ver Operativo > Pumping.
     */
    if (roleName === 'Jefe de Base') {
      return [dashboard, { label: 'Módulos', icon: 'modules', children: [PUMPING_ONLY_ITEM] }, GERENCIAMIENTO_VIAJE_ITEM];
    }

    /** Único caso con acceso completo en el sidebar — el único que ve Administración. */
    if (roleName === 'Superadmin') {
      return [
        dashboard,
        ADMINISTRACION_ITEM,
        {
          label: 'Módulos',
          icon: 'modules',
          children: [OPERATIVO_ITEM, MANTENIMIENTO_ITEM, INVENTARIO_ITEM, QHSE_ITEM, FACTURACION_ITEM_ADMIN],
        },
        GERENCIAMIENTO_VIAJE_ITEM,
      ];
    }

    // conductor.cvega@dynadrill.com y similares — solo su propio Gerenciamiento de Viaje, sin ningún otro módulo.
    if (roleName === 'Conductor') {
      return [dashboard, { label: 'Gerenciamiento de Viaje', icon: 'tool' as DynadrillIconName, link: '/dashboard/mantenimiento/mis-viajes' }];
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
