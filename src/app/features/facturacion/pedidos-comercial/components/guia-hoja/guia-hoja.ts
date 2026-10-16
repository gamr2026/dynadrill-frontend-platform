import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { fechaDoc } from '../../../../../shared/documentos/documento-format.util';
import type { Guia } from '../../models/guia-comercial';

const FILAS_MINIMAS = 6;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** "2026-02-12" → "12/Febrero/2026" (como se imprime en el formato). */
const fechaLarga = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${MESES[Number(m[2]) - 1]}/${m[1]}` : '';
};

/**
 * Formato "Guía de remisión" DYN-AFN-RE-013 del portal, para imprimir con `window.print()` (mismo mecanismo que el
 * resto de formatos, ver shared/documentos). Lleva los membretes de Dynadrill, la serie y el número de la guía, la
 * autorización del SRI, los datos del cliente y del transporte, los ítems (sin precios) y las firmas "Entregue conforme"
 * y "Recibí conforme". La firma se pone sobre el PDF (física o electrónica).
 */
@Component({
  selector: 'app-doc-guia-portal',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guia-hoja.html',
  styleUrl: './guia-hoja.scss',
})
export class GuiaHoja {
  readonly guia = input.required<Guia>();
  /** Del pedido: el campo y el pozo no los guarda la guía. */
  readonly campo = input<string | null>(null);
  readonly pozo = input<string | null>(null);

  protected readonly fecha = fechaDoc;
  protected readonly larga = fechaLarga;

  /** `003-001-0011036` → serie `003-001-` y número `0011036` (en rojo, como el talonario). */
  protected readonly serie = computed(() => this.guia().codigo.replace(/\d{7}$/, ''));
  protected readonly numero = computed(() => /\d{7}$/.exec(this.guia().codigo)?.[0] ?? this.guia().codigo);

  protected readonly vehiculo = computed(() => this.guia().vehiculo?.descripcion ?? '');

  protected readonly filas = computed(() => {
    const items: (Guia['items'][number] | null)[] = [...this.guia().items];
    while (items.length < FILAS_MINIMAS) items.push(null);
    return items;
  });
}
