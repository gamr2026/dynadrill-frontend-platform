import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { DocumentoPdfService } from '../../../../shared/documentos';
import { ConstanciaTerminosHistorialHoja } from '../../../../shared/documentos/formatos/constancia-terminos-historial-hoja';
import type { AceptacionTerminosHistorial } from '../models/aceptacion-terminos';
import { TerminosHistorialService } from '../services/terminos-historial.service';

/**
 * Historial de aceptaciones de los Términos y condiciones de uso de equipos de Pumping, por operador. Cada operador es una cuenta:
 * su cédula sale de su perfil. Se busca por cédula o nombre. Los datos son de Pumping; aquí solo se consultan e imprimen.
 */
@Component({
  selector: 'app-aceptaciones-terminos-panel',
  imports: [DynadrillInputComponent, DynadrillButtonComponent, DynadrillDataTableComponent, DynadrillIconButtonComponent],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tyc__toolbar" role="search">
      <dynadrill-input label="Cédula" placeholder="10 dígitos" [value]="cedula()" (valueChange)="cedula.set($event)" (keydown.enter)="buscar()" />
      <dynadrill-input label="Nombre del operador" [value]="nombre()" (valueChange)="nombre.set($event)" (keydown.enter)="buscar()" />
      <dynadrill-button (clicked)="buscar()">Buscar</dynadrill-button>
    </div>

    @if (error()) {
      <p class="tyc__error" role="alert">{{ error() }}</p>
    } @else {
      <ng-template #accionesTpl let-row>
        <dynadrill-icon-button icon="file-pdf" tooltip="Constancia" tooltipPlacement="top" (clicked)="constancia(row.id)" />
      </ng-template>
      <div class="tyc__tabla dyn-table-card">
        <dynadrill-data-table [columns]="columnas" [rows]="filas()" [loading]="cargando()" [rowKey]="rowKeyFn" [pageSize]="10" actionsHeader="Acciones" [actionsTemplate]="accionesTpl" />
      </div>
    }
  `,
  styles: `
    .tyc__toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-bottom: 12px; }
    .tyc__toolbar dynadrill-input { flex: 1 1 220px; min-width: 0; }
    .tyc__error { margin: 0; padding: 12px; border-radius: 6px; background: #fff1f0; color: #8a1c14; }
    .tyc__tabla { overflow-x: auto; }
  `,
})
export class AceptacionesTerminosPanel {
  private readonly servicio = inject(TerminosHistorialService);
  private readonly datePipe = inject(DatePipe);
  private readonly pdf = inject(DocumentoPdfService);

  protected readonly cedula = signal('');
  protected readonly nombre = signal('');
  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  private readonly aceptaciones = signal<AceptacionTerminosHistorial[]>([]);

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'operador', header: 'Operador', sortable: true },
    { key: 'cedula', header: 'Cédula' },
    { key: 'ticket', header: 'Ticket' },
    { key: 'version', header: 'Versión' },
    { key: 'fecha', header: 'Fecha y hora', sortable: true },
  ];

  protected readonly filas = computed(() =>
    this.aceptaciones().map(a => ({
      id: a.id,
      operador: a.operador.nombre,
      cedula: a.operador.cedula ?? '—',
      ticket: `${a.ticketNumero ?? '—'} · ${a.pedidoCodigo}`,
      version: a.versionCodigo,
      fecha: this.datePipe.transform(a.aceptadoAt, 'dd/MM/yyyy HH:mm') ?? '',
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.buscar();
  }

  protected buscar(): void {
    this.cargando.set(true);
    this.servicio.historial({ cedula: this.cedula(), nombre: this.nombre() }).subscribe({
      next: lista => {
        this.aceptaciones.set(lista);
        this.error.set('');
        this.cargando.set(false);
      },
      error: (err: { status?: number }) => {
        this.aceptaciones.set([]);
        this.error.set(
          err?.status === 403
            ? 'Su rol no tiene permiso para ver el historial de términos y condiciones.'
            : err?.status === 404
              ? 'Pumping todavía no publica el historial de términos y condiciones. Vuelva a intentarlo más tarde.'
              : 'No se pudo cargar el historial de aceptaciones.',
        );
        this.cargando.set(false);
      },
    });
  }

  /** Constancia imprimible de una aceptación: operador, cédula, ticket, versión, huella del texto y hora del servidor. */
  protected constancia(id: string): void {
    const a = this.aceptaciones().find(x => x.id === id);
    if (!a) return;
    this.pdf.abrir({
      titulo: `Constancia de términos y condiciones — ${a.operador.nombre}`,
      component: ConstanciaTerminosHistorialHoja,
      inputs: { aceptacion: a },
      nombreArchivo: `Constancia de términos ${a.operador.nombre} ticket ${a.ticketNumero ?? a.pedidoCodigo}`,
    });
  }
}
