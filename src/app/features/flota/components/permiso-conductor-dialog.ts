import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import type { ConductorEstado, TipoPermiso } from '../models/inspeccion-flota.model';
import { FlotaInspeccionesService } from '../services/flota-inspecciones.service';
import { aFechaIso, mensajeDeError } from '../utils/flota.util';

export interface PermisoConductorDialogData {
  conductor: ConductorEstado;
  /** Documento a renovar (preseleccionado). */
  tipoId?: string;
}

/** Registra un documento (o su renovación) de un conductor: el anterior queda en la historia y rige el último registrado. */
@Component({
  selector: 'app-permiso-conductor-dialog',
  imports: [
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="permiso-dialog">
      <p class="permiso-dialog__nota">
        Conductor: <strong>{{ data.conductor.usuario.nombre }}</strong>
      </p>
      <dynadrill-select
        label="Documento"
        placeholder="Seleccione el documento"
        [options]="opciones()"
        [value]="tipoId()"
        (valueChange)="tipoId.set($any($event))"
      />
      @if (tipo()?.conVigencia) {
        <dynadrill-datetime-picker
          label="Válido hasta"
          mode="date"
          [value]="$any(hasta())"
          (valueChange)="hasta.set($any($event))"
        />
      }
      <dynadrill-textarea
        label="Observaciones"
        [value]="observaciones()"
        (valueChange)="observaciones.set($event)"
        [rows]="2"
      />
      <div class="permiso-dialog__actions">
        <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
        <dynadrill-button [disabled]="!puedeGuardar()" (clicked)="guardar()">{{
          enviando() ? 'Guardando…' : 'Registrar documento'
        }}</dynadrill-button>
      </div>
    </div>
  `,
  styles: `
    .permiso-dialog {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .permiso-dialog__nota {
      margin: 0;
      color: var(--text-muted, #5c5870);
    }
    .permiso-dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid var(--border, #e5e4ea);
      padding-top: 16px;
    }
  `,
})
export class PermisoConductorDialog {
  private readonly api = inject(FlotaInspeccionesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<PermisoConductorDialog, boolean>);
  protected readonly data = inject<PermisoConductorDialogData>(NZ_MODAL_DATA);

  protected readonly tipos = signal<TipoPermiso[]>([]);
  protected readonly tipoId = signal<string | null>(this.data.tipoId ?? null);
  protected readonly hasta = signal<Date | null>(null);
  protected readonly observaciones = signal('');
  protected readonly enviando = signal(false);

  protected readonly opciones = computed<DynadrillSelectOption[]>(() =>
    this.tipos().map((t) => ({ label: t.nombre, value: t.id })),
  );
  protected readonly tipo = computed(
    () => this.tipos().find((t) => t.id === this.tipoId()) ?? null,
  );
  protected readonly puedeGuardar = computed(
    () => !!this.tipo() && (!this.tipo()!.conVigencia || !!this.hasta()) && !this.enviando(),
  );

  constructor() {
    this.api.tiposPermiso().subscribe((t) => this.tipos.set(t));
  }

  protected guardar(): void {
    if (!this.puedeGuardar()) return;
    this.enviando.set(true);
    this.api
      .registrarPermiso(this.data.conductor.usuario.id, {
        tipoId: this.tipoId()!,
        vigenteHasta: this.tipo()!.conVigencia ? aFechaIso(this.hasta()) : null,
        observaciones: this.observaciones().trim() || null,
      })
      .subscribe({
        next: () => {
          this.notify.success(
            'Documento registrado',
            `${this.tipo()!.nombre} — ${this.data.conductor.usuario.nombre}`,
          );
          this.modalRef.close(true);
        },
        error: (e: HttpErrorResponse) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo registrar',
            mensajeDeError(e, 'No se pudo registrar el documento.'),
          );
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(false);
  }
}
