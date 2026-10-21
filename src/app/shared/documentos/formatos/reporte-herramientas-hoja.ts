import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  TOOL_DAILY_STATUS_CODE,
  type OperativoDocHeader,
  type OperativoToolRef,
  type OperativoToolUsageEntry,
  type ToolDailyStatus,
} from '../../models/operativo-docs.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc } from '../documento-format.util';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Datos opcionales que solo FCR agrega a sus entradas de uso (completación/trabajo, picker, presión, peso, observación). */
type FcrUsageExtras = {
  tipoCompletacion?: string;
  tipoTrabajo?: string;
  tipoPicker?: string;
  presion?: string;
  peso?: string;
  observacion?: string;
};

interface FilaHerramienta {
  codigo: string;
  nombre: string;
  serie: string;
  celdas: Record<string, string>;
  total: number;
  conteo: Record<ToolDailyStatus, number>;
}

export interface FilaDetalle {
  herramienta: string;
  fecha: string;
  tipo: string;
  picker: string;
  presion: string;
  peso: string;
  observacion: string;
}

interface Mes {
  etiqueta: string;
  dias: number;
}

/**
 * Formato DYN-FCR-RE-008 "Reporte diario de herramientas en renta": datos del ticket, matriz herramienta × día
 * (O operación · S stand-by · D daily charge · V venta), instrucciones y, al final, la firma del representante de
 * Dynadrill y del representante del cliente / Company Man (en blanco: se firma sobre el PDF).
 */
@Component({
  selector: 'app-doc-reporte-herramientas',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-herramientas-hoja.html',
  styleUrl: './reporte-herramientas-hoja.scss',
})
export class ReporteHerramientasHoja {
  readonly header = input.required<OperativoDocHeader>();
  readonly tools = input.required<OperativoToolRef[]>();
  readonly usageLog = input.required<OperativoToolUsageEntry[]>();
  /** Detalle de completación / picker por herramienta (FCR); si no viene, sale de las entradas de uso que lo traigan. */
  readonly detallePicker = input<FilaDetalle[] | undefined>(undefined);

  protected readonly fecha = fechaDoc;

  /** Todos los días entre el primero y el último con uso (como las columnas continuas del Excel), con tope de 62. */
  protected readonly dias = computed<string[]>(() => {
    const fechas = this.usageLog()
      .map((e) => e.date)
      .sort();
    if (!fechas.length) return [];
    const out: string[] = [];
    const fin = new Date(`${fechas[fechas.length - 1]}T00:00:00`);
    for (
      let d = new Date(`${fechas[0]}T00:00:00`);
      d <= fin && out.length < 62;
      d.setDate(d.getDate() + 1)
    ) {
      out.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      );
    }
    return out;
  });

  protected readonly meses = computed<Mes[]>(() => {
    const res: Mes[] = [];
    for (const d of this.dias()) {
      const etiqueta = `${MESES[Number(d.slice(5, 7)) - 1]}-${d.slice(0, 4)}`;
      const ultimo = res[res.length - 1];
      if (ultimo?.etiqueta === etiqueta) ultimo.dias++;
      else res.push({ etiqueta, dias: 1 });
    }
    return res;
  });

  protected readonly filas = computed<FilaHerramienta[]>(() =>
    this.tools().map((t) => {
      const celdas: Record<string, string> = {};
      const conteo: Record<ToolDailyStatus, number> = {
        operacion: 0,
        stand_by: 0,
        daily_charge: 0,
        venta: 0,
      };
      for (const e of this.usageLog().filter((u) => u.toolId === t.id)) {
        celdas[e.date] = TOOL_DAILY_STATUS_CODE[e.status];
        conteo[e.status]++;
      }
      const marcas = conteo.operacion + conteo.daily_charge + conteo.venta;
      // un ítem que no es por día (km, pies, galones…) lleva su cantidad real en TOTAL
      const porCantidad = marcas === 0 && t.cantidad != null;
      return {
        codigo: t.codigo ?? '',
        nombre: porCantidad && t.unidad ? `${t.name} (${t.unidad})` : t.name,
        serie: t.serialCode ?? '',
        celdas,
        conteo,
        total: porCantidad ? Number(t.cantidad) : marcas,
      };
    }),
  );

  protected readonly fechaReporte = computed(() => {
    const d = this.dias();
    return d.length ? fechaDoc(d[d.length - 1]) : '';
  });

  /** Detalle propio de FCR (completación / picker / presión / peso) — solo si alguna entrada lo trae. */
  protected readonly detalle = computed(
    () =>
      this.detallePicker() ??
      this.usageLog()
        .filter(
          (e): e is OperativoToolUsageEntry & FcrUsageExtras => !!(e as FcrUsageExtras).tipoPicker,
        )
        .map((e): FilaDetalle => ({
          herramienta: this.tools().find((t) => t.id === e.toolId)?.name ?? `#${e.toolId}`,
          fecha: fechaDoc(e.date),
          tipo: e.tipoTrabajo ?? e.tipoCompletacion ?? '',
          picker: e.tipoPicker ?? '',
          presion: e.presion ?? '',
          peso: e.peso ?? '',
          observacion: e.observacion ?? '',
        })),
  );

  protected readonly dia = (iso: string): string => String(Number(iso.slice(8, 10)));
}
