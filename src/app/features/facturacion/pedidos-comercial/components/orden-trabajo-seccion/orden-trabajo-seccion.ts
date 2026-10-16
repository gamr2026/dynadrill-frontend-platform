import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { AotHoja } from '../../../../../shared/documentos/formatos/aot-hoja';
import { OrdenesTrabajoComercialService } from '../../services/ordenes-trabajo-comercial.service';
import { OrdenTrabajoDialog, type OrdenTrabajoDialogData, type TipoAccionOrden } from '../orden-trabajo-dialog/orden-trabajo-dialog';
import { formatoDia, formatoMoneda, type PedidoDetalle } from '../../models/pedido-comercial.model';
import {
  PERMISOS_ORDENES,
  ROTULO_PASO,
  aHojaAot,
  mensajeErrorOrden,
  siguientePasoCierre,
  type EstadoCierre,
  type OrdenDelPedido,
  type PasoCierre,
} from '../../models/orden-trabajo';

/**
 * Orden de trabajo (OT) y cierre del pedido: generar la OT de la prefactura firmada (si el contrato la exige), verla e
 * imprimirla con el formato "Orden de trabajo — Resumen de costos", marcarla como firmada (firma física), y llevar el
 * pedido por control de costos, listo para facturar y facturado.
 */
@Component({
  selector: 'app-orden-trabajo-seccion',
  imports: [DynadrillBannerComponent, DynadrillButtonComponent, DynadrillSpinnerComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orden-trabajo-seccion.html',
  styleUrl: './orden-trabajo-seccion.scss',
})
export class OrdenTrabajoSeccion {
  private readonly servicio = inject(OrdenesTrabajoComercialService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly documentoPdf = inject(DocumentoPdfService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  readonly pedido = input.required<PedidoDetalle>();
  /** Tras cada acción el estado del pedido cambió: la página lo recarga. */
  readonly cambioDePedido = output<void>();

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly datos = signal<OrdenDelPedido | null>(null);
  protected readonly cierre = signal<EstadoCierre | null>(null);

  protected readonly orden = computed(() => this.datos()?.orden ?? null);
  protected readonly paso = computed<PasoCierre>(() => siguientePasoCierre(this.pedido().estado, this.datos()?.requiere ?? false));
  protected readonly rotulo = computed(() => (this.paso() ? ROTULO_PASO[this.paso() as Exclude<PasoCierre, null>] : ''));
  protected readonly puedeCerrar = computed(() => this.auth.can(PERMISOS_ORDENES.cierre));
  protected readonly puedeEmitir = computed(() => this.auth.can(PERMISOS_ORDENES.emitir));
  protected readonly puedeFirmar = computed(() => this.auth.can(PERMISOS_ORDENES.firmar));
  /** ¿Puede hacer el paso que toca? (cada paso pide su permiso) */
  protected readonly puedeElPaso = computed(() => (this.paso() === 'generar_orden' ? this.puedeEmitir() : this.puedeCerrar()));

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.delPedido(this.pedido().id).subscribe({
      next: d => {
        this.datos.set(d);
        this.servicio.cierre(this.pedido().id).subscribe({
          next: c => {
            this.cierre.set(c);
            this.cargando.set(false);
          },
          error: () => this.cargando.set(false),
        });
      },
      error: err => {
        this.cargando.set(false);
        this.error.set(mensajeErrorOrden(err, 'No se pudo cargar la orden de trabajo. Intente de nuevo.'));
      },
    });
  }

  protected hacerPaso(): void {
    const paso = this.paso();
    if (!paso || this.ocupado()) return;
    this.errorAccion.set(null);
    const id = this.pedido().id;
    switch (paso) {
      case 'generar_orden':
        return this.abrir('emitir', 'Generar orden de trabajo');
      case 'facturar':
        return this.abrir('factura', 'Registrar factura');
      case 'control_costos':
        return this.llamar(this.servicio.enviarControlCostos(id), 'Enviado a control de costos');
      case 'listo_para_facturar':
        return this.llamar(this.servicio.listoParaFacturar(id), 'Listo para facturar');
    }
  }

  protected marcarFirmada(): void {
    const o = this.orden();
    if (o) this.abrir('firmada', 'Marcar la orden de trabajo como firmada', o.id);
  }

  private abrir(tipo: TipoAccionOrden, titulo: string, ordenId?: string): void {
    const ref = this.dialog.open<OrdenTrabajoDialog, OrdenTrabajoDialogData>({
      title: titulo,
      content: OrdenTrabajoDialog,
      data: { tipo, pedidoId: this.pedido().id, ordenId },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe((r: unknown) => {
      if (r) this.recargar();
    });
  }

  private llamar(obs: ReturnType<OrdenesTrabajoComercialService['enviarControlCostos']>, titulo: string): void {
    this.ocupado.set(true);
    obs.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success(titulo);
        this.recargar();
      },
      error: err => {
        this.ocupado.set(false);
        this.errorAccion.set(mensajeErrorOrden(err, 'No se pudo completar la acción. Intente de nuevo.'));
      },
    });
  }

  /** Vista de impresión ("Orden de trabajo — Resumen de costos"): imprimir o «Guardar como PDF». */
  protected imprimir(descargar = false): void {
    const o = this.orden();
    if (!o) return;
    this.documentoPdf.abrir({
      titulo: `Orden de trabajo ${o.codigo} — Vista de impresión`,
      component: AotHoja,
      inputs: { aot: aHojaAot(o) },
      nombreArchivo: `Orden de trabajo ${o.codigo}`,
      descargar,
    });
  }

  private recargar(): void {
    this.cargar();
    this.cambioDePedido.emit();
  }

  protected readonly dia = formatoDia;
  protected readonly moneda = formatoMoneda;
}
