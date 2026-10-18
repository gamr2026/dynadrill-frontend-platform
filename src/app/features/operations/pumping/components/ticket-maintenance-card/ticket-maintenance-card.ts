import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillTagComponent,
  DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { MaintenanceOrderWithSubOrders, SubOrder, SubOrderStatus } from '../../../../maintenance/models/maintenance-order.model';
import { UnitReport } from '../../../../maintenance/models/unit-report.model';
import { MaintenanceOrdersService } from '../../../../maintenance/services/maintenance-orders.service';
import { UnitReportsService } from '../../../../maintenance/services/unit-reports.service';
import { SuborderDetailDialog, SuborderDetailDialogData } from '../../../../maintenance/components/suborder-detail-dialog';
import { SuborderExecutionDialog, SuborderExecutionDialogData } from '../../../../maintenance/components/suborder-execution-dialog';
import { SuborderReviewDialog, SuborderReviewDialogData } from '../../../../maintenance/components/suborder-review-dialog';

const STATUS_TONE: Record<SubOrderStatus, DynadrillTagVariant> = {
  Pendiente: 'warning',
  'En Diagnóstico': 'info',
  'En Ejecución': 'brand',
  'En Revisión de Cierre': 'info',
  Cerrado: 'success',
  'Corrección Solicitada': 'error',
  'Derivado a Pumping': 'neutral',
};

/** Mismas reglas que "Mis tareas" (Operador de Mantenimiento) y la bandeja operativa del Operador de Pumping. */
const EJECUTABLE_MECANICO_INSTRUMENTAL: readonly SubOrderStatus[] = ['Pendiente', 'En Diagnóstico', 'En Ejecución', 'Corrección Solicitada'];
const EJECUTABLE_OPERATIVO: readonly SubOrderStatus[] = ['Derivado a Pumping', 'En Diagnóstico', 'En Ejecución', 'Corrección Solicitada'];
/** Ver `ModuleRoles.maintenanceOperativoReview` en el backend. */
const REVISORES_OPERATIVO: readonly string[] = ['Jefe de Mantenimiento', 'Supervisor Pumping', 'Supervisor'];

/**
 * `userId` es el UUID de la cuenta (`AuthService.currentUser().id`), el mismo que trae `assignedUserId`.
 */
export function puedeEjecutar(sub: SubOrder, rol: string, userId: string | null | undefined): boolean {
  if (sub.type === 'Operativo') return rol === 'Operador' && EJECUTABLE_OPERATIVO.includes(sub.status);
  return rol === 'Operador de Mantenimiento' && userId != null && sub.assignedUserId === userId && EJECUTABLE_MECANICO_INSTRUMENTAL.includes(sub.status);
}

export function puedeRevisar(sub: SubOrder, rol: string): boolean {
  if (sub.status !== 'En Revisión de Cierre') return false;
  return sub.type === 'Operativo' ? REVISORES_OPERATIVO.includes(rol) : rol === 'Jefe de Mantenimiento';
}

interface FilaMantenimiento {
  sub: SubOrder;
  order: MaintenanceOrderWithSubOrders;
  novedad: string;
  responsable: string;
  tono: DynadrillTagVariant;
  ejecutable: boolean;
  revisable: boolean;
}

/**
 * Card "Mantenimientos" del detalle del ticket — el mantenimiento de la
 * unidad ya no es un paso del flujo (a veces se hace meses después del
 * cierre), así que se sigue acá, en cualquier estado del ticket. Muestra
 * todas las sub-órdenes de la unidad y permite actuar según el rol, con los
 * mismos diálogos del módulo de Mantenimiento.
 */
@Component({
  selector: 'app-ticket-maintenance-card',
  imports: [DatePipe, DynadrillIconButtonComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-maintenance-card.html',
  styleUrl: './ticket-maintenance-card.scss',
})
export class TicketMaintenanceCard {
  private readonly ordersService = inject(MaintenanceOrdersService);
  private readonly unitReportsService = inject(UnitReportsService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);

  /** Pedidos del backend nuevo: las órdenes de las unidades de este ticket (la unidad del ticket es un vehículo; la de Mantenimiento, su unidad de Flota). */
  readonly ticketId = input<string>();
  /** Pantalla vieja (demo): se filtra por el código de la unidad. */
  readonly unitCode = input<string>('');

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  private readonly orders = signal<MaintenanceOrderWithSubOrders[]>([]);
  private readonly unitReports = signal<UnitReport[]>([]);

  protected readonly filas = computed<FilaMantenimiento[]>(() => {
    const rol = this.auth.currentUser()?.roleName ?? '';
    const userId = this.auth.currentUser()?.id;
    return this.orders()
      .filter(order => !!this.ticketId() || order.unidad === this.unitCode())
      .flatMap(order =>
        order.subOrders.map(sub => ({
          sub,
          order,
          novedad: this.novedadDe(order, sub),
          responsable: this.responsableDe(sub),
          tono: STATUS_TONE[sub.status],
          ejecutable: puedeEjecutar(sub, rol, userId),
          revisable: puedeRevisar(sub, rol),
        })),
      );
  });

  protected readonly abiertos = computed(() => this.filas().filter(f => f.sub.status !== 'Cerrado').length);
  protected readonly cerrados = computed(() => this.filas().length - this.abiertos());

  constructor() {
    this.cargar();
  }

  protected verDetalle(fila: FilaMantenimiento): void {
    this.dialog.open<SuborderDetailDialog, SuborderDetailDialogData>({
      title: 'Detalle — ' + fila.sub.code,
      content: SuborderDetailDialog,
      data: { subOrder: fila.sub, orderCode: fila.order.code, novedadOriginal: fila.novedad },
      footer: false,
    });
  }

  protected ejecutar(fila: FilaMantenimiento): void {
    const ref = this.dialog.open<SuborderExecutionDialog, SuborderExecutionDialogData>({
      title: 'Diagnóstico y Ejecución — ' + fila.sub.code,
      content: SuborderExecutionDialog,
      data: { subOrder: fila.sub, novedadOriginal: fila.novedad },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.cargar();
    });
  }

  protected revisar(fila: FilaMantenimiento): void {
    const ref = this.dialog.open<SuborderReviewDialog, SuborderReviewDialogData>({
      title: 'Revisar mantenimiento — ' + fila.sub.code,
      content: SuborderReviewDialog,
      data: { subOrder: fila.sub, novedadOriginal: fila.novedad },
      footer: false,
    });
    ref.afterClose.subscribe(changed => {
      if (changed) this.cargar();
    });
  }

  private cargar(): void {
    const ordenes$ = this.ticketId() ? this.ordersService.listForTicket(this.ticketId() as string) : this.ordersService.list();
    forkJoin([ordenes$, this.unitReportsService.list()]).subscribe({
      next: ([orders, reports]) => {
        this.orders.set(orders);
        this.unitReports.set(reports);
        this.error.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Lo que reportó el operador en el Reporte de Unidad, según el tipo de la sub-orden. */
  private novedadDe(order: MaintenanceOrderWithSubOrders, sub: SubOrder): string {
    const report = this.unitReports().find(r => r.id === order.unitReportId);
    if (!report) return '';
    if (sub.type === 'Mecánico') return report.problemasMecanica;
    if (sub.type === 'Instrumental') return report.problemasInstrumentacion;
    return report.problemasOperaciones;
  }

  private responsableDe(sub: SubOrder): string {
    if (sub.type === 'Operativo') return sub.status === 'Pendiente' ? 'Pendiente de derivar a Pumping' : 'Operador de Pumping';
    return sub.assignedUserName ?? 'Sin asignar';
  }
}
