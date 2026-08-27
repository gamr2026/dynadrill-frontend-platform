import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCardComponent,
  DynadrillDialogService,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { EntregaEpi, entregaEpiCompleta, entregaEpiSinCapacitacion } from '../../models/entrega-epi.model';
import { EntregaEpiService } from '../../services/entrega-epi.service';
import { EntregaEpiDialog } from '../../components/entrega-epi-dialog';
import { EntregaEpiDetailDialog, EntregaEpiDetailDialogData } from '../../components/entrega-epi-detail-dialog';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** DYN-SGI-RE-032 — bandeja de entregas de EPI. Sin fases/estado como IPERC o PTW: es un registro, con un único gate (expediente cerrado o no). */
@Component({
  selector: 'app-epi-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillButtonComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillSpinnerComponent,
    DynadrillBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './epi-list-page.html',
  styleUrl: './epi-list-page.scss',
})
export class EpiListPage {
  private readonly epiService = inject(EntregaEpiService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly entregas = signal<EntregaEpi[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.entregas();
    const mesActual = new Date().getMonth();
    const esteMes = all.filter(e => new Date(e.createdAt).getMonth() === mesActual).length;
    return [
      { label: 'Total registradas', value: all.length, tone: 'neutral' },
      { label: 'Este mes', value: esteMes, tone: 'brand' },
      { label: 'Expedientes cerrados', value: all.filter(entregaEpiCompleta).length, tone: 'success' },
      { label: 'Con ítems sin capacitación', value: all.filter(e => entregaEpiSinCapacitacion(e).length > 0).length, tone: 'warning' },
    ];
  });

  protected readonly viewCards = computed(() =>
    this.entregas().map(e => ({
      id: e.id,
      code: e.code,
      fecha: formatDate(e.createdAt),
      trabajadorNombre: e.trabajadorNombre,
      trabajadorCargo: e.trabajadorCargo,
      lugar: e.lugar,
      itemsCount: e.items.length,
      sinCapacitacion: entregaEpiSinCapacitacion(e).length,
      completa: entregaEpiCompleta(e),
    })),
  );

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

  protected verDetalle(id: number): void {
    const entrega = this.entregas().find(e => e.id === id);
    if (!entrega) return;
    this.dialogService.open<EntregaEpiDetailDialog, EntregaEpiDetailDialogData>({
      title: `Entrega de EPI — ${entrega.code}`,
      content: EntregaEpiDetailDialog,
      data: { entrega },
      footer: false,
      width: '640px',
    });
  }

  /** "Recibe conforme Talento Humano" — cierra el expediente (NOTA del formato físico). */
  protected cerrarExpediente(id: number): void {
    const nombre = this.auth.currentUser()?.name ?? '';
    this.epiService.update(id, { firmaTalentoHumano: { nombre, firmadoAt: new Date().toISOString() } }).subscribe({
      next: () => {
        this.notify.success('Expediente cerrado', 'Talento Humano recibió conforme — expediente archivado.');
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo cerrar el expediente.'),
    });
  }
}
