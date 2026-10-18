import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../../../core/services/auth.service';
import { PERMISO_CAMBIOS_APROBAR } from '../../models/cambio-items';
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
  PASOS_PUMPING,
  TONO_MACRO,
  etiquetaRoles,
  etiquetaTipoServicio,
  mensajeErrorTicket,
  type TicketPumpingResumen,
} from '../../models/ticket-pumping';
import { TicketsPumpingService } from '../../services/tickets-pumping.service';

/**
 * Bandeja de los pedidos de Pumping: cada pedido que Ventas abre en la línea llega aquí como ticket. Por defecto muestra
 * lo que espera a su rol (el Jefe de Base ve lo que está en "Revisión inicial"); se puede ver todo.
 */
@Component({
  selector: 'app-tickets-pumping-list-page',
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
  templateUrl: './tickets-pumping-list-page.html',
  styleUrl: './tickets-pumping-list-page.scss',
})
export class TicketsPumpingListPage {
  private readonly servicio = inject(TicketsPumpingService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  /** El Supervisor ve el acceso a su bandeja de Aprobaciones (cambios de ítems del pedido). */
  protected readonly puedeAprobar = computed(() => this.auth.can(PERMISO_CAMBIOS_APROBAR));

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tickets = signal<TicketPumpingResumen[]>([]);
  protected readonly solicitos = signal(true);
  protected readonly paso = signal<string | null>(null);
  protected readonly busqueda = signal('');

  protected readonly opcionesPaso: DynadrillSelectOption[] = PASOS_PUMPING.map(p => ({ label: p.nombre, value: p.codigo }));
  protected readonly vacio = computed(() => !this.cargando() && !this.error() && this.tickets().length === 0);

  constructor() {
    queueMicrotask(() => this.cargar());
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.listar({ mios: this.solicitos(), paso: this.paso() ?? undefined, q: this.busqueda() }).subscribe({
      next: t => {
        this.tickets.set(t);
        this.cargando.set(false);
      },
      error: err => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar la bandeja. Intente de nuevo.'));
      },
    });
  }

  protected alternarMios(): void {
    this.solicitos.update(v => !v);
    this.cargar();
  }

  protected elegirPaso(v: string | null): void {
    this.paso.set(v);
    this.cargar();
  }

  protected abrir(t: TicketPumpingResumen): void {
    void this.router.navigate(['/modulos/operativo/pumping/pedidos', t.id]);
  }

  protected readonly dia = formatoDia;
  protected readonly roles = etiquetaRoles;
  protected readonly tipo = etiquetaTipoServicio;
  protected readonly tono = (t: TicketPumpingResumen) => TONO_MACRO[t.paso.macro];

  protected irAAprobaciones(): void {
    void this.router.navigate(['/modulos/operativo/pumping/pedidos/aprobaciones']);
  }
}
