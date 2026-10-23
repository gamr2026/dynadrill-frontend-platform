import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type {
  OperativoActivityLogEntry,
  OperativoDocHeader,
  OperativoToolRef,
  OperativoToolUsageEntry,
} from '../../../../../shared/models/operativo-docs.model';
import { ReporteHerramientasHoja } from '../../../../../shared/documentos/formatos/reporte-herramientas-hoja';
import {
  ReporteJobHoja,
  type ReporteJobExtras,
} from '../../../../../shared/documentos/formatos/reporte-job-hoja';

/** Un Reporte Job (un día) listo para su hoja. */
export interface HojaReporteJob {
  header: OperativoDocHeader;
  log: OperativoActivityLogEntry[];
}

/** Reporte de Herramientas listo para su hoja. */
export interface HojaReporteHerramientas {
  header: OperativoDocHeader;
  tools: OperativoToolRef[];
  usageLog: OperativoToolUsageEntry[];
}

/**
 * Todos los formatos que Operaciones envió para el pedido en un solo PDF: un Reporte Job por día (vertical) y, al final, el Reporte de
 * Herramientas (horizontal, como su formato físico). Cada formato empieza en su propia página; la orientación del Reporte de Herramientas
 * es una página con nombre, para poder mezclar las dos orientaciones en una sola impresión.
 */
@Component({
  selector: 'app-doc-pedido-completo',
  imports: [ReporteJobHoja, ReporteHerramientasHoja],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (j of reportesJob(); track $index) {
      <section class="doc-pedido__hoja">
        <app-doc-reporte-job [header]="j.header" [log]="j.log" [extras]="extras()" />
      </section>
    }
    @if (herramientas(); as h) {
      <section class="doc-pedido__hoja doc-pedido__hoja--apaisada">
        <app-doc-reporte-herramientas
          [header]="h.header"
          [tools]="h.tools"
          [usageLog]="h.usageLog"
        />
      </section>
    }
  `,
  styleUrl: './documentos-pedido-hoja.scss',
})
export class DocumentosPedidoHoja {
  readonly reportesJob = input<HojaReporteJob[]>([]);
  readonly herramientas = input<HojaReporteHerramientas | null>(null);
  readonly extras = input<ReporteJobExtras>({});
}
