import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DynadrillNotificationService, type DynadrillTagVariant } from '@digitec-it-projects/dynadrill-ui';
import {
  DASHBOARD_KPI_DEFS,
  DashboardKpiCategoria,
  DashboardKpiDef,
  DashboardKpiValues,
  DashboardMetas,
  evaluarSemaforo,
  kpiFueraDeMeta,
  SemaforoColor,
} from '../../models/dashboard-kpi.model';
import { DashboardIndicadoresService, type FasePtwTablero, type IndicadoresTablero } from '../../services/dashboard-indicadores.service';
import { DashboardMetasService } from '../../services/dashboard-metas.service';
import { forkJoin } from 'rxjs';
import { EPI_ESTADO_LABELS, type EpiEstado } from '../../../epi/models/entrega-epi.model';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { QhseChip } from '../../../shared/components/qhse-chip';
import { QhseIcon } from '../../../shared/components/qhse-icon';

const CATEGORIAS: DashboardKpiCategoria[] = ['Seguridad', 'Operacional', 'Ambiental', 'Cultura Preventiva'];

const SEMAFORO_TONE: Record<SemaforoColor, DynadrillTagVariant> = {
  verde: 'success',
  amarillo: 'warning',
  rojo: 'error',
};

const SEMAFORO_LABEL: Record<SemaforoColor, string> = {
  verde: 'Verde — cumplimiento total',
  amarillo: 'Amarillo — atención requerida',
  rojo: 'Rojo — acción urgente',
};

const EPI_TONE: Record<EpiEstado, DynadrillTagVariant> = {
  solicitado: 'warning',
  aprobado: 'brand',
  despachado: 'success',
  rechazado: 'error',
};

/** Fases abiertas del PTW del backend nuevo; el detalle fase por fase vive en la bandeja de PTW. */
const PTW_FASE_LABELS: Record<FasePtwTablero, string> = {
  gabinete: 'Preparación en gabinete',
  formalizacion: 'Formalización del recibimiento',
  aprobacion: 'Aprobación del PTW',
};
const PTW_FASE_ORDER: FasePtwTablero[] = ['gabinete', 'formalizacion', 'aprobacion'];
const PTW_FASE_TONE: Record<FasePtwTablero, DynadrillTagVariant> = {
  gabinete: 'neutral',
  formalizacion: 'warning',
  aprobacion: 'info',
};

/** A partir de cuántos días sin actualizarse un PTW abierto se considera "estancado" — no es un plazo legal, es un umbral de gestión para que alguien lo revise. */
const PTW_DIAS_SIN_ACTIVIDAD_ALERTA = 3;

interface AtencionItem {
  id: string;
  code: string;
  /** Descripción de la actividad — va debajo del código con ícono, no en la misma línea que el estado. */
  titulo: string;
  /** Badge corto, extremo opuesto al código en la fila superior. */
  estado: string;
  /** Segunda línea con ícono de reloj — solo cuando hay un dato temporal aparte del estado. */
  detalle?: string;
  tone: DynadrillTagVariant;
}

/** HSE-MASTER-001 — Dashboard Integrado del Sistema: cierra el ciclo PDCA agregando los 16 indicadores estratégicos de las 4 fases ya construidas, con semáforo de cumplimiento configurable por metas. */
@Component({
  selector: 'app-qhse-dashboard-page',
  imports: [RouterLink, PageHeader, QhseChip, QhseIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qhse-dashboard-page.html',
  styleUrl: './qhse-dashboard-page.scss',
})
export class QhseDashboardPage {
  private readonly indicadoresService = inject(DashboardIndicadoresService);
  private readonly metasService = inject(DashboardMetasService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);

  protected readonly categorias = CATEGORIAS;
  protected readonly categoriaIndex = signal(0);
  protected readonly defs = DASHBOARD_KPI_DEFS;
  protected readonly semaforoLabel = SEMAFORO_LABEL;
  protected readonly semaforoTone = SEMAFORO_TONE;

  protected readonly loading = signal(true);
  protected readonly valores = signal<DashboardKpiValues>({});
  protected readonly metas = signal<DashboardMetas>({});
  protected readonly incumplimientoLegal = signal(false);
  protected readonly incumplimientoDetalle = signal<string[]>([]);

  protected readonly metaEdits = signal<Record<string, string>>({});

  // ── Estado operativo — Entrega de EPI y PTW (distinto del reporte por caso: acá es agregado y accionable) ──
  protected readonly ptwFaseLabels = PTW_FASE_LABELS;
  protected readonly ptwDiasSinActividadAlerta = PTW_DIAS_SIN_ACTIVIDAD_ALERTA;
  protected readonly epiEstadoLabels = EPI_ESTADO_LABELS;
  private readonly indicadores = signal<IndicadoresTablero | null>(null);

  protected readonly entregasEpiTotal = computed(() => this.indicadores()?.epi.total ?? 0);

  protected readonly entregasEpiPorEstado = computed(() =>
    (this.indicadores()?.epi.porEstado ?? []).map(e => ({
      estado: e.estado,
      label: EPI_ESTADO_LABELS[e.estado as EpiEstado],
      tone: EPI_TONE[e.estado as EpiEstado],
      count: e.cantidad,
    })),
  );

  /** Entregas «solicitado»: lo que QHSE tiene pendiente de aprobar o rechazar hoy. */
  protected readonly entregasEpiAtencion = computed<AtencionItem[]>(() =>
    (this.indicadores()?.epi.pendientes ?? []).map(e => ({
      id: e.id,
      code: e.codigo,
      titulo: e.cargo ? `${e.trabajador} — ${e.cargo}` : e.trabajador,
      estado: 'Solicitado',
      tone: 'warning' as DynadrillTagVariant,
    })),
  );

  protected readonly ptwAbiertosTotal = computed(() => this.indicadores()?.ptw.abiertos ?? 0);

  protected readonly ptwPorFase = computed(() =>
    PTW_FASE_ORDER.map(fase => ({
      fase,
      label: PTW_FASE_LABELS[fase],
      tone: PTW_FASE_TONE[fase],
      count: this.indicadores()?.ptw.porFase.find(f => f.fase === fase)?.cantidad ?? 0,
    })),
  );

  /** PTW abiertos sin actividad reciente: señal de gestión (no un plazo legal) para saber a cuáles hacerles seguimiento. */
  protected readonly ptwAtencion = computed<AtencionItem[]>(() =>
    (this.indicadores()?.ptw.estancados ?? []).map(p => ({
      id: p.id,
      code: p.codigo,
      titulo: p.pedido,
      estado: `${p.diasSinActividad} días sin actividad`,
      detalle: `Fase: ${PTW_FASE_LABELS[p.fase]}`,
      tone: 'warning' as DynadrillTagVariant,
    })),
  );

  protected verEpi(): void {
    this.router.navigate(['/dashboard/qhse/epi']);
  }

  protected verPtw(_id: string): void {
    this.router.navigate(['/dashboard/qhse/ptw']);
  }

  protected defsPorCategoria(categoria: DashboardKpiCategoria): DashboardKpiDef[] {
    return this.defs.filter(d => d.categoria === categoria);
  }

  protected estadoKpi(def: DashboardKpiDef): { texto: string; tone: DynadrillTagVariant } {
    if (!def.disponible) return { texto: 'No disponible', tone: 'neutral' };
    const valor = this.valores()[def.id];
    if (valor == null) return { texto: 'Sin datos', tone: 'neutral' };
    const meta = this.metas()[def.id];
    if (meta == null) return { texto: 'Sin meta definida', tone: 'info' };
    return kpiFueraDeMeta(valor, meta, def.direccion) ? { texto: 'Fuera de meta', tone: 'error' } : { texto: 'En meta', tone: 'success' };
  }

  /**
   * % de la meta alcanzado — no el valor crudo, sino "qué tan cerca está el
   * valor actual de cumplir el objetivo que el equipo definió". null si
   * todavía no hay meta o no hay datos suficientes: sin meta, no hay nada
   * contra qué medir el progreso (a diferencia de un indicador con umbral
   * fijo universal, estas metas las define cada sitio).
   *
   * 'mayor_mejor' (ej. % PTW cerrados): progreso = valor / meta.
   * 'menor_mejor' (ej. tiempo promedio de cierre): progreso = meta / valor
   * — cuanto más bajo el valor respecto a la meta, más cerca (o por
   * encima) del 100%.
   */
  protected metaProgressPercent(def: DashboardKpiDef): number | null {
    const valor = this.valores()[def.id];
    const meta = this.metas()[def.id];
    if (valor == null || meta == null || meta === 0) return null;
    if (def.direccion === 'mayor_mejor') return Math.max(0, (valor / meta) * 100);
    if (valor === 0) return 100;
    return Math.max(0, (meta / valor) * 100);
  }

  /** Ancho de la barra de meta (0–100): el progreso puede pasar de 100 cuando se supera la meta. */
  protected porcentajeBarra(def: DashboardKpiDef): number {
    return Math.min(100, this.metaProgressPercent(def) ?? 0);
  }

  protected readonly indicadoresFueraDeMeta = computed(() => {
    const valores = this.valores();
    const metas = this.metas();
    return this.defs.filter(d => {
      if (!d.disponible) return false;
      const valor = valores[d.id];
      const meta = metas[d.id];
      return valor != null && meta != null && kpiFueraDeMeta(valor, meta, d.direccion);
    }).length;
  });

  protected readonly semaforo = computed<SemaforoColor>(() => evaluarSemaforo(this.indicadoresFueraDeMeta(), this.incumplimientoLegal()));

  constructor() {
    forkJoin({ datos: this.indicadoresService.obtener(), metas: this.metasService.get() }).subscribe({
      next: ({ datos, metas }) => {
        this.indicadores.set(datos);
        this.valores.set(datos.valores);
        this.incumplimientoLegal.set(datos.incumplimientoLegal.length > 0);
        this.incumplimientoDetalle.set(datos.incumplimientoLegal);
        this.metas.set(metas);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el tablero HSE.');
      },
    });
  }

  protected metaEdit(id: string): string {
    const edits = this.metaEdits();
    if (id in edits) return edits[id];
    const meta = this.metas()[id];
    return meta != null ? meta.toString() : '';
  }

  protected setMetaEdit(id: string, value: string): void {
    this.metaEdits.set({ ...this.metaEdits(), [id]: value });
  }

  /** true mientras el campo tiene un valor sin guardar (distinto al último guardado) — habilita el "Cancelar". */
  protected metaEditDirty(id: string): boolean {
    return id in this.metaEdits();
  }

  protected cancelarMetaEdit(id: string): void {
    const { [id]: _removed, ...rest } = this.metaEdits();
    this.metaEdits.set(rest);
  }

  protected guardarMeta(id: string): void {
    const raw = this.metaEdit(id).trim();
    const value = Number(raw);
    if (!raw || Number.isNaN(value)) return;
    this.metasService.update({ [id]: value }).subscribe({
      next: metas => {
        this.metas.set(metas);
        // Sin esto, metaEditDirty(id) seguía dando true tras guardar con éxito — el link
        // "Cancelar" quedaba mostrado permanentemente junto a un KPI que ya estaba guardado.
        this.cancelarMetaEdit(id);
        this.notify.success('Meta guardada', 'El semáforo se recalculó con la nueva meta.');
      },
      error: () => this.notify.error('Error', 'No se pudo guardar la meta.'),
    });
  }
}
