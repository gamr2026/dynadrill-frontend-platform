import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EntregaEpi, EpiItem } from '../../../features/qhse/epi/models/entrega-epi.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc } from '../documento-format.util';

/** El formato trae 12 renglones; si la entrega tiene más ítems se imprimen todos. */
const RENGLONES_MINIMOS = 12;

/**
 * Formato DYN-SGI-RE-032 "Registro de entrega de EPI y ropa de trabajo". En "Fecha / Firma recibido" va el nombre de
 * quien recibe (el trabajador) y en "entregado" el de quien entrega (personal de QHSE o de Talento Humano); la firma
 * en sí se pone sobre el PDF. Abajo, "Recibe conforme Talento Humano".
 */
@Component({
  selector: 'app-doc-entrega-epi',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entrega-epi-hoja.html',
  styleUrl: './entrega-epi-hoja.scss',
})
export class EntregaEpiHoja {
  readonly entrega = input.required<EntregaEpi>();

  protected readonly fecha = fechaDoc;

  protected readonly filas = computed<(EpiItem | null)[]>(() => {
    const items: (EpiItem | null)[] = [...this.entrega().items];
    while (items.length < RENGLONES_MINIMOS) items.push(null);
    return items;
  });

  /** Quien entrega: lo despachó QHSE (o Talento Humano, que también puede hacerlo) — el nombre que quedó en el despacho. */
  protected readonly entregadoPor = computed(() => this.entrega().despachadoPor ?? '');
}
