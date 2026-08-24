import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { VehicleInspection, vehicleInspectionHasNoCumple } from '../models/vehicle-inspection.model';
import { MaintenanceOrderWithSubOrders } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { VehicleInspectionsService } from '../services/vehicle-inspections.service';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { VehicleInspectionDialog } from '../components/vehicle-inspection-dialog';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** DYN-SGI-RE-068 — inspección previa a la salida, la llena el Conductor. */
@Component({
  selector: 'app-vehicle-inspection-page',
  imports: [DynadrillButtonComponent, DynadrillIconComponent, DynadrillDataTableComponent, DynadrillSpinnerComponent, DynadrillScreenHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehicle-inspection-page.html',
  styleUrl: './vehicle-inspection-page.scss',
})
export class VehicleInspectionPage {
  private readonly inspectionsService = inject(VehicleInspectionsService);
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly roleName = computed(() => this.auth.currentUser()?.roleName ?? '');

  protected readonly loading = signal(true);
  protected readonly inspections = signal<VehicleInspection[]>([]);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);

  // Mismo patrón que el resto del módulo: solo fijamos la primera columna +
  // acciones cuando la tabla realmente podría no entrar en pantalla.
  private readonly narrowViewport = signal(window.matchMedia('(max-width: 840px)').matches);
  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'unidadCode', header: 'Unidad', sortable: true, searchable: true, fixed: this.narrowViewport() ? 'left' : undefined },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'puntoPartida', header: 'Punto de partida' },
    { key: 'destino', header: 'Destino' },
    { key: 'inspeccionadoPor', header: 'Inspeccionado por' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge', fixed: this.narrowViewport() ? 'right' : undefined },
  ]);
  protected readonly tableScrollX = computed(() => (this.narrowViewport() ? '760px' : undefined));

  /**
   * El badge refleja el estado real de seguimiento, no solo si hubo un
   * "No cumple" en el momento de la inspección — antes se quedaba fijo en
   * "Con novedades" para siempre, incluso después de que Mantenimiento
   * resolviera el problema.
   */
  private estadoFor(i: VehicleInspection): { text: string; tone: DynadrillTagVariant } {
    if (!vehicleInspectionHasNoCumple(i)) return { text: 'Sin novedades', tone: 'success' };
    if (!i.unitReportId) return { text: 'Con novedades', tone: 'error' };

    const report = this.unitReports().find(r => r.id === i.unitReportId);
    if (report?.dismissed) return { text: 'No requiere mantenimiento', tone: 'neutral' };

    const order = this.orders().find(o => o.unitReportId === i.unitReportId);
    if (!order) return { text: 'Reportado — sin clasificar', tone: 'warning' };
    if (order.returnedToOperation) return { text: 'Novedad atendida', tone: 'success' };
    return { text: 'En atención', tone: 'info' };
  }

  protected readonly rows = computed(() =>
    this.inspections().map(i => ({
      id: i.id,
      unidadCode: i.unidadCode,
      fecha: formatDate(i.fecha),
      puntoPartida: i.puntoPartida,
      destino: i.destino || '—',
      inspeccionadoPor: i.inspeccionadoPor,
      estadoBadge: this.estadoFor(i),
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();

    const mq = window.matchMedia('(max-width: 840px)');
    const onChange = (e: MediaQueryListEvent): void => this.narrowViewport.set(e.matches);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({
      inspections: this.inspectionsService.list(),
      orders: this.ordersService.list(),
      unitReports: this.unitReportsService.list(),
    }).subscribe({
      next: ({ inspections, orders, unitReports }) => {
        this.inspections.set(inspections);
        this.orders.set(orders);
        this.unitReports.set(unitReports);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar las inspecciones.');
      },
    });
  }

  openInspection(): void {
    const ref = this.dialog.open<VehicleInspectionDialog>({
      title: 'Inspección de Vehículos — DYN-SGI-RE-068',
      content: VehicleInspectionDialog,
      size: 'large',
      footer: false,
    });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }
}
