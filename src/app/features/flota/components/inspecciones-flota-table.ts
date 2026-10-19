import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADO_INSPECCION_LABEL,
  type EstadoInspeccion,
  type InspeccionResumen,
} from '../models/inspeccion-flota.model';
import { formatoNumero } from '../utils/flota.util';

const TONO: Record<EstadoInspeccion, DynadrillTagVariant> = {
  pendiente: 'warning',
  por_aprobar: 'warning',
  aprobada: 'success',
  anulada: 'neutral',
};

/** Lista de inspecciones de vehículos (Flota): unidad, fecha, conductor, kilometraje, novedades y aprobación del Supervisor. */
@Component({
  selector: 'app-inspecciones-flota-table',
  imports: [DynadrillDataTableComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dynadrill-data-table
      [columns]="columnas"
      [rows]="filas()"
      [rowKey]="clave"
      [pageSize]="10"
      [actionsTemplate]="acciones"
    />
    <ng-template #acciones let-row>
      <div class="dyn-actions-row">
        <dynadrill-button variant="secondary" size="small" (clicked)="ver(row)"
          >Ver detalle</dynadrill-button
        >
      </div>
    </ng-template>
  `,
})
export class InspeccionesFlotaTable {
  readonly inspecciones = input.required<InspeccionResumen[]>();
  readonly view = output<InspeccionResumen>();

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'unidad', header: 'Unidad', sortable: true, searchable: true },
    { key: 'momento', header: 'Momento' },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'conductor', header: 'Conductor', searchable: true },
    { key: 'km', header: 'Kilometraje' },
    { key: 'novedades', header: 'Novedades', type: 'badge' },
    { key: 'estado', header: 'Aprobación', type: 'badge' },
  ];

  protected readonly filas = computed(() =>
    this.inspecciones().map((i) => ({
      id: i.id,
      unidad: `${i.unidad.codigo} · ${i.unidad.nombre}`,
      momento: i.momento === 'salida' ? 'Salida' : 'Llegada',
      fecha: new Date(i.fecha).toLocaleDateString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      conductor: i.conductor.nombre,
      km: i.km === null ? '—' : `${formatoNumero(i.km)} km`,
      novedades: i.hayNovedades
        ? { text: 'Con novedades', tone: 'error' as const }
        : { text: 'Sin novedades', tone: 'success' as const },
      estado: { text: ESTADO_INSPECCION_LABEL[i.estado], tone: TONO[i.estado] },
    })),
  );

  protected readonly clave = (row: Record<string, unknown>): string => String(row['id']);

  protected ver(row: Record<string, unknown>): void {
    const i = this.inspecciones().find((x) => x.id === row['id']);
    if (i) this.view.emit(i);
  }
}
