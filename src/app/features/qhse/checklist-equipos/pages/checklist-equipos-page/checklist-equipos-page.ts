import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ChecklistEquiposService } from '../../services/checklist-equipos.service';
import { ChecklistEquipo } from '../../models/checklist-equipo.model';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';
interface Badge {
  text: string;
  tone: BadgeTone;
}

const BADGE_POR_ESTADO: Record<ChecklistEquipo['estado'], Badge> = {
  pendiente: { text: 'Pendiente', tone: 'neutral' },
  cargado: { text: 'Cargado — a revisar', tone: 'warning' },
  aprobado: { text: 'Aprobado', tone: 'success' },
  rechazado: { text: 'Rechazado', tone: 'error' },
};

/**
 * Bandeja QHSE del checklist de equipos — Fase 4, PLAN-QHSE-PUMPING-NOTIFICACIONES.
 * Filtra por defecto a "cargado" (lo que QHSE tiene que revisar), con
 * opción de ver todos. El motivo de rechazo se escribe inline por fila —
 * sin diálogo aparte, mismo criterio de simplicidad que "Documentos por pedido".
 */
@Component({
  selector: 'app-checklist-equipos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillTextComponent,
  ],
  templateUrl: './checklist-equipos-page.html',
  styleUrl: './checklist-equipos-page.scss',
})
export class ChecklistEquiposPage {
  private readonly service = inject(ChecklistEquiposService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly casos = signal<ChecklistEquipo[]>([]);
  protected readonly soloPorRevisar = signal(true);
  protected readonly motivoPorId = signal<Record<number, string>>({});
  protected readonly submittingId = signal<number | null>(null);
  protected readonly ticketIdAbrir = signal<number | null>(null);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'pumpingTicketId', header: 'Ticket', sortable: true, searchable: true },
    { key: 'equipoNombre', header: 'Equipo', sortable: true, searchable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
    { key: 'cargadoPor', header: 'Cargado por' },
  ];

  protected readonly rows = computed(() =>
    this.casosFiltrados().map(c => ({
      id: c.id,
      pumpingTicketId: c.pumpingTicketId,
      equipoNombre: c.equipoNombre,
      estadoBadge: BADGE_POR_ESTADO[c.estado],
      cargadoPor: c.cargadoPor ?? '—',
      caso: c,
    })),
  );

  private readonly casosFiltrados = computed(() => (this.soloPorRevisar() ? this.casos().filter(c => c.estado === 'cargado') : this.casos()));

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.service.listar().subscribe({
      next: casos => {
        this.casos.set(casos);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggleFiltro(): void {
    this.soloPorRevisar.update(v => !v);
  }

  protected abrirParaTicket(): void {
    const ticketId = this.ticketIdAbrir();
    if (!ticketId) return;
    this.service.abrir(ticketId).subscribe({
      next: () => {
        this.notify.success('Checklist abierto', `Se abrieron los casos pendientes del ticket ${ticketId}.`);
        this.ticketIdAbrir.set(null);
        this.cargar();
      },
      error: () => this.notify.error('Error', `No se pudo abrir el checklist del ticket ${ticketId}.`),
    });
  }

  protected motivoDe(id: number): string {
    return this.motivoPorId()[id] ?? '';
  }

  protected setMotivo(id: number, valor: string): void {
    this.motivoPorId.update(m => ({ ...m, [id]: valor }));
  }

  protected descargar(id: number): void {
    this.service.descargar(id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el documento.'),
    });
  }

  protected aprobar(caso: ChecklistEquipo): void {
    this.submittingId.set(caso.id);
    this.service.aprobar(caso.id).subscribe({
      next: () => {
        this.submittingId.set(null);
        this.notify.success('Aprobado', `Checklist de ${caso.equipoNombre} aprobado.`);
        this.cargar();
      },
      error: () => {
        this.submittingId.set(null);
        this.notify.error('Error', 'No se pudo aprobar el checklist.');
      },
    });
  }

  protected rechazar(caso: ChecklistEquipo): void {
    const motivo = this.motivoDe(caso.id).trim();
    if (!motivo) {
      this.notify.error('Motivo requerido', 'Escribí el motivo del rechazo antes de confirmar.');
      return;
    }
    this.submittingId.set(caso.id);
    this.service.rechazar(caso.id, motivo).subscribe({
      next: () => {
        this.submittingId.set(null);
        this.notify.success('Rechazado', `Checklist de ${caso.equipoNombre} rechazado.`);
        this.setMotivo(caso.id, '');
        this.cargar();
      },
      error: () => {
        this.submittingId.set(null);
        this.notify.error('Error', 'No se pudo rechazar el checklist.');
      },
    });
  }
}
