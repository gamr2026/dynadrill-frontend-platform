import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  accionesDisponibles,
  etiquetaEstadoPrefactura,
  mensajeErrorPrefactura,
  prefacturaActual,
  type Prefactura,
} from '../../models/prefactura-comercial';
import { formatoMoneda, type PedidoDetalle } from '../../models/pedido-comercial.model';
import { PrefacturasComercialService } from '../../services/prefacturas-comercial.service';

/**
 * Tarjeta «Prefactura» de la columna lateral del pedido, como la de la demo: un resumen (ticket, estado, subtotales y neto) con el botón
 * para verla completa, o —si todavía no hay— el mensaje de qué falta y el botón para generarla (quien tiene el permiso).
 */
@Component({
  selector: 'app-prefactura-resumen',
  imports: [DynadrillBannerComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefactura-resumen.html',
  styleUrl: './prefactura-resumen.scss',
})
export class PrefacturaResumen {
  private readonly servicio = inject(PrefacturasComercialService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly pedido = input.required<PedidoDetalle>();
  /** Generar una prefactura cambia el estado del pedido: la página lo recarga. */
  readonly cambioDePedido = output<void>();

  protected readonly cargando = signal(true);
  protected readonly generando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly actual = signal<Prefactura | null>(null);
  protected readonly puedeGenerar = computed(() =>
    accionesDisponibles(this.actual(), (p) => this.auth.can(p)).includes('generar'),
  );

  protected readonly moneda = formatoMoneda;
  protected readonly estado = etiquetaEstadoPrefactura;

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.delPedido(this.pedido().id).subscribe({
      next: (vs) => {
        this.actual.set(prefacturaActual(vs));
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorPrefactura(err, 'No se pudo cargar la prefactura.'));
      },
    });
  }

  protected ver(): void {
    const a = this.actual();
    if (a) void this.router.navigate(['/dashboard/facturacion/prefacturas', a.id]);
  }

  protected generar(): void {
    if (this.generando()) return;
    this.generando.set(true);
    this.error.set(null);
    this.servicio.generar(this.pedido().id).subscribe({
      next: () => {
        this.generando.set(false);
        this.notify.success('Prefactura generada');
        this.cargar();
        this.cambioDePedido.emit();
      },
      error: (err) => {
        this.generando.set(false);
        this.error.set(mensajeErrorPrefactura(err, 'No se pudo generar la prefactura.'));
      },
    });
  }
}
