import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Aot } from '../../../features/facturacion/models/aot.model';
import { fechaDoc } from '../documento-format.util';

/**
 * Formato "Orden de trabajo — Resumen de costos" (AOT, pestaña OTQ del cliente): contratista, número de OPR, texto
 * del contrato, servicio, detalle de tarifas y cantidades, valor de la OT, fechas y las firmas de los delegados de
 * la contratista y del cliente (nombre y cargo impresos; la firma se pone sobre el PDF).
 */
@Component({
  selector: 'app-doc-aot',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aot-hoja.html',
  styleUrl: './aot-hoja.scss',
})
export class AotHoja {
  readonly aot = input.required<Aot>();

  protected readonly fecha = fechaDoc;
}
