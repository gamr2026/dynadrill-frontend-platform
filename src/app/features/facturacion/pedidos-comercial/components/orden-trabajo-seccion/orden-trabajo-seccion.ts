import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { AotHoja } from '../../../../../shared/documentos/formatos/aot-hoja';
import { OrdenesTrabajoComercialService } from '../../services/ordenes-trabajo-comercial.service';
import {
  OrdenTrabajoDialog,
  type OrdenTrabajoDialogData,
  type TipoAccionOrden,
} from '../orden-trabajo-dialog/orden-trabajo-dialog';
import { formatoDia, formatoMoneda, type PedidoDetalle } from '../../models/pedido-comercial.model';
import {
  PERMISOS_ORDENES,
  ROTULO_PASO,
  aHojaAot,
  mensajeErrorOrden,
  siguientePasoCierre,
  type OrdenDelPedido,
  type PasoCierre,
} from '../../models/orden-trabajo';

/**
 * Orden de trabajo (OT) del pedido: generar la OT de la prefactura firmada (si el contrato la exige), verla e imprimirla con el
 * formato "Orden de trabajo — Resumen de costos" y marcarla como firmada (firma física).
 */
@Component({
  selector: 'app-orden-trabajo-seccion',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
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
  private readonly router = inject(Router);

  readonly pedido = input.required<PedidoDetalle>();
  /** Tras cada acción el estado del pedido cambió: la página lo recarga. */
  readonly cambioDePedido = output<void>();

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly datos = signal<OrdenDelPedido | null>(null);

  protected readonly orden = computed(() => this.datos()?.orden ?? null);
  /** Solo se ofrece generar la OT: el cierre (control de costos y factura) queda fuera del alcance del aplicativo. */
  protected readonly paso = computed<PasoCierre>(() =>
    siguientePasoCierre(this.pedido().estado, this.datos()?.requiere ?? false) === 'generar_orden'
      ? 'generar_orden'
      : null,
  );
  protected readonly rotulo = computed(() =>
    this.paso() ? ROTULO_PASO[this.paso() as Exclude<PasoCierre, null>] : '',
  );
  protected readonly puedeEmitir = computed(() => this.auth.can(PERMISOS_ORDENES.emitir));
  protected readonly puedeFirmar = computed(() => this.auth.can(PERMISOS_ORDENES.firmar));
  protected readonly puedeElPaso = computed(() => this.puedeEmitir());

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.delPedido(this.pedido().id).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(
          mensajeErrorOrden(err, 'No se pudo cargar la orden de trabajo. Intente de nuevo.'),
        );
      },
    });
  }

  protected hacerPaso(): void {
    const paso = this.paso();
    if (!paso || this.ocupado()) return;
    this.errorAccion.set(null);
    this.abrir('emitir', 'Generar orden de trabajo');
  }

  /** Abre la pantalla de la orden de trabajo (documento, datos y detalle de costos). */
  protected verDetalle(): void {
    void this.router.navigate([
      '/dashboard/facturacion/pedidos',
      this.pedido().id,
      'orden-trabajo',
    ]);
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
