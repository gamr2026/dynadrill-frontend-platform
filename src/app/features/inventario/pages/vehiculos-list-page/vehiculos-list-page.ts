import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { UnidadesService } from '../../../maintenance/services/unidades.service';
import { Unidad } from '../../../maintenance/models/unidad.model';
import { VehiculoPatrimonioDialog, VehiculoPatrimonioDialogData } from '../../components/vehiculo-patrimonio-dialog';

/**
 * Misma fuente que Mantenimiento (UnidadesService) — no una lista de
 * vehículos aparte. Esta vista solo resalta los campos patrimoniales
 * (placa/marca/responsable) que a la bandeja operativa de Mantenimiento
 * no le hacían falta.
 */
@Component({
  selector: 'app-vehiculos-list-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillDataTableComponent, DynadrillButtonComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehiculos-list-page.html',
  styleUrl: './vehiculos-list-page.scss',
})
export class VehiculosListPage {
  private readonly unidadesService = inject(UnidadesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly unidades = signal<Unidad[]>([]);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'nombre', header: 'Nombre', searchable: true },
    { key: 'tipo', header: 'Tipo' },
    { key: 'placa', header: 'Placa' },
    { key: 'marca', header: 'Marca / Modelo' },
    { key: 'responsablePatrimonial', header: 'Responsable' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.unidades().map(u => ({
      id: u.id,
      code: u.code,
      nombre: u.nombre,
      tipo: u.tipo,
      placa: u.placa ?? '—',
      marca: [u.marca, u.modelo].filter(Boolean).join(' ') || '—',
      responsablePatrimonial: u.responsablePatrimonial ?? '—',
      estadoBadge:
        u.activo === false
          ? { text: 'Inactivo', tone: 'neutral' as const }
          : { text: 'Activo', tone: 'success' as const },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.unidadesService.list().subscribe({
      next: unidades => {
        this.unidades.set(unidades);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el listado de vehículos.');
      },
    });
  }

  protected editar(row: Record<string, unknown>): void {
    const unidad = this.unidades().find(u => u.id === row['id']);
    if (!unidad) return;
    const ref = this.dialog.open<VehiculoPatrimonioDialog, VehiculoPatrimonioDialogData>({
      title: `Datos patrimoniales — ${unidad.code}`,
      content: VehiculoPatrimonioDialog,
      data: { unidad },
      footer: false,
    });
    ref.afterClose.subscribe(updated => {
      if (updated) this.reload();
    });
  }
}
