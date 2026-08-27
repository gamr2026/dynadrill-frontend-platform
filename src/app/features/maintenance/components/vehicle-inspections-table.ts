import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { VehicleInspection, vehicleInspectionHasNoCumple } from '../models/vehicle-inspection.model';
import { MaintenanceOrderWithSubOrders } from '../models/maintenance-order.model';
import { UnitReport } from '../models/unit-report.model';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type InspectionStateKey = 'sinNovedad' | 'conNovedad' | 'reportadoSinClasificar' | 'noRequiereMantenimiento' | 'enAtencion' | 'atendida';

interface InspectionState {
  key: InspectionStateKey;
  text: string;
  tone: DynadrillTagVariant;
}

/**
 * Solo editable mientras el Jefe no haya actuado sobre el reporte vinculado
 * (todavía no descartó ni clasificó la novedad) — así nunca se pisa una
 * decisión ya tomada.
 */
const EDITABLE_STATES: InspectionStateKey[] = ['sinNovedad', 'conNovedad', 'reportadoSinClasificar'];

/**
 * Tabla de inspecciones, compartida entre la vista de Pumping (con
 * "Editar", mientras el Jefe no haya actuado) y la del Jefe de Mantenimiento
 * (solo lectura, visibilidad de todo el historial — con y sin novedad). El
 * rol "Conductor" que existía antes se absorbió hacia Pumping (ver cfa3c95):
 * quien llena la inspección es el Operador de Pumping designado para el
 * viaje, no un rol propio de Mantenimiento.
 */
@Component({
  selector: 'app-vehicle-inspections-table',
  imports: [DynadrillDataTableComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehicle-inspections-table.html',
})
export class VehicleInspectionsTable {
  readonly inspections = input.required<VehicleInspection[]>();
  readonly orders = input.required<MaintenanceOrderWithSubOrders[]>();
  readonly unitReports = input.required<UnitReport[]>();
  /** Solo Pumping puede editar — el Jefe de Mantenimiento siempre ve la tabla de solo lectura. */
  readonly editable = input(false);
  /** Solo el Supervisor puede aprobar (Plan 2026, 5.3 — "Firma del Supervisor"). */
  readonly approvable = input(false);

  readonly view = output<VehicleInspection>();
  readonly edit = output<VehicleInspection>();
  readonly approve = output<VehicleInspection>();

  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'unidadCode', header: 'Unidad', sortable: true, searchable: true },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'puntoPartida', header: 'Punto de partida' },
    { key: 'destino', header: 'Destino' },
    { key: 'inspeccionadoPor', header: 'Inspeccionado por' },
    { key: 'estadoBadge', header: 'Estado', type: 'badge' },
    { key: 'aprobacionBadge', header: 'Aprobación', type: 'badge' },
  ]);

  /**
   * El badge refleja el estado real de seguimiento, no solo si hubo un
   * "No cumple" en el momento de la inspección — así no se queda fijo en
   * "Con novedades" para siempre, incluso después de que Mantenimiento
   * resuelva el problema.
   */
  private estadoFor(i: VehicleInspection): InspectionState {
    if (!vehicleInspectionHasNoCumple(i)) return { key: 'sinNovedad', text: 'Sin novedades', tone: 'success' };
    if (!i.unitReportId) return { key: 'conNovedad', text: 'Con novedades', tone: 'error' };

    const report = this.unitReports().find(r => r.id === i.unitReportId);
    if (report?.dismissed) return { key: 'noRequiereMantenimiento', text: 'No requiere mantenimiento', tone: 'neutral' };

    const order = this.orders().find(o => o.unitReportId === i.unitReportId);
    if (!order) return { key: 'reportadoSinClasificar', text: 'Reportado — sin clasificar', tone: 'warning' };
    if (order.returnedToOperation) return { key: 'atendida', text: 'Novedad atendida', tone: 'success' };
    return { key: 'enAtencion', text: 'En atención', tone: 'info' };
  }

  protected readonly rows = computed(() =>
    this.inspections().map(i => {
      const estado = this.estadoFor(i);
      return {
        id: i.id,
        unidadCode: i.unidadCode,
        fecha: formatDate(i.fecha),
        puntoPartida: i.puntoPartida,
        destino: i.destino || '—',
        inspeccionadoPor: i.inspeccionadoPor,
        estadoBadge: { text: estado.text, tone: estado.tone },
        aprobacionBadge: i.supervisorApprovedBy
          ? { text: `Aprobado por ${i.supervisorApprovedBy}`, tone: 'success' as const }
          : { text: 'Pendiente', tone: 'warning' as const },
        canEdit: this.editable() && EDITABLE_STATES.includes(estado.key),
        canApprove: this.approvable() && !i.supervisorApprovedBy,
      };
    }),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  protected onView(row: Record<string, unknown>): void {
    const inspection = this.inspections().find(i => i.id === row['id']);
    if (inspection) this.view.emit(inspection);
  }

  protected onEdit(row: Record<string, unknown>): void {
    const inspection = this.inspections().find(i => i.id === row['id']);
    if (inspection) this.edit.emit(inspection);
  }

  protected onApprove(row: Record<string, unknown>): void {
    const inspection = this.inspections().find(i => i.id === row['id']);
    if (inspection) this.approve.emit(inspection);
  }
}
