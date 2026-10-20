import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import {
  ViajeDetalleDialog,
  TONO_ESTADO_VIAJE,
  TONO_NIVEL,
  type ViajeDetalleDialogData,
} from '../../components/viaje-detalle-dialog';
import {
  ESTADO_VIAJE_LABEL,
  NIVEL_LABEL,
  TIPO_VIAJE_LABEL,
  type ViajeResumen,
} from '../../models/viaje-flota.model';
import { FlotaViajesService } from '../../services/flota-viajes.service';
import { formatoFecha } from '../../utils/flota.util';

/** Portal del Conductor y bandeja de autorización del Gerenciamiento de Viaje (DYN-SGI-RE-049). Cada cuenta ve lo que su permiso le deja. */
@Component({
  selector: 'app-viajes-page',
  imports: [
    PageHeader,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      eyebrow="Flota"
      title="Gerenciamiento de viaje"
      [subtitle]="
        puedeAutorizar()
          ? 'Solicitudes de los conductores; usted autoriza las que su permiso le permite'
          : 'Sus solicitudes de salida y de retorno por ticket (las nuevas las completa desde Pumping → Mis tareas)'
      "
    >
    </app-page-header>
    <dynadrill-spinner mode="overlay" [spinning]="cargando()" tip="Cargando…">
      <dynadrill-data-table
        [columns]="columnas"
        [rows]="filas()"
        [rowKey]="clave"
        [pageSize]="10"
        [actionsTemplate]="acciones"
      />
    </dynadrill-spinner>
    <ng-template #acciones let-row>
      <div class="dyn-actions-row">
        <dynadrill-button
          [variant]="row['puedeDecidir'] ? 'primary' : 'secondary'"
          size="small"
          (clicked)="ver(row['id'])"
        >
          {{ row['puedeDecidir'] ? 'Revisar' : 'Ver detalle' }}
        </dynadrill-button>
      </div>
    </ng-template>
  `,
})
export class ViajesPage {
  private readonly api = inject(FlotaViajesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);

  protected readonly cargando = signal(true);
  protected readonly viajes = signal<ViajeResumen[]>([]);
  protected readonly puedeAutorizar = computed(
    () => this.auth.can('flota.viajes.aprobar') || this.auth.can('flota.viajes.autorizar_mayor'),
  );

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'codigo', header: 'Código', sortable: true, searchable: true },
    { key: 'tipo', header: 'Tipo' },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'conductor', header: 'Conductor', searchable: true },
    { key: 'unidad', header: 'Unidad' },
    { key: 'nivel', header: 'Riesgo', type: 'badge' },
    { key: 'estado', header: 'Estado', type: 'badge' },
  ];

  protected readonly filas = computed(() =>
    this.viajes().map((v) => ({
      id: v.id,
      codigo: v.codigo,
      tipo: TIPO_VIAJE_LABEL[v.tipo],
      fecha: formatoFecha(v.fecha),
      conductor: v.conductor.nombre,
      unidad: v.unidad.codigo,
      nivel: { text: `${NIVEL_LABEL[v.nivel]} (${v.puntajeTotal})`, tone: TONO_NIVEL[v.nivel] },
      estado: { text: ESTADO_VIAJE_LABEL[v.estado], tone: TONO_ESTADO_VIAJE[v.estado] },
      puedeDecidir: v.puedeDecidir,
    })),
  );

  protected readonly clave = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  private recargar(): void {
    this.cargando.set(true);
    this.api.listar().subscribe({
      next: (v) => {
        this.viajes.set(v);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected ver(viajeId: string): void {
    this.dialog
      .open<ViajeDetalleDialog, ViajeDetalleDialogData>({
        title: 'Gerenciamiento de Viaje',
        content: ViajeDetalleDialog,
        data: { viajeId },
        size: 'large',
        footer: false,
      })
      .afterClose.subscribe((r) => r && this.recargar());
  }
}
