import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCardAccent,
  DynadrillCardComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillTabsComponent,
  DynadrillTagComponent,
  DynadrillTimerComponent,
  type DynadrillKpiRowItem,
  type DynadrillSelectOption,
  type DynadrillTab,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { SWA_ESTADO_LABELS, SwaEvento } from '../../../swa/models/swa.model';
import { SwaService } from '../../../swa/services/swa.service';
import { DERRAME_ESTADO_LABELS, DERRAME_VOLUMEN_LABELS, DerrameEvento } from '../../../derrames/models/derrame.model';
import { DerrameService } from '../../../derrames/services/derrame.service';
import { EMERGENCIA_ESTADO_LABELS, EMERGENCIA_NIVEL_LABELS, EmergenciaEstado, EmergenciaEvento, reporteFlashVencido } from '../../../emergencias/models/emergencia.model';
import { EmergenciaService } from '../../../emergencias/services/emergencia.service';
import {
  accionesPendientes,
  INCIDENTE_RESULTADO_LABELS,
  Investigacion,
  PLAZOS_POR_RESULTADO,
  plazoFinalVencido,
  plazoInicioVencido,
} from '../../../investigaciones/models/investigacion.model';
import { InvestigacionService } from '../../../investigaciones/services/investigacion.service';
import { InvestigacionDialog } from '../../../investigaciones/components/investigacion-dialog';

type EventoTipo = 'swa' | 'derrames' | 'emergencias' | 'investigaciones';

const TABS: DynadrillTab[] = [{ label: 'SWA' }, { label: 'Derrames' }, { label: 'Emergencias' }, { label: 'Investigaciones' }];
const TAB_TIPOS: EventoTipo[] = ['swa', 'derrames', 'emergencias', 'investigaciones'];

/** Cuántas tarjetas se muestran de entrada por pestaña — "Mostrar más" suma otra tanda. */
const PAGE_SIZE = 12;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const SWA_ESTADO_TONE: Record<SwaEvento['estado'], DynadrillTagVariant & DynadrillCardAccent> = {
  activo: 'error',
  evaluado: 'warning',
  cerrado: 'success',
};

const DERRAME_ESTADO_TONE: Record<DerrameEvento['estado'], DynadrillTagVariant & DynadrillCardAccent> = {
  activo: 'error',
  contenido: 'warning',
  cerrado: 'success',
};

const EMERGENCIA_ESTADO_TONE: Record<EmergenciaEstado, DynadrillTagVariant & DynadrillCardAccent> = {
  activa: 'error',
  controlada: 'warning',
  cerrada: 'success',
};

const DOS_HORAS_SEGUNDOS = 2 * 60 * 60;

const TODOS_OPTION: DynadrillSelectOption = { label: 'Todos los estados', value: '' };

/** Filtra por código/ubicación (búsqueda libre) y por estado exacto — misma regla para las 4 pestañas, ya que las 4 tarjetas comparten esos dos campos. */
function filtrar<T extends { code: string; ubicacion: string; estadoLabel: string }>(cards: T[], query: string, estado: string): T[] {
  const q = query.trim().toLowerCase();
  return cards.filter(c => {
    const matchQuery = !q || c.code.toLowerCase().includes(q) || c.ubicacion.toLowerCase().includes(q);
    const matchEstado = !estado || c.estadoLabel === estado;
    return matchQuery && matchEstado;
  });
}

/**
 * Bandeja única para HSE-SEGUIMIENTO-003 (SWA), HSE-AMBIENTAL-002
 * (Derrames), HSE-TRIAGE-001 (Emergencias) y HSE-TRIAGE-002
 * (Investigaciones) — las 4 compartían exactamente el mismo diseño
 * (header + KPIs + grilla de tarjetas) y ocupaban 4 entradas separadas en
 * el sidebar para mostrar, en esencia, la misma pantalla. STOP no entra
 * acá a propósito: es observación preventiva ("Cualquier Trabajador"), no
 * un evento crítico ya ocurrido — sigue con su propia bandeja.
 *
 * Cada pestaña carga su propio servicio y conserva intacta la lógica de
 * KPIs/tarjetas que tenía su página original (incluyendo el cronómetro
 * real del Reporte Flash y el cálculo de plazos de investigación) — lo
 * único que cambió es que ahora viven en un solo lugar en vez de 4 rutas.
 * Los detalles de cada uno siguen siendo páginas separadas: SWA
 * (reanudación con checklist), Derrames (contención), Emergencias
 * (MEDEVAC) e Investigaciones (5 Porqués/Ishikawa) no tienen nada en
 * común una vez que entras al caso puntual.
 *
 * Buscador + filtro de estado + "Mostrar más" son compartidos entre las 4
 * pestañas (mismo estado, se resetea al cambiar de pestaña) — pensado
 * para cuando esto crezca a decenas de tarjetas por tipo; el header de
 * cada tarjeta ahora solo lleva el estado (antes llevaba 2-3 tags junto
 * al código y lo truncaba en códigos largos — los tags secundarios
 * bajaron al cuerpo de la tarjeta).
 */
@Component({
  selector: 'app-eventos-criticos-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillTabsComponent,
    DynadrillKpiRowComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillTimerComponent,
    DynadrillButtonComponent,
    DynadrillBannerComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './eventos-criticos-list-page.html',
  styleUrl: './eventos-criticos-list-page.scss',
})
export class EventosCriticosListPage {
  private readonly swaService = inject(SwaService);
  private readonly derrameService = inject(DerrameService);
  private readonly emergenciaService = inject(EmergenciaService);
  private readonly investigacionService = inject(InvestigacionService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly router = inject(Router);

  protected readonly tabs = TABS;
  protected readonly activeIndex = signal(0);
  protected readonly activeTipo = computed<EventoTipo>(() => TAB_TIPOS[this.activeIndex()]);

  protected readonly loading = signal(true);

  // ── Búsqueda, filtro de estado y paginación — compartidos entre pestañas ──
  protected readonly searchText = signal('');
  protected readonly estadoFiltro = signal('');
  protected readonly visibleCount = signal(PAGE_SIZE);

  private readonly swaEventos = signal<SwaEvento[]>([]);
  private readonly derrameEventos = signal<DerrameEvento[]>([]);
  private readonly emergenciaEventos = signal<EmergenciaEvento[]>([]);
  private readonly investigaciones = signal<Investigacion[]>([]);

  // ── SWA ──
  protected readonly swaKpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.swaEventos();
    return [
      { label: 'Total eventos', value: all.length },
      { label: 'Trabajo detenido', value: all.filter(e => e.estado === 'activo').length },
      { label: 'En evaluación', value: all.filter(e => e.estado === 'evaluado').length },
      { label: 'Reconocidos "Héroe de Seguridad"', value: all.filter(e => e.heroeSeguridad).length },
    ];
  });

  protected readonly swaCards = computed(() =>
    this.swaEventos().map(e => ({
      id: e.id,
      code: e.code,
      tipoPeligro: e.tipoPeligro,
      ubicacion: e.ubicacion || '—',
      activadoPorNombre: e.activadoPorNombre,
      activadoAt: formatDateTime(e.activadoAt),
      estadoLabel: SWA_ESTADO_LABELS[e.estado],
      accent: SWA_ESTADO_TONE[e.estado],
      heroeSeguridad: e.heroeSeguridad,
    })),
  );

  // ── Derrames ──
  protected readonly derrameKpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.derrameEventos();
    return [
      { label: 'Total eventos', value: all.length },
      { label: 'Activos', value: all.filter(e => e.estado === 'activo').length },
      { label: 'Mayores', value: all.filter(e => e.volumen === 'mayor').length },
      { label: 'Notificados a MAE', value: all.filter(e => e.notificadoMae).length },
    ];
  });

  protected readonly derrameCards = computed(() =>
    this.derrameEventos().map(e => ({
      id: e.id,
      code: e.code,
      descripcion: e.descripcion,
      ubicacion: e.ubicacionFisica || '—',
      volumenLabel: DERRAME_VOLUMEN_LABELS[e.volumen],
      esMayor: e.volumen === 'mayor',
      activadoAt: formatDateTime(e.activadoAt),
      estadoLabel: DERRAME_ESTADO_LABELS[e.estado],
      accent: DERRAME_ESTADO_TONE[e.estado],
      notificadoMae: e.notificadoMae,
    })),
  );

  // ── Emergencias ──
  protected readonly emergenciaKpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.emergenciaEventos();
    return [
      { label: 'Total emergencias', value: all.length },
      { label: 'Activas', value: all.filter(e => e.estado === 'activa').length },
      { label: 'Nivel 3 (mayor)', value: all.filter(e => e.nivel === 3).length },
      { label: 'Reporte Flash vencido', value: all.filter(e => reporteFlashVencido(e)).length },
    ];
  });

  protected readonly emergenciaCards = computed(() =>
    this.emergenciaEventos().map(e => {
      const flashVencido = reporteFlashVencido(e);
      const flashEmitido = !!e.reporteFlash.emitidoAt;

      const flashSegundosRestantes =
        !flashEmitido && !flashVencido
          ? Math.max(0, DOS_HORAS_SEGUNDOS - Math.floor((Date.now() - new Date(e.activadoAt).getTime()) / 1000))
          : null;

      return {
        id: e.id,
        code: e.code,
        tipo: e.tipo,
        nivelLabel: e.nivel ? EMERGENCIA_NIVEL_LABELS[e.nivel] : 'Sin declarar',
        ubicacion: e.ubicacion || '—',
        activadoAt: formatDateTime(e.activadoAt),
        estadoLabel: EMERGENCIA_ESTADO_LABELS[e.estado],
        accent: EMERGENCIA_ESTADO_TONE[e.estado],
        flashLabel: flashEmitido ? 'Reporte Flash emitido' : flashVencido ? 'Reporte Flash vencido' : null,
        flashSegundosRestantes,
      };
    }),
  );

  // ── Investigaciones ──
  protected readonly investigacionKpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.investigaciones();
    return [
      { label: 'Total', value: all.length },
      { label: 'Abiertas', value: all.filter(i => i.estado === 'abierta').length },
      { label: 'Plazo vencido', value: all.filter(i => plazoInicioVencido(i) || plazoFinalVencido(i)).length },
      { label: 'Acciones pendientes', value: all.reduce((sum, i) => sum + accionesPendientes(i.acciones), 0) },
    ];
  });

  protected readonly investigacionCards = computed(() =>
    this.investigaciones().map(i => {
      const vencida = i.estado === 'abierta' && (plazoInicioVencido(i) || plazoFinalVencido(i));
      const accent: DynadrillTagVariant & DynadrillCardAccent = i.estado === 'cerrada' ? 'success' : vencida ? 'error' : 'warning';

      const diasRestantes =
        i.estado === 'abierta' && !vencida
          ? Math.max(
              0,
              Math.ceil(
                (new Date(i.fechaIncidente).getTime() + PLAZOS_POR_RESULTADO[i.resultado].finalDias * 86_400_000 - Date.now()) / 86_400_000,
              ),
            )
          : null;

      const plazoLabel = i.estado === 'cerrada' ? 'Cerrada' : vencida ? 'Plazo vencido' : `${diasRestantes} días restantes`;

      return {
        id: i.id,
        code: i.code,
        resultadoLabel: INCIDENTE_RESULTADO_LABELS[i.resultado],
        ubicacion: i.ubicacion || '—',
        fechaIncidente: formatDate(i.fechaIncidente),
        estadoLabel: i.estado === 'abierta' ? 'Abierta' : 'Cerrada',
        accent,
        plazoLabel,
        accionesPendientes: accionesPendientes(i.acciones),
      };
    }),
  );

  // ── Opciones de filtro por estado, según la pestaña activa ──
  protected readonly estadoOptions = computed<DynadrillSelectOption[]>(() => {
    const labels =
      this.activeTipo() === 'swa'
        ? Object.values(SWA_ESTADO_LABELS)
        : this.activeTipo() === 'derrames'
          ? Object.values(DERRAME_ESTADO_LABELS)
          : this.activeTipo() === 'emergencias'
            ? Object.values(EMERGENCIA_ESTADO_LABELS)
            : ['Abierta', 'Cerrada'];
    return [TODOS_OPTION, ...labels.map(l => ({ label: l, value: l }))];
  });

  // ── Tarjetas filtradas + paginadas por pestaña ──
  protected readonly swaVisible = computed(() => filtrar(this.swaCards(), this.searchText(), this.estadoFiltro()).slice(0, this.visibleCount()));
  protected readonly swaFilteredTotal = computed(() => filtrar(this.swaCards(), this.searchText(), this.estadoFiltro()).length);

  protected readonly derrameVisible = computed(() =>
    filtrar(this.derrameCards(), this.searchText(), this.estadoFiltro()).slice(0, this.visibleCount()),
  );
  protected readonly derrameFilteredTotal = computed(() => filtrar(this.derrameCards(), this.searchText(), this.estadoFiltro()).length);

  protected readonly emergenciaVisible = computed(() =>
    filtrar(this.emergenciaCards(), this.searchText(), this.estadoFiltro()).slice(0, this.visibleCount()),
  );
  protected readonly emergenciaFilteredTotal = computed(() => filtrar(this.emergenciaCards(), this.searchText(), this.estadoFiltro()).length);

  protected readonly investigacionVisible = computed(() =>
    filtrar(this.investigacionCards(), this.searchText(), this.estadoFiltro()).slice(0, this.visibleCount()),
  );
  protected readonly investigacionFilteredTotal = computed(() =>
    filtrar(this.investigacionCards(), this.searchText(), this.estadoFiltro()).length,
  );

  protected readonly mostrandoTodo = computed(() => {
    const total =
      this.activeTipo() === 'swa'
        ? this.swaFilteredTotal()
        : this.activeTipo() === 'derrames'
          ? this.derrameFilteredTotal()
          : this.activeTipo() === 'emergencias'
            ? this.emergenciaFilteredTotal()
            : this.investigacionFilteredTotal();
    return this.visibleCount() >= total;
  });

  constructor() {
    forkJoin({
      swa: this.swaService.list(),
      derrames: this.derrameService.list(),
      emergencias: this.emergenciaService.list(),
      investigaciones: this.investigacionService.list(),
    }).subscribe({
      next: r => {
        this.swaEventos.set(r.swa);
        this.derrameEventos.set(r.derrames);
        this.emergenciaEventos.set(r.emergencias);
        this.investigaciones.set(r.investigaciones);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los eventos críticos.');
      },
    });
  }

  /** Cambiar de pestaña resetea búsqueda/filtro/paginación — cada tipo tiene sus propios estados y no tendría sentido arrastrar el filtro de uno a otro. */
  protected selectTab(index: number): void {
    this.activeIndex.set(index);
    this.searchText.set('');
    this.estadoFiltro.set('');
    this.visibleCount.set(PAGE_SIZE);
  }

  protected setSearchText(value: string): void {
    this.searchText.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected setEstadoFiltro(value: string): void {
    this.estadoFiltro.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected mostrarMas(): void {
    this.visibleCount.update(v => v + PAGE_SIZE);
  }

  protected viewDetail(id: number): void {
    this.router.navigate(['/dashboard/qhse', this.activeTipo(), id]);
  }

  /**
   * Única vía de creación directa — hasta ahora solo existía
   * abrirInvestigacion() en Emergencia Nivel 2/3 (emergencia-detail-page.ts),
   * así que sin una Emergencia formal era imposible abrir una investigación
   * (HSE-TRIAGE-002 sí lo permite: daño material significativo o Near Miss
   * de alto potencial).
   */
  protected nuevaInvestigacion(): void {
    const ref = this.dialogService.open<InvestigacionDialog>({ title: 'Nueva investigación', content: InvestigacionDialog, footer: false });
    ref.afterClose.subscribe(inv => {
      if (inv) this.router.navigate(['/dashboard/qhse/investigaciones', inv.id]);
    });
  }
}
