import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Prefactura } from '../../../features/facturacion/models/prefactura.model';
import { itemsEstimadosDe, type Pedido } from '../../../features/facturacion/models/pedido.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc } from '../documento-format.util';

const FILAS_MINIMAS = 25;

/** Condiciones de servicio fijas — mismo texto de la plantilla DYN-AFN-RE-11. */
const CONDICIONES_SERVICIO =
  'Los daños totales o parciales de equipos y/o herramientas, días de espera, equipos y personal, suspensión de ' +
  'trabajo o demás situaciones que pudieran presentarse durante la operación, estarán sujetas a los términos y ' +
  'condiciones del contrato bajo el cual se oferta el presente servicio.';

/**
 * Formato DYN-AFN-RE-11 "Prefactura": datos del pedido, condiciones de servicio, detalle (ítem, código, cantidad,
 * unidad, descripción, precio unitario y total), "los precios no incluyen IVA", subtotal y total, y la sección de
 * firmas del Gerente General / representante de Dynadrill y del cliente (se firma sobre el PDF).
 */
@Component({
  selector: 'app-doc-prefactura',
  imports: [DecimalPipe, DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefactura-hoja.html',
  styleUrl: './prefactura-hoja.scss',
})
export class PrefacturaHoja {
  readonly prefactura = input.required<Prefactura>();
  readonly pedido = input.required<Pedido>();

  protected readonly fecha = fechaDoc;
  protected readonly condiciones = CONDICIONES_SERVICIO;

  protected readonly esVerbal = computed(() => this.pedido().solicitudMedio === 'verbal');

  protected readonly observaciones = computed(() =>
    itemsEstimadosDe(this.pedido())
      .map(i => i.descripcion)
      .filter(Boolean)
      .join(' · '),
  );

  protected readonly filas = computed(() => {
    const items: (Prefactura['items'][number] | null)[] = [...this.prefactura().items];
    while (items.length < FILAS_MINIMAS) items.push(null);
    return items;
  });
}
