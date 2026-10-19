import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { RolesService } from '../../../../users/services/users.service';
import { mensajeErrorTicket, type TicketFcr } from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

export interface TicketFcrTipoOperadorDialogData {
  ticketId: string;
  actual?: { tipoOperadorId: string | null; inspectorId: string | null };
}

interface Persona {
  id: string;
  name: string;
}

/** Entrada SERVICIOS: el Supervisor elige el tipo de operador (mecánico o soldador) y el operador FCR que repara e inspecciona. */
@Component({
  selector: 'app-ticket-fcr-tipo-operador-dialog',
  imports: [DynadrillButtonComponent, DynadrillSelectComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="d">
      <dynadrill-text variant="body">
        El operador que elija repara e inspecciona las herramientas del servicio y queda como parte
        del equipo del ticket.
      </dynadrill-text>
      <dynadrill-select
        label="Tipo de operador"
        placeholder="Mecánico o soldador"
        [options]="opcionesTipo()"
        [value]="tipoId()"
        (valueChange)="tipoId.set($any($event))"
      />
      <dynadrill-select
        label="Operador que inspecciona"
        placeholder="Elija un operador FCR"
        [options]="opcionesOperador()"
        [value]="inspectorId()"
        [searchable]="true"
        (valueChange)="inspectorId.set($any($event))"
      />
    </div>
    <footer class="d__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button
        [disabled]="!tipoId() || !inspectorId() || enviando()"
        (clicked)="guardar()"
        >{{ enviando() ? 'Guardando…' : 'Guardar' }}</dynadrill-button
      >
    </footer>
  `,
  styles: `
    .d {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .d__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class TicketFcrTipoOperadorDialog {
  private readonly servicio = inject(TicketsFcrService);
  private readonly roles = inject(RolesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<TicketFcrTipoOperadorDialog, TicketFcr | undefined>,
  );
  private readonly data = inject<TicketFcrTipoOperadorDialogData>(NZ_MODAL_DATA);

  private readonly tipos = signal<DynadrillSelectOption[]>([]);
  private readonly operadores = signal<Persona[]>([]);
  protected readonly tipoId = signal<string | null>(this.data.actual?.tipoOperadorId ?? null);
  protected readonly inspectorId = signal<string | null>(this.data.actual?.inspectorId ?? null);
  protected readonly enviando = signal(false);
  protected readonly opcionesTipo = computed(() => this.tipos());
  protected readonly opcionesOperador = computed<DynadrillSelectOption[]>(() =>
    this.operadores().map((o) => ({ label: o.name, value: o.id })),
  );

  constructor() {
    forkJoin({
      cat: this.servicio.catalogos(),
      ops: this.roles.usuariosPorRol('operador_fcr'),
    }).subscribe({
      next: (r) => {
        this.tipos.set(r.cat.tiposOperador.map((t) => ({ label: t.nombre, value: t.id })));
        this.operadores.set([...r.ops].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      },
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeErrorTicket(err, 'No se pudo cargar los tipos y los operadores.'),
        ),
    });
  }

  protected guardar(): void {
    const tipo = this.tipoId();
    const inspector = this.inspectorId();
    if (!tipo || !inspector || this.enviando()) return;
    this.enviando.set(true);
    this.servicio.definirTipoOperador(this.data.ticketId, tipo, inspector).subscribe({
      next: (t) => {
        this.notify.success(
          'Tipo de operador definido',
          'Ya puede pasar el ticket a la inspección.',
        );
        this.modalRef.close(t);
      },
      error: (err) => {
        this.enviando.set(false);
        this.notify.error(
          'No se pudo guardar',
          mensajeErrorTicket(err, 'No se pudo definir el tipo de operador.'),
        );
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
