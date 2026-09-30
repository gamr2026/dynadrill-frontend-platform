import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MaintenanceOrderWithSubOrders, Repuesto, SubOrder } from '../../../features/maintenance/models/maintenance-order.model';
import type { UnitReport } from '../../../features/maintenance/models/unit-report.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc, renglones } from '../documento-format.util';

interface Problema {
  numero: number;
  falla: string[];
  trabajo: string[];
  repuestos: (Repuesto | null)[];
}

const PROBLEMAS_MINIMOS = 3;
const REPUESTOS_POR_PROBLEMA = 4;

/**
 * Formato "Orden de trabajo — Mantenimiento general" (Mecánico / Instrumental): hasta 3 problemas, cada uno con su
 * trabajo realizado y repuestos, trabajos adicionales y firmas (Operador/es, Supervisor, Jefe de Operaciones). Cada
 * sub-orden Mecánico o Instrumental de la orden ocupa un "Problema"; las Operativas van en su propio formato.
 */
@Component({
  selector: 'app-doc-orden-mantenimiento-general',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orden-mantenimiento-general-hoja.html',
  styleUrl: './orden-mantenimiento.scss',
})
export class OrdenMantenimientoGeneralHoja {
  readonly order = input.required<MaintenanceOrderWithSubOrders>();
  readonly unitReport = input.required<UnitReport>();

  protected readonly fecha = fechaDoc;

  private readonly subs = computed<SubOrder[]>(() => this.order().subOrders.filter(s => s.type !== 'Operativo'));

  protected readonly tiene = (tipo: 'Mecánico' | 'Instrumental'): boolean => this.subs().some(s => s.type === tipo);

  protected readonly problemas = computed<Problema[]>(() => {
    const r = this.unitReport();
    const subs = this.subs();
    const total = Math.max(PROBLEMAS_MINIMOS, subs.length);
    return Array.from({ length: total }, (_, i) => {
      const s = subs[i];
      const novedad = s?.type === 'Mecánico' ? r.problemasMecanica : s?.type === 'Instrumental' ? r.problemasInstrumentacion : '';
      const repuestos: (Repuesto | null)[] = [...(s?.repuestos ?? [])];
      while (repuestos.length < REPUESTOS_POR_PROBLEMA) repuestos.push(null);
      return {
        numero: i + 1,
        falla: renglones(s?.diagnostico || novedad, 2),
        trabajo: renglones(s?.actividadesCorrectivas, 4),
        repuestos,
      };
    });
  });

  protected readonly adicionales = computed(() => renglones(this.subs().map(s => s.trabajosAdicionales).filter(Boolean).join('\n'), 4));
  protected readonly operadores = computed(() => [...new Set(this.subs().map(s => s.assignedUserName).filter(Boolean))].join(', '));
  protected readonly horometro = computed(() => this.unitReport().horometroLlegada ?? this.unitReport().horometroSalida);
  protected readonly km = computed(() => this.unitReport().odometroLlegada ?? this.unitReport().odometroSalida);
}
