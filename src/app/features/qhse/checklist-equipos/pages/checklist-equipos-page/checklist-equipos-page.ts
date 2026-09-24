import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { ChecklistEquiposService } from '../../services/checklist-equipos.service';
import { ChecklistEquipo } from '../../models/checklist-equipo.model';
import { MotivoDialog, MotivoDialogData } from '../../../../../shared/components/motivo-dialog/motivo-dialog';

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

type Filtro = 'por_revisar' | 'aprobado' | 'rechazado' | 'todos';

/**
 * Bandeja QHSE del checklist de equipos — Fase 4, PLAN-QHSE-PUMPING-NOTIFICACIONES.
 * Filtra por defecto a "por revisar" (lo que QHSE tiene que atender), con
 * una pestaña "Aprobados" como historial. El motivo de rechazo se escribe
 * inline solo cuando se hace clic en "Rechazar" — no queda un input suelto
 * en cada fila.
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
  private readonly dialogService = inject(DynadrillDialogService);

  protected readonly loading = signal(true);
  protected readonly casos = signal<ChecklistEquipo[]>([]);
  protected readonly filtro = signal<Filtro>('por_revisar');
  protected readonly submittingId = signal<number | null>(null);
  protected readonly ticketIdAbrir = signal<number | null>(null);

  protected readonly filtros: { value: Filtro; label: string }[] = [
    { value: 'por_revisar', label: 'Por revisar' },
    { value: 'aprobado', label: 'Aprobados' },
    { value: 'rechazado', label: 'Rechazados' },
    { value: 'todos', label: 'Todos' },
  ];

  protected readonly conteos = computed(() => {
    const all = this.casos();
    return {
      por_revisar: all.filter(c => c.estado === 'cargado').length,
      aprobado: all.filter(c => c.estado === 'aprobado').length,
      rechazado: all.filter(c => c.estado === 'rechazado').length,
      todos: all.length,
    };
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'pumpingTicketId', header: 'Ticket', sortable: true, searchable: true },
    { key: 'equipoNombre', header: 'Equipo', sortable: true, searchable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
    { key: 'cargadoPor', header: 'Cargado por' },
    { key: 'revisadoPor', header: 'Revisado por' },
  ];

  protected readonly rows = computed(() =>
    this.casosFiltrados().map(c => ({
      id: c.id,
      pumpingTicketId: c.pumpingTicketId,
      equipoNombre: c.equipoNombre,
      estadoBadge: BADGE_POR_ESTADO[c.estado],
      cargadoPor: c.cargadoPor ?? '—',
      revisadoPor: c.revisadoPor ?? '—',
      caso: c,
    })),
  );

  private readonly casosFiltrados = computed(() => {
    const f = this.filtro();
    if (f === 'todos') return this.casos();
    if (f === 'por_revisar') return this.casos().filter(c => c.estado === 'cargado');
    return this.casos().filter(c => c.estado === f);
  });

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
    const ref = this.dialogService.open<MotivoDialog, MotivoDialogData>({
      title: 'Rechazar checklist',
      content: MotivoDialog,
      data: { mensaje: `¿Por qué se rechaza el checklist de ${caso.equipoNombre}?`, label: 'Motivo de rechazo' },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (!motivo) return;
      this.submittingId.set(caso.id);
      this.service.rechazar(caso.id, motivo).subscribe({
        next: () => {
          this.submittingId.set(null);
          this.notify.success('Rechazado', `Checklist de ${caso.equipoNombre} rechazado.`);
          this.cargar();
        },
        error: () => {
          this.submittingId.set(null);
          this.notify.error('Error', 'No se pudo rechazar el checklist.');
        },
      });
    });
  }
}
