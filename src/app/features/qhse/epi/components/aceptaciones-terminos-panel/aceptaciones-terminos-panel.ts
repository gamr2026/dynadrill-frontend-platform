import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillInputComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { AceptacionTerminos } from '../../../../operations/pumping/models/terminos.model';
import { TerminosPumpingService } from '../../../../operations/pumping/services/terminos-pumping.service';

/**
 * Historial de aceptaciones de los Términos y condiciones de uso de equipos
 * de Pumping, por operador. Los operadores no son usuarios del sistema (el
 * nombre viene del ticket), así que se busca por cédula o nombre.
 */
@Component({
  selector: 'app-aceptaciones-terminos-panel',
  imports: [DynadrillInputComponent, DynadrillButtonComponent, DynadrillDataTableComponent],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aceptaciones-terminos-panel.html',
  styleUrl: './aceptaciones-terminos-panel.scss',
})
export class AceptacionesTerminosPanel {
  private readonly service = inject(TerminosPumpingService);
  private readonly datePipe = inject(DatePipe);

  protected readonly cedula = signal('');
  protected readonly nombre = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  private readonly aceptaciones = signal<AceptacionTerminos[]>([]);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'operadorNombre', header: 'Operador', sortable: true },
    { key: 'operadorCedula', header: 'Cédula' },
    { key: 'ticket', header: 'Ticket' },
    { key: 'version', header: 'Versión' },
    { key: 'fecha', header: 'Fecha y hora', sortable: true },
    { key: 'registradoPor', header: 'Registrado por' },
  ];

  protected readonly rows = computed(() =>
    this.aceptaciones().map(a => ({
      id: a.id,
      operadorNombre: a.operadorNombre,
      operadorCedula: a.operadorCedula,
      ticket: `#${a.pumpingTicketId}`,
      version: a.version,
      fecha: this.datePipe.transform(a.aceptadoAt, 'dd/MM/yyyy HH:mm') ?? '',
      registradoPor: a.registradoPor,
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.buscar();
  }

  protected buscar(): void {
    this.loading.set(true);
    this.service.historial({ cedula: this.cedula(), nombre: this.nombre() }).subscribe({
      next: list => {
        this.aceptaciones.set(list);
        this.error.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
