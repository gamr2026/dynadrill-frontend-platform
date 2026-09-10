import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { DynadrillTextComponent } from '@digitec-it-projects/dynadrill-ui';
import { TicketQhseVinculo } from '../../../../shared/models/ticket.model';
import {
  SWA_ESTADO_LABELS,
  actividadesPendientes,
  coberturaOk,
  ipercEstadoLabel,
  ptwFaseLabel,
} from '../ticket-qhse.util';

/**
 * Banner de estado QHSE del ticket operativo — compartido por los detalles
 * de Pumping y FCR. Muestra la cobertura de la Matriz Maestra IPERC
 * (HSE-PLAN-001) y el estado del PTW/Recibimiento de Sitio (HSE-SITIO-001),
 * con enlaces a cada documento cuando el rol puede abrir QHSE.
 */
@Component({
  selector: 'app-ticket-qhse-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DynadrillTextComponent],
  templateUrl: './ticket-qhse-banner.html',
  styleUrl: './ticket-qhse-banner.scss',
})
export class TicketQhseBanner {
  private readonly router = inject(Router);

  readonly vinculo = input<TicketQhseVinculo | null | undefined>(null);
  /** El rol actual puede abrir el módulo QHSE (mostrar enlaces "Ver"). */
  readonly canView = input(false);

  protected readonly coberturaOk = computed(() => coberturaOk(this.vinculo()));
  protected readonly pendientes = computed(() => actividadesPendientes(this.vinculo()));
  protected readonly ptw = computed(() => this.vinculo()?.ptw ?? null);
  protected readonly swa = computed(() => this.vinculo()?.swa ?? null);

  protected readonly ipercEstadoLabel = ipercEstadoLabel;
  protected readonly ptwFaseLabel = ptwFaseLabel;
  protected readonly swaEstadoLabel = (estado: string): string => SWA_ESTADO_LABELS[estado] ?? estado;

  protected verMatriz(ipercMatrixId: number): void {
    if (this.canView()) this.router.navigate(['/dashboard/qhse/iperc', ipercMatrixId]);
  }

  protected verPtw(): void {
    const p = this.ptw();
    if (p && this.canView()) this.router.navigate(['/dashboard/qhse/ptw', p.id]);
  }

  protected verSwa(): void {
    const s = this.swa();
    if (s && this.canView()) this.router.navigate(['/dashboard/qhse/swa', s.id]);
  }
}
