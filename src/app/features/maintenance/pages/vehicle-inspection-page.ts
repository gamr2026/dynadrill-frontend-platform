import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { VehicleInspection } from '../models/vehicle-inspection.model';
import { MaintenanceOrderWithSubOrders } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';
import { VehicleInspectionsService } from '../services/vehicle-inspections.service';
import { MaintenanceOrdersService } from '../services/maintenance-orders.service';
import { UnitReportsService } from '../services/unit-reports.service';
import { VehicleInspectionDialog, VehicleInspectionDialogData } from '../components/vehicle-inspection-dialog';
import { VehicleInspectionsTable } from '../components/vehicle-inspections-table';

/** DYN-SGI-RE-068 — inspección previa a la salida, la llena el Conductor. */
@Component({
  selector: 'app-vehicle-inspection-page',
  imports: [DynadrillButtonComponent, DynadrillIconComponent, DynadrillSpinnerComponent, DynadrillScreenHeaderComponent, VehicleInspectionsTable],
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
  protected readonly isConductor = computed(() => this.roleName() === 'Conductor');
  protected readonly isSupervisor = computed(() => this.roleName() === 'Supervisor');

  protected readonly loading = signal(true);
  protected readonly inspections = signal<VehicleInspection[]>([]);
  protected readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  protected readonly unitReports = signal<UnitReport[]>([]);

  constructor() {
    this.reload();
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

  editInspection(existing: VehicleInspection): void {
    const ref = this.dialog.open<VehicleInspectionDialog, VehicleInspectionDialogData>({
      title: 'Editar Inspección de Vehículos — DYN-SGI-RE-068',
      content: VehicleInspectionDialog,
      data: { existing },
      size: 'large',
      footer: false,
    });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }

  approveInspection(inspection: VehicleInspection): void {
    this.inspectionsService.approve(inspection.id, this.auth.currentUser()?.name ?? '').subscribe({
      next: () => {
        this.notify.success('Aprobada', `Inspección de ${inspection.unidadCode} aprobada.`);
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo aprobar la inspección.'),
    });
  }
}
