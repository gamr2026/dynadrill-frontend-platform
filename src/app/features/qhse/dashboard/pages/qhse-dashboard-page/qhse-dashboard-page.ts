import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillProgressComponent,
  type DynadrillProgressStatus,
  DynadrillScreenHeaderComponent,
  DynadrillStatisticComponent,
  type DynadrillStatisticTone,
  DynadrillTabsComponent,
  type DynadrillTab,
  DynadrillTagComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
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
import { DashboardMetasService } from '../../services/dashboard-metas.service';
import { IPERC_STATUS_LABELS, IpercMatrix, IpercStatus } from '../../../iperc/models/iperc.model';
import { IpercService } from '../../../iperc/services/iperc.service';
import { PTW_FASE_LABELS, PTW_FASE_ORDER, PtwFase, PtwMatrix, ptwCerrado } from '../../../ptw/models/ptw.model';
import { PtwService } from '../../../ptw/services/ptw.service';
import { InspeccionEquipoService } from '../../../inspecciones/services/inspeccion-equipo.service';
import { inspeccionVencida } from '../../../inspecciones/models/inspeccion-equipo.model';
import { DesechoService } from '../../../desechos/services/desecho.service';
import { DerrameService } from '../../../derrames/services/derrame.service';
import { derrameRequiereNotificacionMae } from '../../../derrames/models/derrame.model';
import { StopCardService } from '../../../stop/services/stop-card.service';
import { SwaService } from '../../../swa/services/swa.service';
import { InvestigacionService } from '../../../investigaciones/services/investigacion.service';
import { sugiereNotificacionLegal } from '../../../investigaciones/models/investigacion.model';
import { UsersService } from '../../../../users/services/users.service';

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

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

const IPERC_ESTADO_TONE: Record<IpercStatus, DynadrillTagVariant> = {
  borrador: 'neutral',
  en_evaluacion: 'info',
  en_revision: 'warning',
  aprobada: 'success',
  rechazada: 'error',
};

/** Fases "abiertas" agrupadas de forma simple para el mini-resumen — el detalle fase por fase ya vive en la bandeja de PTW. */
const PTW_FASE_TONE: Record<PtwFase, DynadrillTagVariant> = {
  gabinete: 'neutral',
  ingreso: 'info',
  verificaciones: 'warning',
  formalizacion: 'warning',
  ejecucion: 'info',
  gestion_documental: 'info',
};

/** A partir de cuántos días sin actualizarse un PTW abierto se considera "estancado" — no es un plazo legal, es un umbral de gestión para que alguien lo revise. */
const PTW_DIAS_SIN_ACTIVIDAD_ALERTA = 3;

interface AtencionItem {
  id: number;
  code: string;
  titulo: string;
  motivo: string;
  tone: DynadrillTagVariant;
}

/** HSE-MASTER-001 — Dashboard Integrado del Sistema: cierra el ciclo PDCA agregando los 16 indicadores estratégicos de las 4 fases ya construidas, con semáforo de cumplimiento configurable por metas. */
@Component({
  selector: 'app-qhse-dashboard-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillTagComponent,
    DynadrillStatisticComponent,
    DynadrillProgressComponent,
    DynadrillTabsComponent,
    DynadrillInputComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qhse-dashboard-page.html',
  styleUrl: './qhse-dashboard-page.scss',
})
export class QhseDashboardPage {
  private readonly ipercService = inject(IpercService);
  private readonly ptwService = inject(PtwService);
  private readonly inspeccionService = inject(InspeccionEquipoService);
  private readonly desechoService = inject(DesechoService);
  private readonly derrameService = inject(DerrameService);
  private readonly stopService = inject(StopCardService);
  private readonly swaService = inject(SwaService);
  private readonly investigacionService = inject(InvestigacionService);
  private readonly usersService = inject(UsersService);
  private readonly metasService = inject(DashboardMetasService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);

  protected readonly categorias = CATEGORIAS;
  protected readonly categoriaTabs: DynadrillTab[] = CATEGORIAS.map(label => ({ label }));
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

  // ── Estado operativo — IPERC y PTW (distinto del reporte por matriz: acá es agregado y accionable, no el detalle de un solo caso) ──
  protected readonly ipercStatusLabels = IPERC_STATUS_LABELS;
  protected readonly ptwFaseLabels = PTW_FASE_LABELS;
  protected readonly ptwDiasSinActividadAlerta = PTW_DIAS_SIN_ACTIVIDAD_ALERTA;
  private readonly matricesRaw = signal<IpercMatrix[]>([]);
  private readonly ptwRaw = signal<PtwMatrix[]>([]);

  protected readonly matricesRawTotal = computed(() => this.matricesRaw().length);

  protected readonly matricesPorEstado = computed(() => {
    const all = this.matricesRaw();
    return (Object.keys(IPERC_STATUS_LABELS) as IpercStatus[]).map(estado => ({
      estado,
      label: IPERC_STATUS_LABELS[estado],
      tone: IPERC_ESTADO_TONE[estado],
      count: all.filter(m => m.status === estado).length,
    }));
  });

  /** Matrices que alguien tiene que revisar hoy: rechazadas, esperando aprobación, o con una lección aprendida sin cerrar el ciclo. */
  protected readonly matricesAtencion = computed<AtencionItem[]>(() => {
    const items: AtencionItem[] = [];
    for (const m of this.matricesRaw()) {
      if (m.status === 'rechazada') {
        items.push({ id: m.id, code: m.code, titulo: m.actividad, motivo: 'Rechazada — pendiente de corregir', tone: 'error' });
      } else if (m.status === 'en_revision') {
        items.push({ id: m.id, code: m.code, titulo: m.actividad, motivo: 'En revisión — pendiente de aprobar', tone: 'warning' });
      }
      if (m.leccionAprendidaPendiente) {
        items.push({ id: m.id, code: m.code, titulo: m.actividad, motivo: 'Lección aprendida pendiente de revisar', tone: 'warning' });
      }
    }
    return items;
  });

  protected readonly ptwAbiertosTotal = computed(() => this.ptwRaw().filter(p => !ptwCerrado(p)).length);

  protected readonly ptwPorFase = computed(() => {
    const abiertos = this.ptwRaw().filter(p => !ptwCerrado(p));
    return PTW_FASE_ORDER.map(fase => ({
      fase,
      label: PTW_FASE_LABELS[fase],
      tone: PTW_FASE_TONE[fase],
      count: abiertos.filter(p => p.fase === fase).length,
    }));
  });

  /** PTW abiertos sin ninguna actualización reciente — señal de gestión, no un plazo legal, para saber a cuáles hacerles seguimiento. */
  protected readonly ptwAtencion = computed<AtencionItem[]>(() => {
    const ahora = Date.now();
    return this.ptwRaw()
      .filter(p => !ptwCerrado(p))
      .map(p => ({ p, dias: Math.floor((ahora - new Date(p.updatedAt).getTime()) / 86_400_000) }))
      .filter(({ dias }) => dias >= PTW_DIAS_SIN_ACTIVIDAD_ALERTA)
      .sort((a, b) => b.dias - a.dias)
      .map(({ p, dias }) => ({
        id: p.id,
        code: p.code,
        titulo: p.actividad,
        motivo: `Sin actividad hace ${dias} días — Fase: ${PTW_FASE_LABELS[p.fase]}`,
        tone: 'warning' as DynadrillTagVariant,
      }));
  });

  protected verIperc(id: number): void {
    this.router.navigate(['/dashboard/qhse/iperc', id]);
  }

  protected verPtw(id: number): void {
    this.router.navigate(['/dashboard/qhse/ptw', id]);
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

  /** dynadrill-statistic solo entiende default/success/warning/error — colapsa 'info'/'neutral' del semáforo de estadoKpi() a 'default'. */
  protected statTone(def: DashboardKpiDef): DynadrillStatisticTone {
    const tone = this.estadoKpi(def).tone;
    return tone === 'success' || tone === 'error' ? tone : 'default';
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

  protected metaProgressStatus(def: DashboardKpiDef): DynadrillProgressStatus {
    const tone = this.estadoKpi(def).tone;
    return tone === 'success' ? 'success' : tone === 'error' ? 'exception' : 'normal';
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
    forkJoin({
      matrices: this.ipercService.list(),
      ptw: this.ptwService.list(),
      inspecciones: this.inspeccionService.list(),
      desechos: this.desechoService.list(),
      derrames: this.derrameService.list(),
      stop: this.stopService.list(),
      swa: this.swaService.list(),
      investigaciones: this.investigacionService.list(),
      usuarios: this.usersService.list(),
      metas: this.metasService.get(),
    }).subscribe({
      next: ({ matrices, ptw, inspecciones, desechos, derrames, stop, swa, investigaciones, usuarios, metas }) => {
        const ahora = new Date();
        const detalleLegal: string[] = [];

        // ── Seguridad ──
        const eventosLti = investigaciones.filter(i => i.resultado === 'fatal' || i.resultado === 'grave' || i.resultado === 'leve');
        const ultimoLti = eventosLti.reduce<Date | null>((max, i) => {
          const fecha = new Date(i.fechaIncidente);
          return !max || fecha > max ? fecha : max;
        }, null);
        const diasSinLti = ultimoLti ? Math.floor(daysBetween(ahora, ultimoLti)) : null;

        const nearMiss = investigaciones.filter(i => i.resultado === 'near_miss').length;
        const incidentes = investigaciones.length - nearMiss;
        const ratioNearMiss = incidentes > 0 ? Math.round((nearMiss / incidentes) * 10) / 10 : null;

        // ── Operacional ──
        const ptwCerradosPct = ptw.length > 0 ? Math.round((ptw.filter(ptwCerrado).length / ptw.length) * 100) : null;

        const inspeccionesVigentesPct =
          inspecciones.length > 0 ? Math.round((inspecciones.filter(i => !inspeccionVencida(i)).length / inspecciones.length) * 100) : null;

        const cerrados = ptw.filter(ptwCerrado);
        const ptwTiempoPromDias =
          cerrados.length > 0
            ? Math.round((cerrados.reduce((sum, p) => sum + daysBetween(new Date(p.createdAt), new Date(p.updatedAt)), 0) / cerrados.length) * 10) / 10
            : null;

        const ipercVigentePct =
          ptw.length > 0
            ? Math.round((ptw.filter((p: PtwMatrix) => matrices.find(m => m.id === p.ipercMatrixId)?.status === 'aprobada').length / ptw.length) * 100)
            : null;

        // ── Ambiental ──
        const mesActual = ahora.getMonth();
        const anioActual = ahora.getFullYear();
        const desechosPeligrososKgMes = desechos
          .filter(d => d.clasificacion === 'peligroso')
          .filter(d => {
            const f = new Date(d.createdAt);
            return f.getMonth() === mesActual && f.getFullYear() === anioActual;
          })
          .reduce((sum, d) => sum + d.pesoKg, 0);

        const totalKg = desechos.reduce((sum, d) => sum + d.pesoKg, 0);
        const azulKg = desechos.filter(d => d.contenedorColor === 'azul').reduce((sum, d) => sum + d.pesoKg, 0);
        const reciclajePct = totalKg > 0 ? Math.round((azulKg / totalKg) * 100) : null;

        const hace90Dias = new Date(ahora.getTime() - 90 * 86_400_000);
        const derramesTrimestre = derrames.filter(d => new Date(d.activadoAt) >= hace90Dias).length;
        const derramesMayorYear = derrames.filter(d => d.volumen === 'mayor' && new Date(d.activadoAt).getFullYear() === anioActual).length;

        // ── Cultura Preventiva ──
        const swaEventos = swa.length;
        const usuariosActivos = usuarios.filter(u => u.status).length;
        const stopPerCapita = usuariosActivos > 0 ? Math.round((stop.length / usuariosActivos) * 100) / 100 : null;

        // ── Incumplimiento legal (para el semáforo) ──
        derrames
          .filter(d => d.estado !== 'cerrado' && derrameRequiereNotificacionMae(d) && !d.notificadoMae)
          .forEach(d => detalleLegal.push(`Derrame ${d.code}: notificación al MAE pendiente.`));

        investigaciones
          .filter(i => i.estado === 'abierta' && sugiereNotificacionLegal(i.resultado))
          .filter(i => !i.notificacionLegal.ministerioTrabajoNotificadoAt && !i.notificacionLegal.iessNotificadoAt)
          .filter(i => daysBetween(ahora, new Date(i.fechaIncidente)) * 24 > 24)
          .forEach(i => detalleLegal.push(`Investigación ${i.code}: notificación a Ministerio del Trabajo / IESS vencida (24h).`));

        this.valores.set({
          dias_sin_lti: diasSinLti,
          ratio_near_miss: ratioNearMiss,
          ptw_cerrados_pct: ptwCerradosPct,
          inspecciones_vigentes_pct: inspeccionesVigentesPct,
          ptw_tiempo_prom_dias: ptwTiempoPromDias,
          iperc_vigente_pct: ipercVigentePct,
          desechos_peligrosos_kg_mes: desechosPeligrososKgMes,
          reciclaje_pct: reciclajePct,
          derrames_trimestre: derramesTrimestre,
          derrames_mayor_year: derramesMayorYear,
          swa_eventos: swaEventos,
          stop_per_capita: stopPerCapita,
        });
        this.incumplimientoLegal.set(detalleLegal.length > 0);
        this.incumplimientoDetalle.set(detalleLegal);
        this.metas.set(metas);
        this.matricesRaw.set(matrices);
        this.ptwRaw.set(ptw);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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
    this.metasService.update({ [id]: value }).subscribe(metas => {
      this.metas.set(metas);
      this.notify.success('Meta guardada', 'El semáforo se recalculó con la nueva meta.');
    });
  }
}
