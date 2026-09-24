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
  GerenciamientoViaje,
  GerenciamientoViajeEstado,
} from '../../../conductor/models/gerenciamiento-viaje.model';
import { GerenciamientoViajeService } from '../../../conductor/services/gerenciamiento-viaje.service';
import { GerenciamientoViajeDetailDialog, GerenciamientoViajeDetailDialogData } from '../../../conductor/components/gerenciamiento-viaje-detail-dialog';
import { MotivoDialog, MotivoDialogData } from '../../../../shared/components/motivo-dialog/motivo-dialog';
import { AuthService } from '../../../../core/services/auth.service';

const ESTADO_TONE: Record<GerenciamientoViajeEstado, DynadrillTagVariant> = {
  pendiente: 'warning',
  aprobado: 'success',
  rechazado: 'error',
};

/**
 * Bandeja compartida — el Supervisor (de Pumping) autoriza/rechaza los de
 * riesgo BAJO; el Jefe de Base (y Superadmin) los de MEDIO/ALTO. Ambos ven
 * la misma lista; los botones de acción solo aparecen cuando el nivel de
 * riesgo del registro corresponde a lo que el rol actual puede gestionar
 * (`puedeGestionar`) — el backend igual lo hace cumplir (403 si no).
 */
@Component({
  selector: 'app-gerenciamiento-viaje-page',
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillButtonComponent, DynadrillIconButtonComponent, DynadrillDataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gerenciamiento-viaje-page.html',
  styleUrl: './gerenciamiento-viaje-page.scss',
})
export class GerenciamientoViajePage {
  private readonly service = inject(GerenciamientoViajeService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  /** Jefe de Base/Superadmin gestionan cualquier nivel; el resto (Supervisor/Supervisor Pumping) solo BAJO — mismo corte que GerenciamientoViajeController.assertPuedeGestionar en el backend. */
  protected readonly esJefeDeBase = computed(() => {
    const roleName = this.auth.currentUser()?.roleName;
    return roleName === 'Jefe de Base' || roleName === 'Superadmin';
  });

  protected readonly loading = signal(true);
  protected readonly viajes = signal<GerenciamientoViaje[]>([]);
  protected readonly estadoLabels = GERENCIAMIENTO_VIAJE_ESTADO_LABELS;
  protected readonly filtro = signal<GerenciamientoViajeEstado | 'todos'>('pendiente');

  protected readonly filtros: { label: string; value: GerenciamientoViajeEstado | 'todos' }[] = [
    { label: 'Pendientes', value: 'pendiente' },
    { label: 'Aprobados', value: 'aprobado' },
    { label: 'Rechazados', value: 'rechazado' },
    { label: 'Todos', value: 'todos' },
  ];

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.viajes();
    return [
      { label: 'Total', value: all.length },
      { label: 'Pendientes', value: all.filter(g => g.estado === 'pendiente').length, tone: 'warning' },
      { label: 'Aprobados', value: all.filter(g => g.estado === 'aprobado').length, tone: 'success' },
      { label: 'Rechazados', value: all.filter(g => g.estado === 'rechazado').length, tone: 'error' },
    ];
  });

  protected readonly filtrados = computed(() => {
    const f = this.filtro();
    return f === 'todos' ? this.viajes() : this.viajes().filter(g => g.estado === f);
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'origen', header: 'Origen', searchable: true },
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
    this.filtrados().map(g => ({
      id: g.id,
      code: g.code,
      fecha: g.fecha,
      origen: g.origen,
      destino: g.destino,
      riskLevel: g.riskLevel,
      estadoBadge: { text: this.estadoLabels[g.estado], tone: ESTADO_TONE[g.estado] },
      puedeGestionar: this.esJefeDeBase() || g.riskLevel === 'BAJO',
      gv: g,
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.service.listAll().subscribe({
      next: viajes => {
        this.viajes.set(viajes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los gerenciamientos de viaje.');
      },
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

  protected aprobar(row: Record<string, unknown>): void {
    const gv = row['gv'] as GerenciamientoViaje;
    this.service.aprobar(gv.id).subscribe({
      next: () => {
        this.notify.success('Autorizado', `${gv.code} autorizado.`);
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo autorizar el gerenciamiento de viaje.'),
    });
  }

  protected rechazar(row: Record<string, unknown>): void {
    const gv = row['gv'] as GerenciamientoViaje;
    const ref = this.dialogService.open<MotivoDialog, MotivoDialogData>({
      title: 'Rechazar Gerenciamiento de Viaje',
      content: MotivoDialog,
      data: { mensaje: `¿Por qué se rechaza el gerenciamiento de viaje ${gv.code}?`, label: 'Motivo del rechazo' },
      footer: false,
    });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (!motivo) return;
      this.service.rechazar(gv.id, motivo).subscribe({
        next: () => {
          this.notify.success('Rechazado', `${gv.code} rechazado.`);
          this.reload();
        },
        error: () => this.notify.error('Error', 'No se pudo rechazar el gerenciamiento de viaje.'),
      });
    });
  }
}
