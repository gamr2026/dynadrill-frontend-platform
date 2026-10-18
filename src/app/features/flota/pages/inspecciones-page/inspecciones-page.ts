import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillSpinnerComponent,
  DynadrillTabsComponent,
  type DynadrillTab,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import {
  InspeccionVehiculoDialog,
  type InspeccionVehiculoDialogData,
} from '../../components/inspeccion-vehiculo-dialog';
import { InspeccionesFlotaTable } from '../../components/inspecciones-flota-table';
import {
  ESTADO_INSPECCION_LABEL,
  type CasoInspeccion,
  type EstadoCaso,
  type InspeccionResumen,
} from '../../models/inspeccion-flota.model';
import { FlotaInspeccionesService } from '../../services/flota-inspecciones.service';

const TONO: Record<EstadoCaso, DynadrillTagVariant> = {
  pendiente: 'warning',
  por_aprobar: 'warning',
  aprobada: 'success',
};

/** Inspección de vehículos: los casos que me asignó Pumping (para registrarlos) y el historial de inspecciones. */
@Component({
  selector: 'app-inspecciones-page',
  imports: [
    PageHeader,
    DynadrillTabsComponent,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    InspeccionesFlotaTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      eyebrow="Flota"
      title="Inspección de vehículos"
      subtitle="Formato DYN-SGI-RE-068: se hace antes de salir, por cada unidad de transporte asignada"
    />
    <dynadrill-tabs
      [tabs]="tabs"
      [activeIndex]="pestana()"
      (activeIndexChange)="pestana.set($event)"
    />
    <dynadrill-spinner mode="overlay" [spinning]="cargando()" tip="Cargando…">
      @if (pestana() === 0) {
        <dynadrill-data-table
          [columns]="columnasCasos"
          [rows]="filasCasos()"
          [rowKey]="clave"
          [pageSize]="10"
          [actionsTemplate]="accionesCaso"
        />
        <ng-template #accionesCaso let-row>
          <div class="dyn-actions-row">
            @if (puedeCrear()) {
              @if (row['estado'].text === 'Pendiente') {
                <dynadrill-button size="small" (clicked)="registrar(row['id'], 'salida')"
                  >Registrar salida</dynadrill-button
                >
              } @else if (row['sinLlegada']) {
                <dynadrill-button
                  variant="secondary"
                  size="small"
                  (clicked)="registrar(row['id'], 'llegada')"
                  >Registrar llegada</dynadrill-button
                >
              }
            }
            @if (row['salidaId']) {
              <dynadrill-button variant="secondary" size="small" (clicked)="ver(row['salidaId'])"
                >Ver salida</dynadrill-button
              >
            }
          </div>
        </ng-template>
      } @else {
        <app-inspecciones-flota-table [inspecciones]="inspecciones()" (view)="ver($event.id)" />
      }
    </dynadrill-spinner>
  `,
})
export class InspeccionesPage {
  private readonly api = inject(FlotaInspeccionesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);

  protected readonly tabs: DynadrillTab[] = [{ label: 'Mis casos' }, { label: 'Inspecciones' }];
  protected readonly pestana = signal(0);
  protected readonly cargando = signal(true);
  protected readonly casos = signal<CasoInspeccion[]>([]);
  protected readonly inspecciones = signal<InspeccionResumen[]>([]);
  protected readonly puedeCrear = computed(() => this.auth.can('flota.inspecciones.crear'));

  protected readonly columnasCasos: DynadrillDataTableColumn[] = [
    { key: 'unidad', header: 'Unidad', searchable: true },
    { key: 'operador', header: 'Operador asignado' },
    { key: 'ticket', header: 'Ticket' },
    { key: 'estado', header: 'Salida', type: 'badge' },
    { key: 'llegada', header: 'Llegada' },
  ];

  protected readonly filasCasos = computed(() =>
    this.casos().map((c) => ({
      id: c.id,
      unidad: `${c.unidad.codigo} · ${c.unidad.vehiculo?.placa ?? c.unidad.nombre}`,
      operador: c.operador.nombre,
      ticket: c.ticketId.slice(-8),
      estado: {
        text: c.estado === 'pendiente' ? 'Pendiente' : ESTADO_INSPECCION_LABEL[c.estado],
        tone: TONO[c.estado],
      },
      llegada: c.llegadaInspeccionId ? 'Registrada' : '—',
      salidaId: c.salidaInspeccionId,
      sinLlegada: !!c.salidaInspeccionId && !c.llegadaInspeccionId,
    })),
  );

  protected readonly clave = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  private recargar(): void {
    this.cargando.set(true);
    forkJoin({ casos: this.api.misCasos(), inspecciones: this.api.listar() }).subscribe({
      next: ({ casos, inspecciones }) => {
        this.casos.set(casos);
        this.inspecciones.set(inspecciones);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected registrar(casoId: string, momento: 'salida' | 'llegada'): void {
    const caso = this.casos().find((c) => c.id === casoId);
    if (!caso) return;
    this.dialog
      .open<InspeccionVehiculoDialog, InspeccionVehiculoDialogData>({
        title: `Inspección de ${momento} — ${caso.unidad.codigo}`,
        content: InspeccionVehiculoDialog,
        data: { caso, momento },
        size: 'large',
        footer: false,
      })
      .afterClose.subscribe((r) => r && this.recargar());
  }

  protected ver(inspeccionId: string): void {
    this.dialog
      .open<InspeccionVehiculoDialog, InspeccionVehiculoDialogData>({
        title: 'Inspección de vehículo — DYN-SGI-RE-068',
        content: InspeccionVehiculoDialog,
        data: { inspeccionId },
        size: 'large',
        footer: false,
      })
      .afterClose.subscribe((r) => r && this.recargar());
  }
}
