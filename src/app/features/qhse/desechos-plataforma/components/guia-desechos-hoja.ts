import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DocumentoEncabezado } from '../../../../shared/documentos';
import { fechaDoc, fechaHoraDoc } from '../../../../shared/documentos/documento-format.util';
import { totalGalones, type DesechoDetalle, type LineaDesecho } from '../models/desecho';

/** El formato trae 17 renglones; si la guía tiene más se imprimen todos. */
const RENGLONES_MINIMOS = 17;

/**
 * Formato DYN-SGI-RE-063 «Guía de remisión de desechos», con los datos del backend nuevo. La guía viaja con el transportista: la sección
 * final (Despachado / Transportado / Recibido por) sale con nombre, fecha y firma en blanco para llenarse a mano.
 */
@Component({
  selector: 'app-doc-guia-desechos-plataforma',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guia-desechos-hoja.html',
  styleUrl: './guia-desechos-hoja.scss',
})
export class GuiaDesechosHoja {
  readonly desecho = input.required<DesechoDetalle>();

  protected readonly fecha = fechaDoc;
  protected readonly fechaHora = fechaHoraDoc;

  protected readonly manifiesto = computed(() => this.desecho().manifiesto);

  /** Quien despachó: la cuenta que registró la firma «despachado por», si ya firmó. */
  protected readonly despachadoPor = computed(
    () => this.manifiesto()?.firmas.find((f) => f.rol === 'despachado_por')?.registradoPor ?? '',
  );

  protected readonly filas = computed<(LineaDesecho | null)[]>(() => {
    const items: (LineaDesecho | null)[] = [...this.desecho().items];
    while (items.length < RENGLONES_MINIMOS) items.push(null);
    return items;
  });

  protected readonly total = computed(() => {
    const items = this.desecho().items;
    return items.length ? String(totalGalones(items)) : '';
  });

  protected readonly firmantes = ['DESPACHADO POR:', 'TRANSPORTADO POR:', 'RECIBIDO POR:'];
}
