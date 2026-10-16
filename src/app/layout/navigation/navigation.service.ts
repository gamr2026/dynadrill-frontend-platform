import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NavEntry, NavModule, allLinks } from './nav.model';

// ── Destinos ──

const PUMPING: NavEntry = { label: 'Pumping', icon: 'gauge', link: '/modulos/operativo/pumping' };
/** Pedidos que Ventas abre en la línea Pumping: cada uno llega como ticket al rol de su paso (contenedor operaciones). */
const PEDIDOS_PUMPING: NavEntry = { label: 'Pedidos de Pumping', shortLabel: 'Pedidos', icon: 'list', link: '/modulos/operativo/pumping/pedidos' };
const APROBACIONES: NavEntry = { label: 'Aprobaciones', icon: 'check', link: '/modulos/operativo/pumping/aprobaciones' };
const FCR: NavEntry = { label: 'FCR', icon: 'tool', link: '/modulos/operativo/fcr' };
/** Kits y clase de cada código por cliente para la precarga de herramientas — ver FCR_CONFIGURACION_CODIGOS_ROLES. */
const FCR_CODIGOS: NavEntry = { label: 'Códigos por cliente', shortLabel: 'Códigos', icon: 'clipboard', link: '/modulos/operativo/fcr/configuracion-codigos' };

const BANDEJA_MANTENIMIENTO: NavEntry = { label: 'Bandeja', icon: 'list', link: '/dashboard/mantenimiento' };
const INDICADORES_MANTENIMIENTO: NavEntry = { label: 'Indicadores', icon: 'chart', link: '/dashboard/mantenimiento/kpis' };
const MIS_TAREAS: NavEntry = { label: 'Mis tareas', icon: 'list', link: '/dashboard/mantenimiento/mis-tareas' };
const MANTENIMIENTO_OPERATIVO: NavEntry = { label: 'Mantenimiento', icon: 'tool', link: '/dashboard/mantenimiento/operativo' };
/** Solo Jefe de Base/Superadmin/Supervisor Pumping autorizan (ver ModuleRoles.gerenciamientoViajeApprove en el backend) — Jefe de Mantenimiento no entra. */
const GERENCIAMIENTO_VIAJE: NavEntry = { label: 'Gerenciamiento de Viaje', icon: 'route', link: '/dashboard/mantenimiento/gerenciamiento-viaje' };
/** Portal del Conductor — solo su propio Gerenciamiento de Viaje. */

const INVENTARIO_CHILDREN: NavEntry[] = [
  { label: 'Artículos', icon: 'box', link: '/dashboard/inventario/articulos' },
  { label: 'Vehículos', icon: 'truck', link: '/dashboard/inventario/vehiculos' },
  { label: 'Despachos a Facturación', shortLabel: 'Despachos', icon: 'send', link: '/dashboard/inventario/despachos' },
];

/**
 * Mismas 3 categorías funcionales que la propuesta de composición UI ya
 * validada con el equipo de diseño (Registros/Bitácora, Flujos por fases,
 * Eventos críticos) — 10 ítems planos eran difíciles de escanear. Labels
 * acortados a propósito: el sidebar es angosto y cada nivel de anidamiento
 * le resta espacio horizontal al texto.
 */
const QHSE_CHILDREN: NavEntry[] = [
  { label: 'Indicadores', icon: 'chart', link: '/dashboard/qhse/dashboard' },
  {
    label: 'Planificación',
    icon: 'clipboard',
    link: '/dashboard/qhse/planificacion',
    children: [
      { label: 'IPERC', link: '/dashboard/qhse/iperc' },
      { label: 'PTW / Recibimiento', link: '/dashboard/qhse/ptw' },
      { label: 'Documentos por pedido', link: '/dashboard/qhse/documentos' },
      { label: 'Cumplimiento legal', link: '/dashboard/qhse/legal' },
      { label: 'Objetivos ambientales', link: '/dashboard/qhse/objetivos-ambientales' },
    ],
  },
  {
    label: 'Registros',
    icon: 'list',
    link: '/dashboard/qhse/registros',
    children: [
      { label: 'Inspecciones', link: '/dashboard/qhse/inspecciones' },
      { label: 'Desechos', link: '/dashboard/qhse/desechos' },
      { label: 'Aspectos ambientales', link: '/dashboard/qhse/aspectos-ambientales' },
      { label: 'Entrega de EPI', link: '/dashboard/qhse/epi' },
    ],
  },
  {
    /**
     * SWA, Derrames, Emergencias e Investigaciones comparten una sola
     * bandeja con pestañas (EventosCriticosListPage). STOP se queda aparte:
     * es observación preventiva, no un evento ya ocurrido.
     */
    label: 'Eventos',
    icon: 'alert',
    link: '/dashboard/qhse/eventos-criticos',
    children: [
      { label: 'STOP', link: '/dashboard/qhse/stop' },
      { label: 'Incidentes y Emergencias', link: '/dashboard/qhse/eventos' },
    ],
  },
];

const FACTURACION_CHILDREN: NavEntry[] = [
  { label: 'Pedidos', icon: 'list', link: '/dashboard/facturacion/pedidos' },
  { label: 'Prefacturas', icon: 'file-text', link: '/dashboard/facturacion/prefacturas' },
  { label: 'Lista de precios', icon: 'file-text', link: '/dashboard/facturacion/lista-precios' },
  { label: 'Reportería', icon: 'chart', link: '/dashboard/facturacion/reporteria' },
];

/**
 * "Catálogos" (personas/clientes de Pedido) — solo para quien puede
 * gestionarlos (Ventas + admins, ver ModuleRoles.personasWrite en el
 * backend). A Facturación no se le muestra: el roleGuard lo rebotaría igual.
 */
const CATALOGOS: NavEntry = { label: 'Catálogos', icon: 'users', link: '/dashboard/facturacion/catalogos' };

// ── Módulos ──

const INICIO: NavModule = { key: 'inicio', label: 'Inicio', icon: 'home', link: '/dashboard' };

const operaciones = (...children: NavEntry[]): NavModule => ({ key: 'operaciones', label: 'Operaciones', icon: 'modules', children });
const mantenimiento = (...children: NavEntry[]): NavModule => ({ key: 'mantenimiento', label: 'Mantenimiento', icon: 'tool', children });
const qhse = (): NavModule => ({ key: 'qhse', label: 'QHSE', icon: 'shield', children: QHSE_CHILDREN });
const inventario = (): NavModule => ({ key: 'inventario', label: 'Inventario', icon: 'box', children: INVENTARIO_CHILDREN });
const facturacion = (...children: NavEntry[]): NavModule => ({ key: 'facturacion', label: 'Facturación', icon: 'file-text', children });
const USUARIOS: NavModule = {
  key: 'usuarios',
  label: 'Usuarios',
  icon: 'users',
  children: [{ label: 'Usuarios', icon: 'users', link: '/dashboard/usuarios' }],
  permission: 'identidad.usuarios.ver',
};

/** Módulos que se muestran por permiso (no por nombre de rol). */
const MODULOS_POR_PERMISO: NavModule[] = [
  USUARIOS,
  { key: 'roles-permisos', label: 'Roles y permisos', icon: 'shield', link: '/roles-permisos', permission: 'identidad.roles.ver' },
];

/**
 * Navegación por rol — única fuente para el sidebar de escritorio, el
 * drawer móvil y la navegación inferior contextual.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Cada rol arma su propia lista de forma explícita — a propósito, sin
   * una rama "por defecto" que agregue módulos que nadie pidió. Un rol que
   * no calza con ninguna rama de abajo (o sin roleName todavía, mientras
   * carga la sesión) solo ve Inicio: es la opción segura, nunca la de
   * "mostrar todo hasta que alguien se queje".
   */
  private readonly modulosPorRol = computed<NavModule[]>(() => {
    switch (this.auth.currentUser()?.roleName) {
      case 'Operador de Mantenimiento':
        return [INICIO, mantenimiento(MIS_TAREAS)];
      // operador@dynadrill.com — solo Pumping (nunca FCR, eso es de "Operador FCR") + su Mantenimiento operativo.
      case 'Operador':
        return [INICIO, operaciones(PUMPING, PEDIDOS_PUMPING), mantenimiento(MANTENIMIENTO_OPERATIVO)];
      // Solo FCR: Pumping y Aprobaciones son del rol "Supervisor Pumping".
      case 'Supervisor':
      case 'Operador FCR':
      case 'Supervisor Operaciones FCR':
        return [INICIO, operaciones(FCR)];
      // Cuenta exclusiva de FCR (ventas.fcr@dynadrill.com) — sin Facturación, a pedido del cliente no deben cruzarse.
      // Arma los kits de herramientas por cliente (Códigos por cliente).
      case 'Ingeniería de Ventas FCR':
        return [INICIO, operaciones(FCR, FCR_CODIGOS)];
      // Acotado a Pumping y su bandeja de Aprobaciones (nunca FCR). También autoriza Gerenciamiento de Viaje de riesgo BAJO (DYN-SGI-RE-049).
      case 'Supervisor Pumping':
        return [INICIO, operaciones(PUMPING, PEDIDOS_PUMPING, APROBACIONES, GERENCIAMIENTO_VIAJE)];
      case 'Jefe de Mantenimiento':
        return [INICIO, mantenimiento(BANDEJA_MANTENIMIENTO, INDICADORES_MANTENIMIENTO)];
      case 'Bodeguero':
        return [INICIO, operaciones(FCR), inventario()];
      // Cuenta de Facturación (ventas@dynadrill.com) — sin FCR.
      case 'Ingeniería de Ventas':
        return [INICIO, facturacion({ label: 'Pedidos', icon: 'list', link: '/dashboard/facturacion/pedidos' }, CATALOGOS)];
      // QHSE firma "Liberado por QHSE" en el checklist de inspección por herramienta de FCR — sin FCR no encontraría el ticket.
      case 'Técnico HSE':
      case 'Coordinador HSE':
        return [INICIO, operaciones(FCR), qhse()];
      // Gerente HSE: lo mismo que Técnico/Coordinador HSE, más la bandeja de Gerenciamiento de Viaje
      // (autoriza los de riesgo MEDIO/ALTO junto con el Jefe de Base).
      case 'Gerente HSE':
        return [INICIO, operaciones(FCR), qhse(), mantenimiento(GERENCIAMIENTO_VIAJE)];
      case 'Facturación':
        return [INICIO, facturacion(...FACTURACION_CHILDREN)];
      // A nivel de backend "Jefe de Base" sigue con acceso total (ver ADMIN_ROLE_CODES) — a pedido del cliente, en la UI solo ve Pumping.
      case 'Jefe de Base':
        return [INICIO, operaciones(PUMPING, PEDIDOS_PUMPING, GERENCIAMIENTO_VIAJE)];
      // Único caso con acceso completo a los módulos por rol (Usuarios se habilita por permiso, ver MODULOS_POR_PERMISO).
      case 'Superadmin':
        return [
          INICIO,
          operaciones(PUMPING, PEDIDOS_PUMPING, FCR, FCR_CODIGOS),
          mantenimiento(BANDEJA_MANTENIMIENTO, INDICADORES_MANTENIMIENTO, GERENCIAMIENTO_VIAJE),
          qhse(),
          inventario(),
          facturacion(...FACTURACION_CHILDREN, CATALOGOS),
        ];
      case 'Conductor':
        return [INICIO, operaciones(PUMPING)];
      default:
        return [INICIO];
    }
  });

  /**
   * Módulos del rol más los que se habilitan por permiso (`permission`), sin importar el rol: se agregan al final
   * solo si la sesión tiene ese permiso. Es la base para ir migrando la navegación de roles a permisos.
   */
  readonly modules = computed<NavModule[]>(() => [...this.modulosPorRol(), ...MODULOS_POR_PERMISO.filter(m => m.permission && this.auth.can(m.permission))]);

  /** Módulo al que pertenece la URL actual — el link más largo que la contiene gana (Inicio solo con coincidencia exacta). */
  readonly activeModule = computed<NavModule>(() => {
    const path = this.url().split(/[?#]/)[0];
    let best: { module: NavModule; length: number } | null = null;
    for (const module of this.modules()) {
      for (const link of allLinks(module)) {
        const matches = module === INICIO ? path === link : path === link || path.startsWith(link + '/');
        if (matches && (!best || link.length > best.length)) best = { module, length: link.length };
      }
    }
    return best?.module ?? INICIO;
  });

  /** Destino activo dentro del módulo actual (misma regla de link más largo). */
  isActive(entry: NavEntry | NavModule): boolean {
    const path = this.url().split(/[?#]/)[0];
    const links = allLinks(entry);
    const longestInModule = allLinks(this.activeModule())
      .filter(link => path === link || path.startsWith(link + '/'))
      .sort((a, b) => b.length - a.length)[0];
    return longestInModule !== undefined && links.includes(longestInModule);
  }
}
