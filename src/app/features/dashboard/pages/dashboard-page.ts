import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { DynadrillIconComponent, DynadrillIconName, DynadrillScreenHeaderComponent, DynadrillSpinnerComponent } from '@digitec-it-projects/dynadrill-ui';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { AuthService } from '../../../core/services/auth.service';
import { FlotaUnidadesService } from '../../flota/services/flota-unidades.service';
import { PedidosComercialService } from '../../facturacion/pedidos-comercial/services/pedidos-comercial.service';
import { TicketsPumpingService } from '../../operations/pumping/tickets-nuevos/services/tickets-pumping.service';
import { TicketsFcrService } from '../../operations/fcr/tickets-nuevos/services/tickets-fcr.service';
import { ESTADO_PEDIDO_LABELS, EstadoPedido } from '../../facturacion/models/pedido.model';
import { UsersService, RolesService } from '../../users/services/users.service';
import { TableroGeneralService } from '../tablero-general.service';

type DashboardKpiTone = 'success' | 'error' | 'info' | 'brand';
type DashboardChartTone = 'error' | 'warning' | 'info' | 'success';

interface DashboardKpi {
  value: number;
  label: string;
  /** Línea secundaria bajo el título (Figma Card/KPI › caption). */
  caption: string;
  tone: DashboardKpiTone;
  /** Módulo dueño del KPI — decide qué roles lo ven (ver CARDS_POR_ROL). */
  module: string;
}

interface DashboardChartSegment {
  label: string;
  value: number;
  tone: DashboardChartTone;
  /** Acceso directo al segmento equivalente ya filtrado — hoy solo lo trae Facturación (ver `FACTURACION_ESTADOS_SEGMENT`). */
  link?: string;
  queryParams?: Record<string, string>;
}

/** Color de acento del ícono de la card — sin definir, dynadrill-section usa su morado de marca por defecto. */
type DashboardAccent = 'success' | 'error' | 'warning' | 'info';

interface DashboardModuleCard {
  title: string;
  icon: DynadrillIconName;
  viewAllLink: string;
  accent?: DashboardAccent;
  /** Línea de total, cuando el desglose de segments no la cubre por sí solo (ej. QHSE no tiene un "total" propio, así que queda sin definir). */
  summaryLine?: string;
  /** Reparto que arma el gráfico de pastel — deja ver de un vistazo cuál concentra más procesos dentro del módulo. */
  segments: DashboardChartSegment[];
}

function toneColor(tone: DashboardChartTone): string {
  switch (tone) {
    case 'error':
      return 'var(--error, #ff4d4f)';
    case 'warning':
      return 'var(--warning, #faad14)';
    case 'info':
      return 'var(--info, #1890ff)';
    case 'success':
      return 'var(--success, #52c41a)';
  }
}

/**
 * Hex plano para echarts: el chart pinta en <canvas>, fuera del árbol de
 * estilos de Angular, así que un itemStyle.color en var(--...) no se
 * resuelve — queda transparente/negro. Mismo motivo por el que
 * dynadrill-chart hardcodea su BRAND_PALETTE en vez de leer custom
 * properties. Valores sincronizados a mano con los tokens de _tokens.less.
 */
function toneHex(tone: DashboardChartTone): string {
  switch (tone) {
    case 'error':
      return '#ff4d4f';
    case 'warning':
      return '#faad14';
    case 'info':
      return '#1890ff';
    case 'success':
      return '#52c41a';
  }
}

/**
 * Pastel tipo donut por echarts — leyenda/label nativos apagados a propósito:
 * la lectura real de los valores va en la lista de texto de al lado (el
 * canvas del chart es puramente decorativo y queda aria-hidden), así el
 * desglose sigue siendo accesible sin depender de un tooltip con mouse.
 */
function pieOptions(segments: DashboardChartSegment[]): EChartsCoreOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['60%', '90%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        // Por defecto echarts agranda el sector al pasar el mouse
        // (emphasis.scale) — con el radio ya cerca del borde del canvas de
        // 64px, ese crecimiento se recorta contra el cuadrado del
        // contenedor. Se apaga: el chart es decorativo, el tooltip solo.
        emphasis: { scale: false },
        data: segments.map(s => ({ name: s.label, value: s.value, itemStyle: { color: toneHex(s.tone) } })),
      },
    ],
  };
}

/**
 * Estados de Facturación que el dashboard destaca — solo los 4 que marcan el
 * avance real del pedido (en curso, esperando firmas, rechazado, cerrado), como
 * en el diseño Figma. Antes eran los 14 `EstadoPedido` y la card se estiraba
 * hasta duplicar la altura del resto. Cada segmento sigue siendo un link a
 * Secuencial TK ya filtrado por ese estado (Reportería acepta uno solo), y el
 * resto de estados se consulta ahí mismo con los filtros de Reportería.
 */
const FACTURACION_ESTADOS_SEGMENT: { estado: EstadoPedido; tone: DashboardChartTone }[] = [
  { estado: 'en_operacion', tone: 'info' },
  { estado: 'enviado_para_firmas', tone: 'warning' },
  { estado: 'rechazado_por_cliente', tone: 'error' },
  { estado: 'ticket_firmado', tone: 'success' },
];

/**
 * Qué card(s) ve cada rol — mismo criterio "lista explícita por rol, sin
 * rama por defecto" que sidebar.ts: un rol sin entrada acá no ve ningún
 * module card (solo los KPI de arriba). Superadmin es el único con acceso
 * total, a pedido del cliente — ni Jefe de Base ve todas acá (a diferencia
 * del sidebar, donde sigue siendo admin a nivel de backend).
 */
const CARDS_POR_ROL: Record<string, string[]> = {
  Superadmin: ['Mantenimiento', 'QHSE', 'Inventario', 'Operaciones', 'Facturación', 'Usuarios'],
  'Jefe de Mantenimiento': ['Mantenimiento'],
  'Operador de Mantenimiento': ['Mantenimiento'],
  'Técnico HSE': ['QHSE'],
  'Coordinador HSE': ['QHSE'],
  'Gerente HSE': ['QHSE'],
  Bodeguero: ['Inventario'],
  'Jefe de Base': ['Operaciones'],
  Supervisor: ['Operaciones'],
  'Supervisor Pumping': ['Operaciones'],
  'Supervisor Operaciones FCR': ['Operaciones'],
  Operador: ['Operaciones'],
  'Operador FCR': ['Operaciones'],
  Facturación: ['Facturación'],
  'Ingeniería de Ventas': ['Facturación'],
  'Ingeniería de Ventas FCR': [],
};

@Component({
  selector: 'app-dashboard-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillIconComponent, DynadrillSpinnerComponent, NgxEchartsDirective, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly auth = inject(AuthService);
  private readonly flotaService = inject(FlotaUnidadesService);
  private readonly tablero = inject(TableroGeneralService);
  private readonly pumpingService = inject(TicketsPumpingService);
  private readonly fcrService = inject(TicketsFcrService);
  private readonly pedidosService = inject(PedidosComercialService);
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);

  protected readonly loading = signal(true);
  private readonly allKpis = signal<DashboardKpi[]>([]);
  private readonly allCards = signal<DashboardModuleCard[]>([]);

  /** Módulos que el rol de la sesión puede ver (ver CARDS_POR_ROL) — sin rama por defecto: un rol sin entrada no ve nada. */
  private readonly modulosPermitidos = computed(() => new Set(CARDS_POR_ROL[this.auth.currentUser()?.roleName ?? ''] ?? []));

  /** Solo Superadmin ve todos los módulos: al resto se le avisa que la vista está filtrada por su rol. */
  protected readonly showRoleNotice = computed(() => this.auth.currentUser()?.roleName !== 'Superadmin');

  /** Mismo criterio que las cards: cada KPI pertenece a un módulo y solo lo ve quien tiene ese módulo. */
  protected readonly kpis = computed(() => this.allKpis().filter(kpi => this.modulosPermitidos().has(kpi.module)));

  protected readonly moduleCards = computed(() =>
    this.allCards()
      .filter(card => this.modulosPermitidos().has(card.title))
      .map(card => ({ ...card, pieOptions: pieOptions(card.segments) })),
  );

  protected readonly isEmpty = computed(() => !this.loading() && this.kpis().length === 0 && this.moduleCards().length === 0);

  protected dotColor(tone: DashboardChartTone): string {
    return toneColor(tone);
  }

  constructor() {
    this.cargar();
  }

  /**
   * Cada card es de un dominio con su propio @Roles de backend (ej. QHSE,
   * Usuarios) — un rol que no puede leer ese dominio recibe 403. Antes esto
   * hacía fallar el `forkJoin` COMPLETO (todo-o-nada) y ningún card se veía
   * para nadie salvo Superadmin, que sí tiene acceso a los 13 endpoints.
   * Con `catchError` cada fuente cae a lista vacía en vez de tumbar a las
   * demás — igual da lo mismo para el usuario: `moduleCards` ya filtra por
   * CARDS_POR_ROL, así que un 403 solo afecta a datos de una card que ese
   * rol no iba a ver de todas formas.
   */
  private safe<T>(obs: Observable<T[]>): Observable<T[]> {
    return obs.pipe(catchError(() => of([] as T[])));
  }

  private cargar(): void {
    const total = (estado?: string) =>
      this.pedidosService.listar({ estado, page: 1, limit: 1 }).pipe(
        map(r => r.total),
        catchError(() => of(0)),
      );
    forkJoin({
      alertas: this.safe(this.flotaService.alertas()),
      qhse: this.tablero.qhse().pipe(catchError(() => of({ incidentesAbiertos: 0, inspeccionesPendientes: 0, ipercSinAprobar: 0 }))),
      inventario: this.tablero.inventario().pipe(catchError(() => of({ activos: 0, agotados: 0, enRegla: 0 }))),
      pumpingTickets: this.safe(this.pumpingService.listar()),
      fcrTickets: this.safe(this.fcrService.listar()),
      pedidosTotal: total(),
      pedidosPorEstado: forkJoin(FACTURACION_ESTADOS_SEGMENT.map(({ estado }) => total(estado))),
      users: this.safe(this.usersService.list()),
      roles: this.safe(this.rolesService.list()),
    }).subscribe({
      next: ({ alertas, qhse, inventario, pumpingTickets, fcrTickets, pedidosTotal, pedidosPorEstado, users, roles }) => {
        // ── Mantenimiento: alertas preventivas de las unidades activas (las calcula Flota) ──
        const vencidas = alertas.filter(a => a.nivel === 'rojo').length;
        const proximas = alertas.filter(a => a.nivel === 'amarillo').length;
        const unidadesConAlerta = new Set(alertas.filter(a => a.nivel !== 'verde').map(a => a.unidad.id)).size;

        // ── QHSE: eventos abiertos, inspecciones vencidas e IPERC por aprobar (los cuenta QHSE) ──
        const { incidentesAbiertos, inspeccionesPendientes, ipercSinAprobar } = qhse;

        // ── Inventario ──
        const { activos, agotados, enRegla } = inventario;

        // ── Operaciones: Pumping + FCR por el macro-estado de su paso (los tickets terminados no cuentan) ──
        const tickets = [...pumpingTickets, ...fcrTickets].filter(t => t.paso.macro !== 'aprobado');
        const enRevision = tickets.filter(t => t.paso.macro === 'esperando_aprobacion').length;
        const enEjecucion = tickets.filter(t => t.paso.macro === 'en_proceso').length;

        // ── Facturación: solo los estados destacados (ver FACTURACION_ESTADOS_SEGMENT) que tengan al menos un pedido ──
        const segmentosFacturacion: DashboardChartSegment[] = FACTURACION_ESTADOS_SEGMENT.map(({ estado, tone }, i) => ({
          label: ESTADO_PEDIDO_LABELS[estado],
          value: pedidosPorEstado[i],
          tone,
          link: '/dashboard/facturacion/reporteria',
          queryParams: { estado },
        })).filter(s => s.value > 0);

        // ── Usuarios ──
        const roleById = new Map(roles.map(r => [r.id, r.name]));
        const activosUsuarios = users.filter(u => u.status);
        const administradores = activosUsuarios.filter(u => roleById.get(u.roleId) === 'Superadmin').length;
        const operadores = activosUsuarios.filter(u => (roleById.get(u.roleId) ?? '').startsWith('Operador')).length;

        this.allKpis.set([
          { value: unidadesConAlerta, label: 'Unidades con alertas de mantenimiento', caption: `${vencidas} vencidas`, tone: vencidas > 0 ? 'error' : 'success', module: 'Mantenimiento' },
          { value: incidentesAbiertos, label: 'Incidentes QHSE abiertos', caption: 'Requieren atención', tone: 'error', module: 'QHSE' },
          { value: activos, label: 'Artículos en inventario', caption: 'Activos', tone: 'brand', module: 'Inventario' },
          { value: tickets.length, label: 'Tickets de operación activos', caption: 'Pumping + FCR', tone: 'info', module: 'Operaciones' },
        ]);

        this.allCards.set([
          {
            title: 'Mantenimiento',
            icon: 'tool',
            viewAllLink: '/dashboard/mantenimiento',
            accent: 'success',
            summaryLine: `${vencidas + proximas} alertas de mantenimiento`,
            segments: [
              { label: 'Vencidas', value: vencidas, tone: 'error' },
              { label: 'Próximas a vencer', value: proximas, tone: 'warning' },
            ],
          },
          {
            title: 'QHSE',
            icon: 'alert',
            viewAllLink: '/dashboard/qhse',
            accent: 'error',
            summaryLine: `${incidentesAbiertos + inspeccionesPendientes + ipercSinAprobar} pendientes`,
            segments: [
              { label: 'Incidentes abiertos', value: incidentesAbiertos, tone: 'error' },
              { label: 'Inspecciones pendientes', value: inspeccionesPendientes, tone: 'warning' },
              { label: 'IPERC sin aprobar', value: ipercSinAprobar, tone: 'info' },
            ],
          },
          {
            title: 'Inventario',
            icon: 'box',
            viewAllLink: '/dashboard/inventario',
            summaryLine: `${activos} artículos activos`,
            segments: [
              { label: 'Agotados', value: agotados, tone: 'error' },
              { label: 'En regla', value: enRegla, tone: 'success' },
            ],
          },
          {
            title: 'Operaciones',
            icon: 'modules',
            viewAllLink: '/modulos/operativo',
            accent: 'info',
            summaryLine: `${tickets.length} tickets activos`,
            segments: [
              { label: 'En revisión', value: enRevision, tone: 'warning' },
              { label: 'En ejecución', value: enEjecucion, tone: 'info' },
            ],
          },
          {
            title: 'Facturación',
            icon: 'file-text',
            viewAllLink: '/dashboard/facturacion',
            accent: 'warning',
            summaryLine: `${pedidosTotal} pedidos`,
            segments: segmentosFacturacion,
          },
          {
            title: 'Usuarios',
            icon: 'users',
            viewAllLink: '/dashboard/usuarios',
            summaryLine: `${activosUsuarios.length} usuarios activos`,
            segments: [
              { label: 'Administradores', value: administradores, tone: 'info' },
              { label: 'Operadores', value: operadores, tone: 'success' },
            ],
          },
        ]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
