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
  ViajeSolicitudDialog,
  type ViajeSolicitudDialogData,
} from '../../components/viaje-solicitud-dialog';
import { KpiStat } from '../../../../shared/components/kpi-stat/kpi-stat';
import {
  ESTADO_TAREA_LABEL,
  ESTADO_VIAJE_LABEL,
  NIVEL_LABEL,
  TIPO_VIAJE_LABEL,
  tareasDeViaje,
  type TareaViaje,
  type ViajeContextoPumping,
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
    KpiStat,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      eyebrow="Flota"
      title="Gerenciamiento de viaje"
      [subtitle]="
        puedeAutorizar()
          ? 'Solicitudes de los conductores; usted autoriza las que su permiso le permite'
          : modoTareas()
            ? 'Los gerenciamientos de viaje que le tocan en sus tickets'
            : 'Sus solicitudes de salida y de retorno por ticket'
      "
    >
      @if (puedeSolicitar() && !modoTareas()) {
        <dynadrill-button actions (clicked)="solicitar()"
          >Solicitar gerenciamiento</dynadrill-button
        >
      }
    </app-page-header>
    @if (modoTareas()) {
      <div class="kpi-stat-row" role="list">
        <app-kpi-stat [value]="contador().por_completar" label="Por completar" tone="warning" />
        <app-kpi-stat
          [value]="contador().pendiente"
          label="Pendientes de aprobación"
          tone="neutral"
        />
        <app-kpi-stat [value]="contador().aprobado" label="Aprobados" tone="success" />
      </div>
      <dynadrill-spinner mode="overlay" [spinning]="cargando()" tip="Cargando…">
        <dynadrill-data-table
          [columns]="columnasTareas"
          [rows]="filasTareas()"
          [rowKey]="clave"
          [pageSize]="10"
          [actionsTemplate]="accionesTarea"
        />
      </dynadrill-spinner>
      <ng-template #accionesTarea let-row>
        <div class="dyn-actions-row">
          @if (row['viajeId']) {
            <dynadrill-button variant="secondary" size="small" (clicked)="ver(row['viajeId'])">
              Ver detalle
            </dynadrill-button>
          } @else {
            <dynadrill-button size="small" (clicked)="completar(row['clave'])">
              {{ row['rechazado'] ? 'Rehacer' : 'Completar' }}
            </dynadrill-button>
          }
        </div>
      </ng-template>
    } @else {
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
    }
  `,
})
export class ViajesPage {
  private readonly api = inject(FlotaViajesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);

  protected readonly cargando = signal(true);
  protected readonly viajes = signal<ViajeResumen[]>([]);
  protected readonly puedeSolicitar = computed(() => this.auth.can('flota.viajes.solicitar'));
  protected readonly puedeAutorizar = computed(
    () => this.auth.can('flota.viajes.aprobar') || this.auth.can('flota.viajes.autorizar_mayor'),
  );

  /** Quien solo solicita (el conductor) ve sus tareas; quien autoriza o administra ve la bandeja de solicitudes. */
  protected readonly modoTareas = computed(() => this.puedeSolicitar() && !this.puedeAutorizar());
  private readonly misTickets = signal<ViajeContextoPumping[]>([]);
  protected readonly tareas = computed<TareaViaje[]>(() =>
    tareasDeViaje(this.misTickets(), this.viajes()),
  );
  protected readonly contador = computed(() => {
    const c = { por_completar: 0, pendiente: 0, aprobado: 0 };
    for (const t of this.tareas()) c[t.estado]++;
    return c;
  });
  protected readonly columnasTareas: DynadrillDataTableColumn[] = [
    { key: 'ticket', header: 'Ticket', sortable: true, searchable: true },
    { key: 'pozo', header: 'Pozo', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'viaje', header: 'Gerenciamiento de viaje' },
    { key: 'unidad', header: 'Unidad' },
    { key: 'paso', header: 'Paso del ticket' },
    { key: 'estado', header: 'Estado', type: 'badge' },
  ];
  protected readonly filasTareas = computed(() =>
    this.tareas().map((t) => ({
      clave: t.clave,
      ticket: String(t.ticket.ticketNumero ?? t.ticket.pedidoCodigo),
      pozo: t.ticket.destino.pozo?.nombre ?? '—',
      cliente: t.ticket.cliente?.nombre ?? '—',
      viaje: TIPO_VIAJE_LABEL[t.tipo],
      unidad: t.unidad.placa,
      paso: t.ticket.paso.nombre,
      estado: {
        text: t.rechazado ? 'Rechazado: rehacer' : ESTADO_TAREA_LABEL[t.estado],
        tone: t.estado === 'aprobado' ? 'success' : t.estado === 'pendiente' ? 'info' : 'warning',
      },
      viajeId: t.viajeId,
      rechazado: t.rechazado,
    })),
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
    if (this.modoTareas()) {
      this.api.misViajesPumping().subscribe({
        next: (t) => this.misTickets.set(t),
        error: () => this.misTickets.set([]),
      });
    }
    this.api.listar().subscribe({
      next: (v) => {
        this.viajes.set(v);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected solicitar(): void {
    this.dialog
      .open<ViajeSolicitudDialog>({
        title: 'Solicitar Gerenciamiento de Viaje — DYN-SGI-RE-049',
        content: ViajeSolicitudDialog,
        size: 'large',
        footer: false,
      })
      .afterClose.subscribe((r) => r && this.recargar());
  }

  /** Abre el formulario del gerenciamiento con el ticket, el tipo y la unidad de la tarea ya definidos. */
  protected completar(clave: string): void {
    const t = this.tareas().find((x) => x.clave === clave);
    if (!t) return;
    this.dialog
      .open<ViajeSolicitudDialog, ViajeSolicitudDialogData>({
        title: `Gerenciamiento de Viaje — ${TIPO_VIAJE_LABEL[t.tipo]} · Ticket ${t.ticket.ticketNumero ?? t.ticket.pedidoCodigo}`,
        content: ViajeSolicitudDialog,
        data: { ticketId: t.ticket.ticketId, tipo: t.tipo, vehiculoId: t.unidad.vehiculoId },
        size: 'large',
        footer: false,
      })
      .afterClose.subscribe((r) => r && this.recargar());
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
