import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { RolesService } from '../../../users/services/users.service';
import { forkJoin } from 'rxjs';
import { mensajeErrorEpi, type EntregaEpi } from '../models/entrega-epi';
import { EntregaEpiService } from '../services/entrega-epi.service';

/** Roles de cuenta que reciben EPI: quienes trabajan en campo. Una entrega a otro rol se registra desde la API. */
const ROLES_CON_EPI = ['operador', 'operador_fcr', 'supervisor', 'supervisor_pumping', 'operador_mantenimiento', 'conductor'];

interface Persona {
  id: string;
  name: string;
}

/**
 * Registro a mano de una entrega de EPI (fuera de un servicio: p. ej. dotación de oficina). Las que nacen de un servicio las abre
 * QHSE sola cuando Pumping asigna a los operadores. Aquí solo se elige a la persona y el lugar; los elementos se agregan al abrir la
 * entrega.
 */
@Component({
  selector: 'app-entrega-epi-nueva-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="een">
      <dynadrill-text variant="body">Elija a quién se le entregará el EPI. Los elementos se registran en la entrega.</dynadrill-text>
      <dynadrill-select label="Trabajador" placeholder="Elija una persona" [options]="opciones()" [value]="trabajadorId()" [searchable]="true" (valueChange)="trabajadorId.set($any($event))" />
      <dynadrill-input label="Lugar de la entrega (opcional)" [value]="lugar()" (valueChange)="lugar.set($event)" />
    </div>
    <footer class="een__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!trabajadorId() || enviando()" (clicked)="crear()">{{ enviando() ? 'Registrando…' : 'Registrar entrega' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .een { display: flex; flex-direction: column; gap: 14px; }
    .een__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class EntregaEpiNuevaDialog {
  private readonly servicio = inject(EntregaEpiService);
  private readonly roles = inject(RolesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<EntregaEpiNuevaDialog, EntregaEpi | undefined>);

  protected readonly personas = signal<Persona[]>([]);
  protected readonly trabajadorId = signal('');
  protected readonly lugar = signal('');
  protected readonly enviando = signal(false);
  protected readonly opciones = computed<DynadrillSelectOption[]>(() => this.personas().map(p => ({ value: p.id, label: p.name })));

  constructor() {
    forkJoin(ROLES_CON_EPI.map(r => this.roles.usuariosPorRol(r))).subscribe({
      next: listas => {
        const unicas = new Map<string, Persona>();
        for (const u of listas.flat()) unicas.set(u.id, { id: u.id, name: u.name });
        this.personas.set([...unicas.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      },
      error: () => this.notify.error('Error', 'No se pudo cargar la lista de personas.'),
    });
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected crear(): void {
    if (!this.trabajadorId() || this.enviando()) return;
    this.enviando.set(true);
    this.servicio.crear({ trabajadorId: this.trabajadorId(), ...(this.lugar().trim() ? { lugar: this.lugar().trim() } : {}) }).subscribe({
      next: e => this.modalRef.close(e),
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo', mensajeErrorEpi(err, 'No se pudo registrar la entrega.'));
      },
    });
  }
}
