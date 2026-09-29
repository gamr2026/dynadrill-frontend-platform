import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DynadrillIconButtonComponent, DynadrillTagComponent } from '@digitec-it-projects/dynadrill-ui';
import { FCR_PHASE_LABELS, type FcrPhase, type FcrTicket } from '../../models/fcr.model';
import { FCR_BOARD_PHASES, FCR_SERVICE_ONLY_PHASES, fcrRolePhases, fcrTicketRelation } from '../../models/fcr-flow';
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

  readonly summary = output<FcrTicket>();
  readonly history = output<FcrTicket>();
  readonly open = output<FcrTicket>();

  private readonly myPhases = computed(() => fcrRolePhases(this.roleName()));

  protected readonly columns = computed<BoardColumn[]>(() => {
    const mine = this.myPhases();
    const role = this.roleName();
    const phases = this.soloMisEtapas() ? FCR_BOARD_PHASES.filter(p => mine.has(p)) : FCR_BOARD_PHASES;
    return phases.map(phase => ({
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

  protected readonly myColumns = computed(() => this.columns().filter(c => c.mine));

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

  // ── Escritorio: "Ir a" una etapa del rol ──

  protected scrollToPhase(phase: FcrPhase): void {
    this.host.nativeElement
      .querySelector(`[data-phase="${phase}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }
}
