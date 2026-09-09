import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { Prefactura } from '../models/prefactura.model';
import { Pedido, itemsEstimadosDe } from '../models/pedido.model';

export interface PrefacturaPdfDialogData {
  prefactura: Prefactura;
  pedido: Pedido;
}

/** Condiciones de servicio fijas — mismo texto de la plantilla real DYN-AFN-RE-11B. */
const CONDICIONES_SERVICIO =
  'Los daños totales o parciales de equipos y/o herramientas, días de espera, equipos y personal, suspensión de ' +
  'trabajo o demás situaciones que pudieran presentarse durante la operación, estarán sujetas a los términos y ' +
  'condiciones del contrato bajo el cual se oferta el presente servicio.';

/**
 * Vista imprimible de la Prefactura — formato `DYN-AFN-RE-11B` (réplica del
 * Excel real: cabecera con nº de ticket destacado, condiciones de servicio,
 * detalle con columnas Tipo/Material/Servicio, "los precios no incluyen
 * IVA" y firma electrónica). Sin librería de PDF: `window.print()`.
 */
@Component({
  selector: 'app-prefactura-pdf-dialog',
  imports: [DecimalPipe, DatePipe, UpperCasePipe, DynadrillTextComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefactura-pdf-dialog.html',
  styleUrl: './prefactura-pdf-dialog.scss',
})
export class PrefacturaPdfDialog {
  protected readonly data = inject<PrefacturaPdfDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<PrefacturaPdfDialog>);

  protected readonly printDate = new Date().toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
  protected readonly condicionesServicio = CONDICIONES_SERVICIO;

  protected readonly esVerbal = computed(() => this.data.pedido.solicitudMedio === 'verbal');

  /** Descripción(es) de las líneas estimadas — texto de observaciones del PDF. */
  protected readonly observaciones = computed(() =>
    itemsEstimadosDe(this.data.pedido)
      .map(i => i.descripcion)
      .filter(Boolean)
      .join(' · '),
  );

  print(): void {
    window.print();
  }

  close(): void {
    this.modalRef.close();
  }
}
