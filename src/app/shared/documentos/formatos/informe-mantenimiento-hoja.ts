import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MaintenanceOrderWithSubOrders, Repuesto } from '../../../features/maintenance/models/maintenance-order.model';
import { unitReportCode, type UnitReport } from '../../../features/maintenance/models/unit-report.model';
import type { RegistroMantenimiento } from '../../../features/maintenance/models/historial-mantenimiento.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc, renglones } from '../documento-format.util';

/**
 * DYN-MNT-RE-008 sirve tanto para el cierre correctivo (una orden con sus sub-órdenes) como para un preventivo
 * ejecutado (un único registro de historial) — el formato físico trae ambas casillas.
 */
export type InformeMantenimientoDatos =
  | { clase: 'Correctivo'; order: MaintenanceOrderWithSubOrders; unitReport: UnitReport }
  | { clase: 'Preventivo'; registro: RegistroMantenimiento; unidadNombre: string };

const FILAS_REPUESTOS = 12;

/**
 * Formato DYN-MNT-RE-008 "Informe de mantenimiento": unidad, fecha, referencia, tipo (predictivo / preventivo /
 * correctivo), horómetros, actividades, detalle de trabajos realizados con su estado, repuestos, observaciones y
 * firmas (Reportado por / Jefe de Mantenimiento) — las firmas solo existen en el PDF.
 */
@Component({
  selector: 'app-doc-informe-mantenimiento',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './informe-mantenimiento-hoja.html',
  styleUrl: './informe-mantenimiento-hoja.scss',
})
export class InformeMantenimientoHoja {
  readonly datos = input.required<InformeMantenimientoDatos>();

  /** Lo mismo para las dos clases, ya normalizado a los campos del formato. */
  protected readonly vista = computed(() => {
    const d = this.datos();
    if (d.clase === 'Correctivo') {
      const { order, unitReport: r } = d;
      const repuestos: Repuesto[] = order.subOrders.flatMap(s => s.repuestos ?? []);
      return {
        clase: 'Correctivo' as const,
        unidad: order.unidad,
        fecha: fechaDoc(order.createdAt),
        referencia: `${order.code} · Reporte ${unitReportCode(r.reportNo)}`,
        horometro: r.horometroLlegada ?? r.horometroSalida,
        km: r.odometroLlegada ?? r.odometroSalida,
        condicion: order.finalUnitState ?? '',
        actividades: [r.problemasMecanica, r.problemasInstrumentacion, r.problemasOperaciones].filter(Boolean).join('\n'),
        trabajos: order.subOrders.map(s => ({
          texto: [s.type, s.actividadesCorrectivas ?? s.diagnostico ?? ''].filter(Boolean).join(': '),
          estado: s.status,
        })),
        repuestos,
        observaciones: [order.finalObservaciones, ...order.subOrders.map(s => s.trabajosAdicionales)].filter(Boolean).join('\n'),
        reportadoPor: r.operadorSalida,
        jefe: order.finalResponsable ?? '',
      };
    }
    const g = d.registro;
    return {
      clase: 'Preventivo' as const,
      unidad: `${g.unidadCode} — ${d.unidadNombre}`,
      fecha: fechaDoc(g.fecha),
      referencia: g.tipoServicio ? `Tipo ${g.tipoServicio}` : '',
      horometro: g.horometro,
      km: g.km,
      condicion: '',
      actividades: g.tipoServicio ? `Mantenimiento preventivo — servicio tipo ${g.tipoServicio}` : 'Mantenimiento preventivo',
      trabajos: [{ texto: `Ejecutado por ${g.ejecutadoPor}${g.proveedor ? ' — ' + g.proveedor : ''}`, estado: 'Realizado' }],
      repuestos: [] as Repuesto[],
      observaciones: g.observaciones ?? '',
      reportadoPor: g.responsable ?? '',
      jefe: '',
    };
  });

  /** Estado final de la unidad, con las palabras del formato. */
  protected readonly condicion = computed(() => {
    const c = this.vista().condicion;
    return c === 'Disponible' ? 'OPERATIVO' : c === 'Con restricciones' ? 'CON RESTRICCIONES' : '';
  });

  protected readonly actividades = computed(() => renglones(this.vista().actividades, 5));
  protected readonly trabajos = computed(() => {
    const t = [...this.vista().trabajos];
    while (t.length < 9) t.push({ texto: '', estado: '' });
    return t;
  });
  protected readonly repuestos = computed(() => {
    const r: (Repuesto | null)[] = [...this.vista().repuestos];
    while (r.length < FILAS_REPUESTOS) r.push(null);
    return r;
  });
  protected readonly observaciones = computed(() => renglones(this.vista().observaciones, 2));
}
