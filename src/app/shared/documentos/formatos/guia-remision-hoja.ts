import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { GuiaRemision } from '../../../features/facturacion/models/guia-remision.model';
import type { Pedido } from '../../../features/facturacion/models/pedido.model';
import { fechaDoc } from '../documento-format.util';

const FILAS_MINIMAS = 6;

/**
 * Formato "Guía de remisión" (Facturación): cliente, solicitado / despachado por, lugar de origen, datos de quien
 * transporta, ítems y las firmas "Entregué conforme" / "Recibí conforme" (con nombre, cargo y C.I. de quien recibe
 * si ya se registraron; la firma se pone sobre el PDF).
 */
@Component({
  selector: 'app-doc-guia-remision',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guia-remision-hoja.html',
  styleUrl: './guia-remision-hoja.scss',
})
export class GuiaRemisionHoja {
  readonly guia = input.required<GuiaRemision>();
  readonly pedido = input.required<Pedido>();

  protected readonly fecha = fechaDoc;

  protected readonly filas = computed(() => {
    const items: (GuiaRemision['items'][number] | null)[] = [...this.guia().items];
    while (items.length < FILAS_MINIMAS) items.push(null);
    return items;
  });
}
