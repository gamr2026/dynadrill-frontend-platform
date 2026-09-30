import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DynadrillInspectionItem } from '@digitec-it-projects/dynadrill-ui';
import type { PumpingUnitReport } from '../../../features/operations/pumping/models/pumping.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { DocumentoFirmas, type DocumentoFirmante } from '../documento-firmas';
import { fechaDoc, marcaInspeccion, renglones } from '../documento-format.util';

type Lado = 'salida' | 'llegada';

/**
 * Formato DYN-MNT-RE-012 "Reporte de Unidad" — réplica del Excel: datos del trabajo, presión de neumáticos (A–D) y
 * hubodómetro, inspección (Salida = chasis; Llegada = motor, plataforma e instrumentación), problemas por área,
 * operatividad y firmas. Es un único documento con salida y llegada: si la llegada todavía no se hizo, esas
 * columnas salen vacías (se puede descargar con lo aprobado hasta el momento).
 */
@Component({
  selector: 'app-doc-reporte-unidad',
  imports: [DocumentoEncabezado, DocumentoFirmas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reporte-unidad-hoja.html',
  styleUrl: './reporte-unidad-hoja.scss',
})
export class ReporteUnidadHoja {
  readonly reporte = input.required<PumpingUnitReport>();
  /** Nº de ticket, si se quiere mostrar junto al código del reporte. */
  readonly ticketCode = input<string>('');

  protected readonly fecha = fechaDoc;
  protected readonly marca = marcaInspeccion;
  protected readonly renglones = renglones;

  /** Letras A–D de las 4 llantas del formato (posición física entre paréntesis). */
  protected readonly llantas = computed(() =>
    this.reporte().tires.slice(0, 4).map((t, i) => ({ letra: 'ABCD'[i], posicion: t.position, salida: t.salida, llegada: t.llegada })),
  );

  protected readonly hubodometro = computed(() => {
    const r = this.reporte();
    const juntar = (valores: (number | null)[]): string => valores.filter(v => v !== null).join(' · ');
    return {
      salida: juntar(r.hubodometroOrigen.map(h => h.salida)),
      llegada: juntar(r.hubodometroDestino.map(h => h.salida)),
    };
  });

  /** Columna SALIDA = inspección de chasis (salida). Columnas LLEGADA = motor / plataforma / instrumentación (llegada). */
  protected readonly estado = (item: DynadrillInspectionItem, lado: Lado): string => marcaInspeccion(item[lado]);

  protected readonly firmantes = computed<DocumentoFirmante[]>(() => {
    const r = this.reporte();
    return [
      { cargo: 'Salida', nombre: r.departureOperatorName, detalle: 'OPERADOR (Nombre y Firma)' },
      { cargo: 'Llegada', nombre: r.arrivalOperatorName, detalle: 'OPERADOR (Nombre y Firma)' },
    ];
  });

  protected readonly novedades = computed(() => {
    const n = this.reporte().novelties;
    return {
      mecanica: renglones(n.mecanica, 4),
      instrumentacion: renglones(n.instrumentacion, 3),
      operaciones: renglones(n.operaciones, 5),
    };
  });
}
