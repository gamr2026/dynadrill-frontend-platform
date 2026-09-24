import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  type DynadrillKpiRowItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { EntregaEpi, EpiEstado, EPI_ESTADO_LABELS, entregaEpiSinCapacitacion } from '../../models/entrega-epi.model';
import { EntregaEpiService } from '../../services/entrega-epi.service';
import { EntregaEpiDialog } from '../../components/entrega-epi-dialog';
import { EntregaEpiDetailDialog, EntregaEpiDetailDialogData } from '../../components/entrega-epi-detail-dialog';
import { MotivoDialog, MotivoDialogData } from '../../../../../shared/components/motivo-dialog/motivo-dialog';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ESTADO_TONE: Record<EpiEstado, DynadrillTagVariant> = {
  solicitado: 'warning',
  aprobado: 'brand',
  despachado: 'success',
  rechazado: 'error',
};

const CAPACITACION_COMPLETA: { text: string; tone: DynadrillTagVariant } = { text: '✓ Completa', tone: 'success' };
const CAPACITACION_PENDIENTE: { text: string; tone: DynadrillTagVariant } = { text: '⚠ Pendiente', tone: 'warning' };

type FiltroEstado = EpiEstado | 'todos';

/** DYN-SGI-RE-032 — bandeja de entregas de EPI (Fase 5: solicitar → aprobar/rechazar → despachar). */
@Component({
  selector: 'app-epi-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillIconButtonComponent,
    DynadrillDataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './epi-list-page.html',
  styleUrl: './epi-list-page.scss',
})
export class EpiListPage {
  private readonly epiService = inject(EntregaEpiService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly entregas = signal<EntregaEpi[]>([]);
  protected readonly estadoLabels = EPI_ESTADO_LABELS;
  protected readonly filtroEstado = signal<FiltroEstado>('todos');
  protected readonly busqueda = signal('');
  protected readonly submittingId = signal<number | null>(null);

  protected readonly filtros: { value: FiltroEstado; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'solicitado', label: 'Solicitado' },
    { value: 'aprobado', label: 'Aprobado' },
    { value: 'despachado', label: 'Despachado' },
    { value: 'rechazado', label: 'Rechazado' },
  ];

  protected readonly conteos = computed(() => {
    const all = this.entregas();
    const counts: Record<FiltroEstado, number> = { todos: all.length, solicitado: 0, aprobado: 0, despachado: 0, rechazado: 0 };
    for (const e of all) counts[e.estado]++;
    return counts;
  });

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.entregas();
    const mesActual = new Date().getMonth();
    const esteMes = all.filter(e => new Date(e.createdAt).getMonth() === mesActual).length;
    return [
      { label: 'Total registradas', value: all.length, tone: 'neutral' },
      { label: 'Este mes', value: esteMes, tone: 'brand' },
      { label: 'Solicitadas — por revisar', value: all.filter(e => e.estado === 'solicitado').length, tone: 'warning' },
      { label: 'Con ítems sin capacitación', value: all.filter(e => entregaEpiSinCapacitacion(e).length > 0).length, tone: 'warning' },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'ID', sortable: true },
    { key: 'trabajadorNombre', header: 'Persona', sortable: true },
    { key: 'trabajadorCargo', header: 'Cargo' },
    { key: 'lugar', header: 'Lugar' },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'itemsCount', header: 'Ítems' },
    { key: 'capacitacionBadge', header: 'Capacitación', type: 'badge' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  private readonly entregasFiltradas = computed(() => {
    const filtro = this.filtroEstado();
    const q = this.busqueda().trim().toLowerCase();
    return this.entregas()
      .filter(e => filtro === 'todos' || e.estado === filtro)
      .filter(e => !q || [e.code, e.trabajadorNombre, e.lugar].some(v => v.toLowerCase().includes(q)));
  });

  protected readonly rows = computed(() =>
    this.entregasFiltradas().map(e => ({
      id: e.id,
      code: e.code,
      trabajadorNombre: e.trabajadorNombre,
      trabajadorCargo: e.trabajadorCargo,
      lugar: e.lugar,
      fecha: formatDate(e.createdAt),
      itemsCount: e.items.length,
      capacitacionBadge: entregaEpiSinCapacitacion(e).length === 0 ? CAPACITACION_COMPLETA : CAPACITACION_PENDIENTE,
      estadoBadge: { text: this.estadoLabels[e.estado], tone: ESTADO_TONE[e.estado] },
      entrega: e,
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.epiService.list().subscribe({
      next: entregas => {
        this.entregas.set(entregas);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar las entregas de EPI.');
      },
    });
  }

  protected nuevaEntrega(): void {
    const ref = this.dialogService.open<EntregaEpiDialog>({ title: 'Nueva entrega de EPI', content: EntregaEpiDialog, footer: false, width: '680px' });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  protected verDetalle(entrega: EntregaEpi): void {
    const ref = this.dialogService.open<EntregaEpiDetailDialog, EntregaEpiDetailDialogData>({
      title: `Entrega de EPI — ${entrega.code}`,
      content: EntregaEpiDetailDialog,
      data: { entrega },
      footer: false,
      width: '640px',
    });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  /** Fase 5 — ciclo de vida: aprobar/rechazar/despachar (solo QHSE). */
  protected aprobar(id: number): void {
    this.submittingId.set(id);
    this.epiService.aprobar(id).subscribe({
      next: () => {
        this.submittingId.set(null);
        this.notify.success('Aprobada', 'La entrega de EPI quedó aprobada.');
        this.reload();
      },
      error: () => {
        this.submittingId.set(null);
        this.notify.error('Error', 'No se pudo aprobar la entrega.');
      },
    });
  }

  protected rechazar(id: number): void {
    const ref = this.dialogService.open<MotivoDialog, MotivoDialogData>({
      title: 'Rechazar entrega de EPI',
      content: MotivoDialog,
      data: { mensaje: '¿Por qué se rechaza esta entrega de EPI?', label: 'Motivo de rechazo' },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (!motivo) return;
      this.submittingId.set(id);
      this.epiService.rechazar(id, motivo).subscribe({
        next: () => {
          this.submittingId.set(null);
          this.notify.success('Rechazada', 'La entrega de EPI quedó rechazada.');
          this.reload();
        },
        error: () => {
          this.submittingId.set(null);
          this.notify.error('Error', 'No se pudo rechazar la entrega.');
        },
      });
    });
  }

  protected despachar(id: number): void {
    this.submittingId.set(id);
    this.epiService.despachar(id).subscribe({
      next: () => {
        this.submittingId.set(null);
        this.notify.success('Despachada', 'La entrega de EPI quedó despachada.');
        this.reload();
      },
      error: () => {
        this.submittingId.set(null);
        this.notify.error('Error', 'No se pudo despachar la entrega.');
      },
    });
  }
}
