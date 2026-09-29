import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  type DynadrillKpiRowItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import {
  GERENCIAMIENTO_VIAJE_ESTADO_LABELS,
  GERENCIAMIENTO_VIAJE_TIPO_LABELS,
  GerenciamientoViaje,
  GerenciamientoViajeEstado,
  GerenciamientoViajeTipo,
} from '../../models/gerenciamiento-viaje.model';
import { GerenciamientoViajeService } from '../../services/gerenciamiento-viaje.service';
import { GerenciamientoViajeDialog, GerenciamientoViajeDialogData } from '../../components/gerenciamiento-viaje-dialog';
import { GerenciamientoViajeDetailDialog, GerenciamientoViajeDetailDialogData } from '../../components/gerenciamiento-viaje-detail-dialog';

const ESTADO_TONE: Record<GerenciamientoViajeEstado, DynadrillTagVariant> = {
  pendiente: 'warning',
  aprobado: 'success',
  rechazado: 'error',
};

/** Portal del Conductor — DYN-SGI-RE-049. Solo ve y solicita los suyos. */
@Component({
  selector: 'app-mis-viajes-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillButtonComponent, DynadrillIconButtonComponent, DynadrillDataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mis-viajes-page.html',
  styleUrl: './mis-viajes-page.scss',
})
export class MisViajesPage {
  private readonly service = inject(GerenciamientoViajeService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly viajes = signal<GerenciamientoViaje[]>([]);
  protected readonly estadoLabels = GERENCIAMIENTO_VIAJE_ESTADO_LABELS;
  protected readonly tipoLabels = GERENCIAMIENTO_VIAJE_TIPO_LABELS;

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.viajes();
    return [
      { label: 'Total solicitados', value: all.length },
      { label: 'Pendientes', value: all.filter(g => g.estado === 'pendiente').length, tone: 'warning' },
      { label: 'Aprobados', value: all.filter(g => g.estado === 'aprobado').length, tone: 'success' },
      { label: 'Rechazados', value: all.filter(g => g.estado === 'rechazado').length, tone: 'error' },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'tipo', header: 'Tipo' },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'destino', header: 'Destino', searchable: true },
    { key: 'riskLevel', header: 'Riesgo' },
    {
      key: 'estadoBadge',
      header: 'Estado',
      type: 'badge',
      filters: Object.entries(GERENCIAMIENTO_VIAJE_ESTADO_LABELS).map(([, text]) => ({ text, value: text })),
    },
  ];

  protected readonly rows = computed(() =>
    this.viajes().map(g => ({
      id: g.id,
      code: g.code,
      tipo: this.tipoLabels[g.tipo],
      fecha: g.fecha,
      destino: g.destino,
      riskLevel: g.riskLevel,
      estadoBadge: { text: this.estadoLabels[g.estado], tone: ESTADO_TONE[g.estado] },
      gv: g,
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.service.listMine().subscribe({
      next: viajes => {
        this.viajes.set(viajes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar tus gerenciamientos de viaje.');
      },
    });
  }

  protected solicitar(tipo: GerenciamientoViajeTipo): void {
    const ref = this.dialogService.open<GerenciamientoViajeDialog, GerenciamientoViajeDialogData>({
      title: `Solicitar Gerenciamiento de Viaje — ${this.tipoLabels[tipo]}`,
      content: GerenciamientoViajeDialog,
      data: { tipo },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  protected verDetalle(row: Record<string, unknown>): void {
    const gv = row['gv'] as GerenciamientoViaje;
    this.dialogService.open<GerenciamientoViajeDetailDialog, GerenciamientoViajeDetailDialogData>({
      title: `Gerenciamiento de Viaje — ${gv.code}`,
      content: GerenciamientoViajeDetailDialog,
      data: { gv },
      footer: false,
      width: '640px',
    });
  }
}
