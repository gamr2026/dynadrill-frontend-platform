import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { desechoTotalGalones, type Desecho, type DesechoItem } from '../../../features/qhse/desechos/models/desecho.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc } from '../documento-format.util';

/** El formato trae 17 renglones; si la guía tiene más se imprimen todos. */
const RENGLONES_MINIMOS = 17;

/**
 * Formato DYN-SGI-RE-063 "Guía de remisión de desechos". La guía viaja con el transportista: la sección final
 * (Despachado / Transportado / Recibido por) sale con nombre, fecha y firma en blanco para llenarse a mano.
 */
@Component({
  selector: 'app-doc-guia-desechos',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guia-desechos-hoja.html',
  styleUrl: './guia-desechos-hoja.scss',
})
export class GuiaDesechosHoja {
  readonly desecho = input.required<Desecho>();

  protected readonly fecha = fechaDoc;

  protected readonly filas = computed<(DesechoItem | null)[]>(() => {
    const items: (DesechoItem | null)[] = [...this.desecho().items];
    while (items.length < RENGLONES_MINIMOS) items.push(null);
    return items;
  });

  protected readonly totalGalones = computed(() => {
    const items = this.desecho().items;
    return items.length ? String(desechoTotalGalones(items)) : '';
  });

  protected readonly firmantes = ['DESPACHADO POR:', 'TRANSPORTADO POR:', 'RECIBIDO POR:'];
}
