import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillKpiRowComponent,
  DynadrillScreenHeaderComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { PumpingTicket } from '../../models/pumping.model';
import { PumpingService } from '../../services/pumping.service';

@Component({
  selector: 'app-ticket-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DynadrillScreenHeaderComponent, DynadrillKpiRowComponent, DynadrillDataTableComponent],
  templateUrl: './ticket-list-page.html',
  styleUrl: './ticket-list-page.scss',
})
export class TicketListPage {
  private readonly pumpingService = inject(PumpingService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly tickets = signal<PumpingTicket[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.tickets();
    return [
      { label: 'Total tickets', value: all.length },
      { label: 'En ejecucion', value: all.filter(t => t.status === 'en_ejecucion').length },
      { label: 'En revision', value: all.filter(t => t.status === 'en_revision').length },
      { label: 'Aprobados', value: all.filter(t => t.status === 'aprobado').length },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Codigo', sortable: true, searchable: true },
    { key: 'wellName', header: 'Pozo', sortable: true, searchable: true },
    { key: 'clientName', header: 'Cliente', searchable: true },
    { key: 'serviceType', header: 'Tipo', type: 'badge' },
    { key: 'currentStepLabel', header: 'Paso actual' },
    { key: 'statusBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.tickets().map(t => ({
      id: t.id,
      code: t.code,
      wellName: t.wellName,
      clientName: t.clientName,
      serviceType: { text: t.serviceType.toUpperCase(), tone: 'brand' as const },
      currentStepLabel: this.stepLabel(t.currentStep),
      statusBadge: this.statusBadge(t.status),
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.pumpingService.listTickets().subscribe({
      next: tickets => {
        this.tickets.set(tickets);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate(['/operaciones/pumping', row['id']]);
  }

  private stepLabel(step: string): string {
    const map: Record<string, string> = {
      revision_propuesta: 'Revision propuesta',
      asignar_supervisor: 'Asignar supervisor',
      asignar_operador_unidad: 'Asignar operador/unidad',
      preparacion_documental: 'Preparacion documental',
      ejecucion: 'Ejecucion',
      cierre_documental: 'Cierre documental',
      validacion_final: 'Validacion final',
    };
    return map[step] ?? step;
  }

  private statusBadge(status: string): { text: string; tone: 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info' } {
    const map: Record<string, { text: string; tone: 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info' }> = {
      borrador: { text: 'Borrador', tone: 'neutral' },
      en_revision: { text: 'En revision', tone: 'warning' },
      aprobado: { text: 'Aprobado', tone: 'success' },
      en_ejecucion: { text: 'En ejecucion', tone: 'info' },
      cerrado: { text: 'Cerrado', tone: 'neutral' },
      rechazado: { text: 'Rechazado', tone: 'error' },
    };
    return map[status] ?? { text: status, tone: 'neutral' };
  }
}
