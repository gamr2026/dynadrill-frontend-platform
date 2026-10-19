import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { formatoDia } from '../../../../../facturacion/pedidos-comercial/models/pedido-comercial.model';
import {
  PASOS_FCR,
  TIPO_OT_LABELS,
  TONO_MACRO,
  etiquetaRoles,
  etiquetaTipoServicio,
  mensajeErrorTicket,
  type TicketFcrResumen,
} from '../../models/ticket-fcr';
import { TicketsFcrService } from '../../services/tickets-fcr.service';

/**
 * Bandeja de los pedidos de FCR: cada pedido de la línea que Ventas abre llega aquí como ticket. Por defecto muestra lo que espera a su
 * rol (y, en los pasos que lo exigen, a su equipo); se puede ver todo.
 */
@Component({
  selector: 'app-tickets-fcr-list-page',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillScreenHeaderComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tickets-fcr-list-page.html',
  styleUrl: './tickets-fcr-list-page.scss',
})
export class TicketsFcrListPage {
  private readonly servicio = inject(TicketsFcrService);
  private readonly router = inject(Router);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tickets = signal<TicketFcrResumen[]>([]);
  protected readonly solicitos = signal(true);
  protected readonly paso = signal<string | null>(null);
  protected readonly busqueda = signal('');

  protected readonly opcionesPaso: DynadrillSelectOption[] = PASOS_FCR.map((p) => ({
    label: p.nombre,
    value: p.codigo,
  }));
  protected readonly vacio = computed(
    () => !this.cargando() && !this.error() && this.tickets().length === 0,
  );

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio
      .listar({ mios: this.solicitos(), paso: this.paso() ?? undefined, q: this.busqueda() })
      .subscribe({
        next: (t) => {
          this.tickets.set(t);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(
            mensajeErrorTicket(err, 'No se pudo cargar la bandeja. Intente de nuevo.'),
          );
        },
      });
  }

  protected alternarMios(): void {
    this.solicitos.update((v) => !v);
    this.cargar();
  }

  protected elegirPaso(v: string | null): void {
    this.paso.set(v);
    this.cargar();
  }

  protected abrir(t: TicketFcrResumen): void {
    void this.router.navigate(['/modulos/operativo/fcr/pedidos', t.id]);
  }

  protected readonly dia = formatoDia;
  protected readonly roles = etiquetaRoles;
  protected readonly tipo = etiquetaTipoServicio;
  protected readonly tipoOt = (t: TicketFcrResumen) => TIPO_OT_LABELS[t.tipoOt];
  protected readonly tono = (t: TicketFcrResumen) => TONO_MACRO[t.paso.macro];
}
