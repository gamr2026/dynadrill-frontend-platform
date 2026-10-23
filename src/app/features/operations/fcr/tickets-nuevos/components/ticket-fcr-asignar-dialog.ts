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
import {
  mensajeErrorTicket,
  validarAsignacion,
  type FilaOperador,
  type OperadorDisponible,
  type TicketFcr,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

export interface TicketFcrAsignarDialogData {
  ticketId: string;
  /** El ticket ya tiene supervisor (quien lo tomó): no se vuelve a elegir. */
  haySupervisor: boolean;
}

interface Persona {
  id: string;
  name: string;
}

/**
 * El Supervisor asigna a los operadores del servicio. A cada cuenta elegida se le
 * avisa por correo y campanita (solo a ellas, no a todo su rol).
 */
@Component({
  selector: 'app-ticket-fcr-asignar-dialog',
  imports: [DynadrillButtonComponent, DynadrillSelectComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="d">
      <dynadrill-text variant="body"
        >Elija a los operadores del servicio. A quienes elija se les avisará por correo y en la
        campanita.</dynadrill-text
      >
      @if (!data.haySupervisor) {
        <dynadrill-select
          label="Supervisor"
          placeholder="Elija el supervisor"
          [options]="opcionesSupervisor()"
          [value]="supervisorId()"
          [searchable]="true"
          (valueChange)="supervisorId.set($any($event))"
        />
      }
      <fieldset class="d__bloque">
        <legend>Operadores</legend>
        @if (rango(); as r) {
          <dynadrill-text variant="caption"
            >Disponibilidad para el servicio del {{ r.desde }} al {{ r.hasta }}.</dynadrill-text
          >
        }
        @for (f of filas(); track $index; let i = $index) {
          <div class="d__fila">
            <dynadrill-select
              label="Operador"
              placeholder="Elija un operador"
              [options]="opcionesOperadores(i)"
              [value]="f.usuarioId"
              [searchable]="true"
              (valueChange)="cambiar(i, 'usuarioId', $any($event))"
            />
            <button
              type="button"
              class="d__quitar"
              [attr.aria-label]="'Quitar la fila ' + (i + 1)"
              (click)="quitar(i)"
            >
              Quitar
            </button>
          </div>
        }
        <div>
          <dynadrill-button variant="secondary" size="small" (clicked)="agregar()"
            >Agregar operador</dynadrill-button
          >
        </div>
      </fieldset>
      @if (ocupadosElegidos().length) {
        <dynadrill-text variant="caption" role="alert"
          >✗ Ya están asignados a otro ticket durante este servicio: {{ textoOcupados() }}. Elija a
          otra persona.</dynadrill-text
        >
      }
      @if (problema(); as p) {
        <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
      }
    </div>
    <footer class="d__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button
        [disabled]="!!problema() || enviando() || ocupadosElegidos().length > 0"
        (clicked)="asignar()"
        >{{ enviando() ? 'Asignando…' : 'Asignar y avisar' }}</dynadrill-button
      >
    </footer>
  `,
  styles: `
    .d {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .d__bloque {
      border: 1px solid #ecebf1;
      border-radius: 8px;
      padding: 8px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .d__bloque legend {
      padding: 0 6px;
      font-weight: 600;
    }
    .d__fila {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      align-items: end;
    }
    .d__quitar {
      background: none;
      border: 0;
      color: #5c5870;
      text-decoration: underline;
      cursor: pointer;
      padding: 0 4px 10px;
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
export class TicketFcrAsignarDialog {
  private readonly servicio = inject(TicketsFcrService);
  private readonly roles = inject(RolesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketFcrAsignarDialog, TicketFcr | undefined>);
  protected readonly data = inject<TicketFcrAsignarDialogData>(NZ_MODAL_DATA);

  private readonly supervisores = signal<Persona[]>([]);
  private readonly operadores = signal<OperadorDisponible[]>([]);
  protected readonly rango = signal<{ desde: string; hasta: string } | null>(null);
  protected readonly supervisorId = signal<string | null>(null);
  protected readonly filas = signal<FilaOperador[]>([{ usuarioId: null }]);
  protected readonly enviando = signal(false);

  protected readonly opcionesSupervisor = computed<DynadrillSelectOption[]>(() =>
    this.supervisores()
      .filter((s) => !this.filas().some((f) => f.usuarioId === s.id))
      .map((s) => ({ label: s.name, value: s.id })),
  );
  protected readonly ocupadosElegidos = computed(() => {
    const elegidos = new Set(this.filas().map((f) => f.usuarioId));
    return this.operadores().filter((o) => !o.disponible && elegidos.has(o.usuarioId));
  });
  protected readonly textoOcupados = computed(() =>
    this.ocupadosElegidos()
      .map((o) => `${o.nombre} (${o.detalle})`)
      .join('; '),
  );
  protected readonly problema = computed(() =>
    validarAsignacion(this.supervisorId(), this.filas(), this.data.haySupervisor),
  );

  constructor() {
    forkJoin({
      sup: this.roles.usuariosPorRol('supervisor'),
      ops: this.servicio.operadoresDisponibles(this.data.ticketId),
    }).subscribe({
      next: (r) => {
        const unicos = (l: Persona[]) =>
          [...new Map(l.map((p) => [p.id, p])).values()].sort((a, b) =>
            a.name.localeCompare(b.name, 'es'),
          );
        this.supervisores.set(unicos(r.sup));
        this.operadores.set(r.ops.operadores);
        this.rango.set({ desde: r.ops.desde, hasta: r.ops.hasta });
      },
      error: (err) =>
        this.notify.error('Error', mensajeErrorTicket(err, 'No se pudo cargar las personas.')),
    });
  }

  /** Operadores que todavía se pueden elegir en la fila `i`. */
  protected opcionesOperadores(i: number): DynadrillSelectOption[] {
    const usados = new Set(
      this.filas()
        .filter((_, k) => k !== i)
        .map((f) => f.usuarioId),
    );
    return this.operadores()
      .filter((o) => !usados.has(o.usuarioId) && o.usuarioId !== this.supervisorId())
      .map((o) => ({
        label: `${o.disponible ? '✓' : '✗'} ${o.nombre}${o.disponible ? '' : ' — ' + o.detalle}`,
        value: o.usuarioId,
      }));
  }

  protected cambiar(i: number, campo: keyof FilaOperador, valor: string | null): void {
    this.filas.update((l) => l.map((f, k) => (k === i ? { ...f, [campo]: valor } : f)));
  }
  protected agregar(): void {
    this.filas.update((l) => [...l, { usuarioId: null }]);
  }
  protected quitar(i: number): void {
    this.filas.update((l) => (l.length > 1 ? l.filter((_, k) => k !== i) : [{ usuarioId: null }]));
  }

  protected asignar(): void {
    if (this.problema() || this.enviando()) return;
    const sup = this.supervisorId();
    const cuerpo = {
      ...(!this.data.haySupervisor && sup ? { supervisorId: sup } : {}),
      operadores: this.filas().map((f) => ({ usuarioId: f.usuarioId! })),
    };
    this.enviando.set(true);
    this.servicio.asignar(this.data.ticketId, cuerpo).subscribe({
      next: (t) => {
        this.notify.success(
          'Equipo asignado',
          'Se avisó por correo y en la campanita a las personas elegidas.',
        );
        this.modalRef.close(t);
      },
      error: (err) => {
        this.enviando.set(false);
        this.notify.error(
          'No se pudo asignar',
          mensajeErrorTicket(err, 'No se pudo asignar el equipo. Intente de nuevo.'),
        );
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
