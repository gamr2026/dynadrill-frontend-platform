import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
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
import { IpercService } from '../../../iperc/services/iperc.service';
import { PtwMatrix, ptwCerrado } from '../../../ptw/models/ptw.model';
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

/** HSE-MASTER-001 — Dashboard Integrado del Sistema: cierra el ciclo PDCA agregando los 16 indicadores estratégicos de las 4 fases ya construidas, con semáforo de cumplimiento configurable por metas. */
@Component({
  selector: 'app-qhse-dashboard-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillBannerComponent, DynadrillTagComponent, DynadrillInputComponent, DynadrillButtonComponent],
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
  private readonly metasService = inject(DashboardMetasService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly categorias = CATEGORIAS;
  protected readonly defs = DASHBOARD_KPI_DEFS;
  protected readonly semaforoLabel = SEMAFORO_LABEL;
  protected readonly semaforoTone = SEMAFORO_TONE;

  protected readonly loading = signal(true);
  protected readonly valores = signal<DashboardKpiValues>({});
  protected readonly metas = signal<DashboardMetas>({});
  protected readonly incumplimientoLegal = signal(false);
  protected readonly incumplimientoDetalle = signal<string[]>([]);

  protected readonly metaEdits = signal<Record<string, string>>({});

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
      metas: this.metasService.get(),
    }).subscribe({
      next: ({ matrices, ptw, inspecciones, desechos, derrames, stop, swa, investigaciones }) => {
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
        });
        this.incumplimientoLegal.set(detalleLegal.length > 0);
        this.incumplimientoDetalle.set(detalleLegal);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.metasService.get().subscribe(metas => this.metas.set(metas));
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
