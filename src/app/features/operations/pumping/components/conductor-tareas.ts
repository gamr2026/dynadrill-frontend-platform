import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  GERENCIAMIENTO_VIAJE_ESTADO_LABELS,
  GERENCIAMIENTO_VIAJE_TIPO_LABELS,
  GerenciamientoViaje,
  GerenciamientoViajeEstado,
  GerenciamientoViajeTipo,
  TicketConductor,
} from '../../../conductor/models/gerenciamiento-viaje.model';
import { GerenciamientoViajeService } from '../../../conductor/services/gerenciamiento-viaje.service';
import { GerenciamientoViajeDialog, GerenciamientoViajeDialogData } from '../../../conductor/components/gerenciamiento-viaje-dialog';
import { PUMPING_STEP_LABELS, type PumpingStep } from '../models/pumping.model';

/** Pasos del ticket en los que le toca al Conductor cada Gerenciamiento de Viaje (el candado real está en PumpingDomainService.advance). */
const PASOS_TAREA: Record<GerenciamientoViajeTipo, ReadonlySet<string>> = {
  salida: new Set(['traslado_salida', 'revision_reportes_salida']),
  retorno: new Set(['ejecucion_operativa', 'control_retorno']),
};

const ESTADO_TONE: Record<GerenciamientoViajeEstado, 'warning' | 'success' | 'error'> = {
  pendiente: 'warning',
  aprobado: 'success',
  rechazado: 'error',
};

type TareaRow = {
  id: string;
  code: string;
  wellName: string;
  clientName: string;
  paso: string;
  tipo: GerenciamientoViajeTipo;
  tipoLabel: string;
  estado: GerenciamientoViajeEstado | 'por_completar';
  estadoBadge: { text: string; tone: 'warning' | 'success' | 'error' | 'neutral' };
  actions: RecordAction[];
  ticket: TicketConductor;
};

/**
 * Vista del Conductor dentro de la tabla de Pumping: una fila por cada Gerenciamiento de Viaje (salida/retorno)
 * que le toca en sus tickets. Se completa con el mismo wizard DYN-SGI-RE-049 y el ticket sigue su proceso
 * cuando el Jefe de Base lo aprueba.
 */
@Component({
  selector: 'app-conductor-tareas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, KpiStat, RecordCard, DynadrillDataTableComponent, DynadrillIconButtonComponent],
  templateUrl: './conductor-tareas.html',
  styleUrl: './conductor-tareas.scss',
})
export class ConductorTareas {
  private readonly service = inject(GerenciamientoViajeService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');
  protected readonly loading = signal(true);
  private readonly tickets = signal<TicketConductor[]>([]);

  protected readonly rows = computed<TareaRow[]>(() => {
    const filas: TareaRow[] = [];
    for (const t of this.tickets()) {
      for (const tipo of ['salida', 'retorno'] as const) {
        const estado = t.tareas[tipo];
        // Sin GV y todavía no le toca → no es una tarea; con GV siempre se muestra (historial).
        if (!estado && !PASOS_TAREA[tipo].has(t.currentStep)) continue;
        filas.push({
          id: `${t.id}-${tipo}`,
          code: t.code,
          wellName: t.wellName,
          clientName: t.clientName,
          paso: PUMPING_STEP_LABELS[t.currentStep as PumpingStep] ?? t.currentStep,
          tipo,
          tipoLabel: GERENCIAMIENTO_VIAJE_TIPO_LABELS[tipo],
          estado: estado ?? 'por_completar',
          estadoBadge: estado
            ? { text: GERENCIAMIENTO_VIAJE_ESTADO_LABELS[estado], tone: ESTADO_TONE[estado] }
            : { text: 'Por completar', tone: 'neutral' },
          actions: estado
            ? []
            : [
                {
                  icon: 'edit',
                  label: 'Completar Gerenciamiento de Viaje',
                  primary: true,
                  run: () => this.completar(t, tipo),
                },
              ],
          ticket: t,
        });
      }
    }
    return filas;
  });

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const r = this.rows();
    return [
      { label: 'Por completar', value: r.filter(x => x.estado === 'por_completar').length, tone: 'warning' },
      { label: 'Pendientes de aprobación', value: r.filter(x => x.estado === 'pendiente').length, tone: 'neutral' },
      { label: 'Aprobados', value: r.filter(x => x.estado === 'aprobado').length, tone: 'success' },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Ticket', sortable: true, searchable: true },
    { key: 'wellName', header: 'Pozo', sortable: true, searchable: true },
    { key: 'clientName', header: 'Cliente', searchable: true },
    { key: 'tipoLabel', header: 'Gerenciamiento de Viaje' },
    { key: 'paso', header: 'Paso del ticket' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.service.ticketsMios().subscribe({
      next: tickets => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar tus tareas.');
      },
    });
  }

  protected completar(ticket: TicketConductor, tipo: GerenciamientoViajeTipo): void {
    const ref = this.dialog.open<GerenciamientoViajeDialog, GerenciamientoViajeDialogData>({
      title: `Gerenciamiento de Viaje — ${GERENCIAMIENTO_VIAJE_TIPO_LABELS[tipo]} · ${ticket.code}`,
      content: GerenciamientoViajeDialog,
      data: { tipo, ticket },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((result: GerenciamientoViaje | undefined) => {
      if (result) this.reload();
    });
  }

  protected completarFila(row: Record<string, unknown>): void {
    this.completar(row['ticket'] as TicketConductor, row['tipo'] as GerenciamientoViajeTipo);
  }
}
