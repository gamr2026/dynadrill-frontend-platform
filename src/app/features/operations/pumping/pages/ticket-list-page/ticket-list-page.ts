import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ScreenHeaderComponent } from '../../../../shared/components/screen-header/screen-header';
import { KpiRowComponent, KpiItem } from '../../../../shared/components/kpi-row/kpi-row';
import { PumpingService } from '../../pumping/services/pumping.service';
import { PumpingTicket } from '../../pumping/models/pumping.model';

@Component({
  selector: 'app-ticket-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScreenHeaderComponent, KpiRowComponent],
  templateUrl: './ticket-list-page.html',
  styleUrl: './ticket-list-page.scss',
})
export class TicketListPage {
  private readonly pumpingService = inject(PumpingService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly rows = signal<PumpingTicket[]>([]);

  readonly kpis = computed<KpiItem[]>(() => {
    const tickets = this.rows();
    return [
      { label: 'Total', value: tickets.length },
      { label: 'En ejecución', value: tickets.filter(t => t.status === 'en_ejecucion').length },
      { label: 'Pendientes', value: tickets.filter(t => t.status === 'en_revision').length },
    ];
  });

  readonly columns = [
    { key: 'code', label: 'Código' },
    { key: 'wellName', label: 'Pozo' },
    { key: 'clientName', label: 'Cliente' },
    { key: 'serviceType', label: 'Tipo' },
    { key: 'currentStep', label: 'Paso actual' },
    { key: 'status', label: 'Estado' },
  ];

  readonly rowKeyFn = (row: PumpingTicket) => row.id;

  constructor() {
    this.pumpingService.listTickets().subscribe({
      next: (tickets) => {
        this.rows.set(tickets);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  viewDetail(ticket: PumpingTicket): void {
    this.router.navigate(['/operations/pumping', ticket.id]);
  }
}
