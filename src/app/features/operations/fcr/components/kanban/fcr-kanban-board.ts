import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DynadrillIconButtonComponent, DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import { FCR_PHASE_LABELS, type FcrPhase, type FcrTicket } from '../../models/fcr.model';
import {
  FCR_BOARD_PAGE_SIZE,
  FCR_BOARD_PHASES,
  FCR_SERVICE_ONLY_PHASES,
  fcrBoardPhases,
  fcrRolePhases,
  fcrTicketRelation,
} from '../../models/fcr-flow';
import { FCR_STAGE_COLORS } from '../../models/fcr-stage-colors';
import { FcrKanbanCard } from './fcr-kanban-card';

/** Etiquetas cortas para las pestañas del tablero en móvil. */
const SHORT_LABELS: Partial<Record<FcrPhase, string>> = {
  preparacion_herramientas: 'Prep. herramientas',
  aprobacion_supervisor_operaciones: 'Aprob. Sup. Oper.',
  asignacion: 'Asignación',
  ejecucion_operativa: 'Ejecución',
  revision_reportes: 'Revisión reportes',
};

const SWIPE_MIN_PX = 60;
/** Ancho de una columna + separación (ver `.column` y `.board` en el scss). */
const COLUMN_STEP_PX = 256 + 12;
/** Tolerancia para considerar que el scroll llegó al borde (subpíxeles). */
const EDGE_TOLERANCE_PX = 2;

interface BoardItem {
  ticket: FcrTicket;
  turno: boolean;
}

interface BoardColumn {
  phase: FcrPhase;
  label: string;
  shortLabel: string;
  accent: string;
  onAccent: string;
  mine: boolean;
  serviceOnly: boolean;
  items: BoardItem[];
  /** Tickets de la página actual (`items` conserva el total para el conteo del encabezado). */
  pageItems: BoardItem[];
}

interface UpcomingGroup {
  phase: FcrPhase;
  label: string;
  count: number;
}

/**
 * Tablero Kanban de tickets FCR: una columna por etapa del proceso.
 * Escritorio: columnas con scroll horizontal (y vertical por columna).
 * Móvil: una etapa a la vez, con pestañas, flechas y deslizamiento.
 * Recibe los tickets ya filtrados — no filtra por sí mismo, salvo "Mis etapas".
 */
@Component({
  selector: 'app-fcr-kanban-board',
  imports: [NgTemplateOutlet, FcrKanbanCard, DynadrillTagComponent, DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fcr-kanban-board.html',
  styleUrl: './fcr-kanban-board.scss',
})
export class FcrKanbanBoard {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tickets = input.required<FcrTicket[]>();
  readonly roleName = input.required<string>();
  /** Muestra solo las etapas del rol, con el resumen de lo que "llega pronto". */
  readonly soloMisEtapas = input(false);
  readonly mobile = input(false);
  /** Página del tablero (1-based) — la controla la página, junto a los filtros. */
  readonly page = input(1);

  readonly summary = output<FcrTicket>();
  readonly history = output<FcrTicket>();
  readonly open = output<FcrTicket>();

  private readonly myPhases = computed(() => fcrRolePhases(this.roleName()));

  private readonly allColumns = computed<Omit<BoardColumn, 'pageItems'>[]>(() => {
    const mine = this.myPhases();
    const role = this.roleName();
    return fcrBoardPhases(role, this.soloMisEtapas()).map(phase => ({
      phase,
      label: FCR_PHASE_LABELS[phase],
      shortLabel: SHORT_LABELS[phase] ?? FCR_PHASE_LABELS[phase],
      ...FCR_STAGE_COLORS[phase],
      mine: mine.has(phase),
      serviceOnly: FCR_SERVICE_ONLY_PHASES.has(phase),
      items: this.tickets()
        .filter(t => t.currentPhase === phase)
        .map(ticket => ({ ticket, turno: fcrTicketRelation(ticket, role) === 'turno' })),
    }));
  });

  protected readonly columns = computed<BoardColumn[]>(() => {
    const start = (this.page() - 1) * FCR_BOARD_PAGE_SIZE;
    return this.allColumns().map(c => ({ ...c, pageItems: c.items.slice(start, start + FCR_BOARD_PAGE_SIZE) }));
  });

  /** Tickets en etapas anteriores que todavía van a pasar por una etapa del rol — para planificar. */
  protected readonly upcoming = computed<UpcomingGroup[]>(() => {
    const role = this.roleName();
    const counts = new Map<FcrPhase, number>();
    for (const t of this.tickets()) {
      if (fcrTicketRelation(t, role) === 'proxima') counts.set(t.currentPhase, (counts.get(t.currentPhase) ?? 0) + 1);
    }
    return FCR_BOARD_PHASES.filter(p => counts.has(p)).map(phase => ({ phase, label: FCR_PHASE_LABELS[phase], count: counts.get(phase) ?? 0 }));
  });
  protected readonly upcomingTotal = computed(() => this.upcoming().reduce((sum, g) => sum + g.count, 0));

  // ── Móvil: una etapa a la vez ──

  private readonly selectedPhase = signal<FcrPhase | null>(null);

  protected readonly activeIndex = computed(() => {
    const cols = this.columns();
    const selected = this.selectedPhase();
    const byUser = cols.findIndex(c => c.phase === selected);
    if (byUser >= 0) return byUser;
    // Por defecto: la primera etapa del rol con trabajo; si no, la primera con tickets.
    const mineWithWork = cols.findIndex(c => c.mine && c.items.length > 0);
    if (mineWithWork >= 0) return mineWithWork;
    return Math.max(0, cols.findIndex(c => c.items.length > 0));
  });
  /** `undefined` solo si no hay columnas (p. ej. "Mis etapas" con un rol sin etapas en FCR). */
  protected readonly activeColumn = computed<BoardColumn | undefined>(() => this.columns()[this.activeIndex()]);

  protected select(phase: FcrPhase): void {
    this.selectedPhase.set(phase);
    requestAnimationFrame(() =>
      this.host.nativeElement.querySelector('.tab--active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }),
    );
  }

  protected step(delta: number): void {
    const next = this.columns()[this.activeIndex() + delta];
    if (next) this.select(next.phase);
  }

  private touchStartX: number | null = null;

  protected onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.clientX ?? null;
  }

  protected onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null) return;
    const dx = (event.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
    this.touchStartX = null;
    if (Math.abs(dx) >= SWIPE_MIN_PX) this.step(dx < 0 ? 1 : -1);
  }

  // ── Escritorio: flechas a los costados (solo si hay columnas ocultas en ese sentido) ──

  private readonly boardRef = viewChild<ElementRef<HTMLElement>>('board');
  protected readonly canScrollLeft = signal(false);
  protected readonly canScrollRight = signal(false);

  constructor() {
    // Las columnas cambian con los filtros / "Mis etapas": recalcular después de que se pinten.
    effect(() => {
      this.columns();
      this.boardRef();
      requestAnimationFrame(() => this.updateScrollState());
    });
    const resize = new ResizeObserver(() => this.updateScrollState());
    afterNextRender(() => resize.observe(this.host.nativeElement));
    inject(DestroyRef).onDestroy(() => resize.disconnect());
  }

  protected updateScrollState(): void {
    const el = this.boardRef()?.nativeElement;
    if (!el) {
      this.canScrollLeft.set(false);
      this.canScrollRight.set(false);
      return;
    }
    this.canScrollLeft.set(el.scrollLeft > EDGE_TOLERANCE_PX);
    this.canScrollRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_TOLERANCE_PX);
  }

  protected scrollColumns(direction: 1 | -1): void {
    this.boardRef()?.nativeElement.scrollBy({ left: direction * COLUMN_STEP_PX, behavior: 'smooth' });
  }
}
