import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MaintenanceOrderWithSubOrders, Repuesto, SubOrder } from '../../../features/maintenance/models/maintenance-order.model';
import { unitReportCode, type UnitReport } from '../../../features/maintenance/models/unit-report.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc, renglones } from '../documento-format.util';

const REPUESTOS_FILAS = 9;

/**
 * Formato "Orden de mantenimiento operativo": la falla y el mantenimiento realizado en líneas libres, horas de
 * trabajo, repuestos, trabajos adicionales y firmas. Reúne las sub-órdenes de tipo Operativo de la orden.
 */
@Component({
  selector: 'app-doc-orden-mantenimiento-operativo',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orden-mantenimiento-operativo-hoja.html',
  styleUrl: './orden-mantenimiento.scss',
})
export class OrdenMantenimientoOperativoHoja {
  readonly order = input.required<MaintenanceOrderWithSubOrders>();
  readonly unitReport = input.required<UnitReport>();

  protected readonly fecha = fechaDoc;
  protected readonly referencia = computed(() => unitReportCode(this.unitReport().reportNo));

  private readonly subs = computed<SubOrder[]>(() => this.order().subOrders.filter(s => s.type === 'Operativo'));

  protected readonly falla = computed(() => {
    const r = this.unitReport();
    const texto = this.subs().map(s => s.diagnostico).filter(Boolean).join('\n') || r.problemasOperaciones;
    return renglones(texto, 6);
  });
  protected readonly realizado = computed(() => renglones(this.subs().map(s => s.actividadesCorrectivas).filter(Boolean).join('\n'), 10));
  protected readonly horas = computed(() => {
    const total = this.subs().reduce((acc, s) => acc + (s.horasTrabajo ?? 0), 0);
    return total ? String(total) : '';
  });
  protected readonly repuestos = computed(() => {
    const r: (Repuesto | null)[] = this.subs().flatMap(s => s.repuestos ?? []);
    while (r.length < REPUESTOS_FILAS) r.push(null);
    return r;
  });
  protected readonly adicionales = computed(() => renglones(this.subs().map(s => s.trabajosAdicionales).filter(Boolean).join('\n'), 5));
  protected readonly operadores = computed(() => [...new Set(this.subs().map(s => s.assignedUserName).filter(Boolean))].join(', '));
  protected readonly horometro = computed(() => this.unitReport().horometroLlegada ?? this.unitReport().horometroSalida);
  protected readonly km = computed(() => this.unitReport().odometroLlegada ?? this.unitReport().odometroSalida);
}
