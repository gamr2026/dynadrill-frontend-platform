import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../core/utils/narrow-viewport.util';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { KpiStat, KpiStatTone } from '../../../../shared/components/kpi-stat/kpi-stat';
import { RecordAction, RecordCard } from '../../../../shared/components/record-card/record-card';
import {
  ViajeDetalleDialog,
  type ViajeDetalleDialogData,
} from '../../../flota/components/viaje-detalle-dialog';
import {
  ViajeSolicitudDialog,
  type ViajeSolicitudDialogData,
} from '../../../flota/components/viaje-solicitud-dialog';
import {
  ESTADO_TAREA_LABEL,
  TIPO_VIAJE_LABEL,
  tareasDeViaje,
  type EstadoTareaViaje,
  type TareaViaje,
  type TipoViaje,
  type ViajeContextoPumping,
  type ViajeResumen,
} from '../../../flota/models/viaje-flota.model';
import { FlotaViajesService } from '../../../flota/services/flota-viajes.service';

const ESTADO_TONE: Record<EstadoTareaViaje, 'warning' | 'success' | 'error' | 'neutral'> = {
  por_completar: 'neutral',
  pendiente: 'warning',
  aprobado: 'success',
};

type TareaRow = {
  id: string;
  code: string;
  wellName: string;
  clientName: string;
  unidad: string;
  paso: string;
  tipo: TipoViaje;
  tipoLabel: string;
  estado: EstadoTareaViaje;
  viajeId: string | null;
  estadoBadge: { text: string; tone: 'warning' | 'success' | 'error' | 'neutral' };
  actions: RecordAction[];
  tarea: TareaViaje;
};

/**
 * Vista del Conductor dentro de la tabla de Pumping: una fila por cada Gerenciamiento de Viaje (salida/retorno) que le toca en la unidad
 * que se le asignó. Al asignarlo, la tarea aparece sola; se completa con el formulario DYN-SGI-RE-049 y el ticket sigue su proceso
 * cuando se aprueba (el candado real está en los requisitos del ticket).
 */
@Component({
  selector: 'app-conductor-tareas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeader,
    KpiStat,
    RecordCard,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
  ],
  templateUrl: './conductor-tareas.html',
  styleUrl: './conductor-tareas.scss',
})
export class ConductorTareas {
  private readonly api = inject(FlotaViajesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');
  protected readonly loading = signal(true);
  private readonly tickets = signal<ViajeContextoPumping[]>([]);
  private readonly viajes = signal<ViajeResumen[]>([]);

  protected readonly rows = computed<TareaRow[]>(() =>
    tareasDeViaje(this.tickets(), this.viajes()).map((t) => ({
      id: t.clave,
      code: String(t.ticket.ticketNumero ?? t.ticket.pedidoCodigo),
      wellName: t.ticket.destino.pozo?.nombre ?? '—',
      clientName: t.ticket.cliente?.nombre ?? '—',
      unidad: t.unidad.placa,
      paso: t.ticket.paso.nombre,
      tipo: t.tipo,
      tipoLabel: TIPO_VIAJE_LABEL[t.tipo],
      estado: t.estado,
      viajeId: t.viajeId,
      estadoBadge: t.rechazado
        ? { text: 'Rechazado: rehacer', tone: 'error' }
        : { text: ESTADO_TAREA_LABEL[t.estado], tone: ESTADO_TONE[t.estado] },
      actions: t.viajeId
        ? [{ icon: 'eye', label: 'Ver detalle', run: () => this.verDetalle(t.viajeId as string) }]
        : [
            {
              icon: 'edit',
              label: 'Completar Gerenciamiento de Viaje',
              primary: true,
              run: () => this.completar(t),
            },
          ],
      tarea: t,
    })),
  );

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const r = this.rows();
    return [
      {
        label: 'Por completar',
        value: r.filter((x) => x.estado === 'por_completar').length,
        tone: 'warning',
      },
      {
        label: 'Pendientes de aprobación',
        value: r.filter((x) => x.estado === 'pendiente').length,
        tone: 'neutral',
      },
      {
        label: 'Aprobados',
        value: r.filter((x) => x.estado === 'aprobado').length,
        tone: 'success',
      },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Ticket', sortable: true, searchable: true },
    { key: 'wellName', header: 'Pozo', sortable: true, searchable: true },
    { key: 'clientName', header: 'Cliente', searchable: true },
    { key: 'tipoLabel', header: 'Gerenciamiento de Viaje' },
    { key: 'unidad', header: 'Unidad' },
    { key: 'paso', header: 'Paso del ticket' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ tickets: this.api.misViajesPumping(), viajes: this.api.listar() }).subscribe({
      next: ({ tickets, viajes }) => {
        this.tickets.set(tickets);
        this.viajes.set(viajes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar tus tareas.');
      },
    });
  }

  protected completar(t: TareaViaje): void {
    const ref = this.dialog.open<ViajeSolicitudDialog, ViajeSolicitudDialogData>({
      title: `Gerenciamiento de Viaje — ${TIPO_VIAJE_LABEL[t.tipo]} · ${t.ticket.ticketNumero ?? t.ticket.pedidoCodigo}`,
      content: ViajeSolicitudDialog,
      data: { ticket: t.ticket, tipo: t.tipo, vehiculoId: t.unidad.vehiculoId },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((enviado: boolean | undefined) => {
      if (enviado) this.reload();
    });
  }

  protected verDetalle(viajeId: string): void {
    this.dialog.open<ViajeDetalleDialog, ViajeDetalleDialogData>({
      title: 'Gerenciamiento de Viaje',
      content: ViajeDetalleDialog,
      data: { viajeId },
      size: 'large',
      footer: false,
    });
  }

  protected verDetalleFila(row: Record<string, unknown>): void {
    this.verDetalle(String(row['viajeId']));
  }

  protected completarFila(row: Record<string, unknown>): void {
    this.completar(row['tarea'] as TareaViaje);
  }
}
