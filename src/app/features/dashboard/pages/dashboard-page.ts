import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DynadrillIconComponent, DynadrillIconName, DynadrillScreenHeaderComponent, DynadrillSectionComponent, DynadrillSpinnerComponent } from '@digitec-it-projects/dynadrill-ui';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { AuthService } from '../../../core/services/auth.service';
import { UnidadesService } from '../../maintenance/services/unidades.service';
import { calcularAlertas } from '../../maintenance/models/unidad.model';
import { InvestigacionService } from '../../qhse/investigaciones/services/investigacion.service';
import { EmergenciaService } from '../../qhse/emergencias/services/emergencia.service';
import { SwaService } from '../../qhse/swa/services/swa.service';
import { DerrameService } from '../../qhse/derrames/services/derrame.service';
import { InspeccionEquipoService } from '../../qhse/inspecciones/services/inspeccion-equipo.service';
import { inspeccionEnCuarentena, inspeccionVencida } from '../../qhse/inspecciones/models/inspeccion-equipo.model';
import { IpercService } from '../../qhse/iperc/services/iperc.service';
import { ArticulosService } from '../../inventario/services/articulos.service';
import { PumpingService } from '../../operations/pumping/services/pumping.service';
import { FcrService } from '../../operations/fcr/services/fcr.service';
import { PedidoService } from '../../facturacion/services/pedido.service';
import { UsersService, RolesService } from '../../users/services/users.service';

type DashboardKpiTone = 'success' | 'error' | 'info' | 'brand';
type DashboardChartTone = 'error' | 'warning' | 'info' | 'success';

interface DashboardKpi {
  value: number;
  label: string;
  tone: DashboardKpiTone;
  icon: DynadrillIconName;
}

interface DashboardChartSegment {
  label: string;
  value: number;
  tone: DashboardChartTone;
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
  'Control de Herramientas': ['Operaciones'],
  Facturación: ['Facturación'],
  'Ingeniería de Ventas': ['Facturación'],
  'Ingeniería de Ventas FCR': [],
};

@Component({
  selector: 'app-dashboard-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillSectionComponent, DynadrillIconComponent, DynadrillSpinnerComponent, NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly auth = inject(AuthService);
  private readonly unidadesService = inject(UnidadesService);
  private readonly investigacionService = inject(InvestigacionService);
  private readonly emergenciaService = inject(EmergenciaService);
  private readonly swaService = inject(SwaService);
  private readonly derrameService = inject(DerrameService);
  private readonly inspeccionEquipoService = inject(InspeccionEquipoService);
  private readonly ipercService = inject(IpercService);
  private readonly articulosService = inject(ArticulosService);
  private readonly pumpingService = inject(PumpingService);
  private readonly fcrService = inject(FcrService);
  private readonly pedidoService = inject(PedidoService);
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);

  protected readonly loading = signal(true);
  protected readonly kpis = signal<DashboardKpi[]>([]);
  private readonly allCards = signal<DashboardModuleCard[]>([]);

  /** Solo las cards que el rol de la sesión puede ver (ver CARDS_POR_ROL) — sin rama por defecto: un rol sin entrada no ve ninguna. */
  protected readonly moduleCards = computed(() => {
    const roleName = this.auth.currentUser()?.roleName ?? '';
    const permitidas = new Set(CARDS_POR_ROL[roleName] ?? []);
    return this.allCards()
      .filter(card => permitidas.has(card.title))
      .map(card => ({ ...card, pieOptions: pieOptions(card.segments) }));
  });

  protected dotColor(tone: DashboardChartTone): string {
    return toneColor(tone);
  }

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    forkJoin({
      unidades: this.unidadesService.list(),
      investigaciones: this.investigacionService.list(),
      emergencias: this.emergenciaService.list(),
      swa: this.swaService.list(),
      derrames: this.derrameService.list(),
      inspecciones: this.inspeccionEquipoService.list(),
      iperc: this.ipercService.list(),
      articulos: this.articulosService.list(),
      pumpingTickets: this.pumpingService.listTickets(),
      fcrTickets: this.fcrService.listTickets(),
      pedidos: this.pedidoService.list(),
      users: this.usersService.list(),
      roles: this.rolesService.list(),
    }).subscribe({
      next: ({ unidades, investigaciones, emergencias, swa, derrames, inspecciones, iperc, articulos, pumpingTickets, fcrTickets, pedidos, users, roles }) => {
        // ── Mantenimiento: alertas preventivas por unidad ──
        const alertas = unidades.flatMap(u => calcularAlertas(u));
        const vencidas = alertas.filter(a => a.nivel === 'rojo').length;
        const proximas = alertas.filter(a => a.nivel === 'amarillo').length;

        // ── QHSE: suma de los 4 tipos de evento en estado activo/abierto + inspecciones vencidas + IPERC sin aprobar ──
        const incidentesAbiertos =
          investigaciones.filter(i => i.estado === 'abierta').length +
          emergencias.filter(e => e.estado === 'activa').length +
          swa.filter(s => s.estado === 'activo').length +
          derrames.filter(d => d.estado === 'activo').length;
        const inspeccionesPendientes = inspecciones.filter(i => !inspeccionEnCuarentena(i) && inspeccionVencida(i)).length;
        const ipercSinAprobar = iperc.filter(m => m.status !== 'aprobada').length;

        // ── Inventario: sin campo de stock mínimo real — solo Agotados vs En regla ──
        const activos = articulos.filter(a => a.activo);
        const agotados = activos.filter(a => a.stockActual === 0).length;
        const enRegla = activos.length - agotados;

        // ── Operaciones: Pumping + FCR combinados por su `status` compartido ──
        const tickets = [...pumpingTickets, ...fcrTickets];
        const enRevision = tickets.filter(t => t.status === 'en_revision').length;
        const enEjecucion = tickets.filter(t => t.status === 'en_ejecucion').length;

        // ── Facturación: Pedidos — "por aprobar" = prefactura en revisión interna, "aprobados" = ticket ya firmado por el cliente ──
        const porAprobar = pedidos.filter(p => p.estado === 'en_revision_prefacturacion').length;
        const aprobados = pedidos.filter(p => p.estado === 'ticket_firmado').length;

        // ── Usuarios ──
        const roleById = new Map(roles.map(r => [r.id, r.name]));
        const activosUsuarios = users.filter(u => u.status);
        const administradores = activosUsuarios.filter(u => roleById.get(u.roleId) === 'Superadmin').length;
        const operadores = activosUsuarios.filter(u => (roleById.get(u.roleId) ?? '').startsWith('Operador')).length;

        this.kpis.set([
          { value: unidades.length, label: 'Unidades con alertas de mantenimiento', tone: vencidas > 0 ? 'error' : 'success', icon: 'tool' },
          { value: incidentesAbiertos, label: 'Incidentes QHSE abiertos', tone: 'error', icon: 'alert' },
          { value: articulos.length, label: 'Artículos en inventario', tone: 'brand', icon: 'box' },
          { value: tickets.length, label: 'Tickets de operación activos', tone: 'info', icon: 'modules' },
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
            summaryLine: `${activos.length} artículos activos`,
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
            summaryLine: `${pedidos.length} pedidos`,
            segments: [
              { label: 'Por aprobar', value: porAprobar, tone: 'warning' },
              { label: 'Aprobados', value: aprobados, tone: 'success' },
            ],
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
