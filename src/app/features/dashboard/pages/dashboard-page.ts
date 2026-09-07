import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DynadrillIconComponent, DynadrillIconName, DynadrillScreenHeaderComponent, DynadrillSectionComponent } from '@digitec-it-projects/dynadrill-ui';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';

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
 * Placeholder de datos fiel al Figma (nodo 17:58, archivo Dynadrill — Rediseño 2026)
 * hasta que se confirmen las reglas de cada módulo (vencido, próximo a vencer, etc.)
 * y se cablee a maintenance-orders / iperc-ptw-investigaciones / articulos / pumping.
 */
const KPIS: DashboardKpi[] = [
  { value: 128, label: 'Órdenes de mantenimiento', tone: 'success', icon: 'tool' },
  { value: 5, label: 'Incidentes QHSE abiertos', tone: 'error', icon: 'alert' },
  { value: 312, label: 'Artículos en inventario', tone: 'brand', icon: 'box' },
  { value: 18, label: 'Tickets de operación activos', tone: 'info', icon: 'modules' },
];

const MODULE_CARDS: DashboardModuleCard[] = [
  {
    title: 'Mantenimiento',
    icon: 'tool',
    viewAllLink: '/dashboard/mantenimiento',
    accent: 'success',
    summaryLine: '12 órdenes abiertas',
    segments: [
      { label: 'Vencidas', value: 3, tone: 'error' },
      { label: 'Próximas a vencer', value: 9, tone: 'warning' },
    ],
  },
  {
    title: 'QHSE',
    icon: 'alert',
    viewAllLink: '/dashboard/qhse',
    accent: 'error',
    summaryLine: '8 pendientes',
    segments: [
      { label: 'Incidentes abiertos', value: 5, tone: 'error' },
      { label: 'Inspecciones pendientes', value: 2, tone: 'warning' },
      { label: 'IPERC sin aprobar', value: 1, tone: 'info' },
    ],
  },
  {
    title: 'Inventario',
    icon: 'box',
    viewAllLink: '/dashboard/inventario',
    summaryLine: '312 artículos activos',
    segments: [
      { label: 'Bajo stock mínimo', value: 8, tone: 'warning' },
      { label: 'Agotados', value: 2, tone: 'error' },
      { label: 'En regla', value: 302, tone: 'success' },
    ],
  },
  {
    title: 'Operaciones',
    icon: 'modules',
    viewAllLink: '/modulos/operativo',
    accent: 'info',
    summaryLine: '18 tickets activos',
    segments: [
      { label: 'En revisión', value: 4, tone: 'warning' },
      { label: 'En ejecución', value: 14, tone: 'info' },
    ],
  },
  {
    title: 'Facturación',
    icon: 'file-text',
    viewAllLink: '/dashboard/facturacion',
    accent: 'warning',
    summaryLine: '24 pedidos pendientes',
    segments: [
      { label: 'Por aprobar', value: 9, tone: 'warning' },
      { label: 'Aprobados', value: 15, tone: 'success' },
    ],
  },
  {
    title: 'Usuarios',
    icon: 'users',
    viewAllLink: '/dashboard/usuarios',
    summaryLine: '42 usuarios activos',
    segments: [
      { label: 'Administradores', value: 5, tone: 'info' },
      { label: 'Operadores', value: 37, tone: 'success' },
    ],
  },
];

@Component({
  selector: 'app-dashboard-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillSectionComponent, DynadrillIconComponent, NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  protected readonly kpis = KPIS;
  protected readonly moduleCards = MODULE_CARDS.map(card => ({ ...card, pieOptions: pieOptions(card.segments) }));

  protected dotColor(tone: DashboardChartTone): string {
    return toneColor(tone);
  }
}
