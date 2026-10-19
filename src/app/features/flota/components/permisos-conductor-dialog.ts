import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import type { ConductorEstado, PermisoHistoria } from '../models/inspeccion-flota.model';
import { FlotaInspeccionesService } from '../services/flota-inspecciones.service';
import { formatoFecha, mensajeDeError } from '../utils/flota.util';

export interface PermisosConductorDialogData {
  conductor: ConductorEstado;
}

/**
 * Historia de los documentos de un conductor (los anulados incluidos). Un documento mal cargado se anula con motivo y se registra el
 * correcto: la historia no se edita ni se borra. Anular exige `flota.conductores.gestionar`.
 */
@Component({
  selector: 'app-permisos-conductor-dialog',
  imports: [DatePipe, DynadrillButtonComponent, DynadrillTagComponent, DynadrillTextareaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="permisos-dialog">
      <p class="permisos-dialog__nota">
        Conductor: <strong>{{ data.conductor.usuario.nombre }}</strong>
      </p>
      @if (cargando()) {
        <p role="status">Cargando…</p>
      } @else if (historia().length === 0) {
        <p class="permisos-dialog__nota">Todavía no tiene documentos registrados.</p>
      }
      <ul class="permisos-dialog__lista">
        @for (p of historia(); track p.id) {
          <li [class.is-anulado]="!!p.anulado">
            <div>
              <strong>{{ p.tipo.nombre }}</strong>
              {{ p.vigenteHasta ? ' · vence ' + formato(p.vigenteHasta) : '' }}
              <br />
              <small
                >Registrado por {{ p.registradoPor.nombre }} el
                {{ p.registradoAt | date: 'dd/MM/yyyy HH:mm' }}</small
              >
              @if (p.anulado) {
                <br /><small>Anulado: {{ p.anulado.motivo }}</small>
              }
            </div>
            @if (p.anulado) {
              <dynadrill-tag label="Anulado" variant="neutral" />
            } @else if (puedeGestionar()) {
              <dynadrill-button variant="secondary" size="small" (clicked)="pedirAnular(p.id)"
                >Anular</dynadrill-button
              >
            }
          </li>
        }
      </ul>
      @if (anulando()) {
        <dynadrill-textarea
          label="Motivo de la anulación"
          [value]="motivo()"
          (valueChange)="motivo.set($event)"
          [rows]="2"
        />
        <div class="permisos-dialog__acciones">
          <dynadrill-button variant="secondary" (clicked)="anulando.set(null)"
            >Volver</dynadrill-button
          >
          <dynadrill-button
            variant="error"
            [disabled]="motivo().trim().length < 5 || enviando()"
            (clicked)="confirmar()"
            >Confirmar anulación</dynadrill-button
          >
        </div>
      } @else {
        <div class="permisos-dialog__acciones">
          <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
        </div>
      }
    </div>
  `,
  styles: `
    .permisos-dialog {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .permisos-dialog__nota {
      margin: 0;
      color: var(--text-muted, #5c5870);
    }
    .permisos-dialog__lista {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .permisos-dialog__lista li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      border-radius: 6px;
      background: var(--surface-alt, rgba(0, 0, 0, 0.03));
    }
    .permisos-dialog__lista li.is-anulado {
      opacity: 0.7;
    }
    .permisos-dialog__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid var(--border, #e5e4ea);
      padding-top: 16px;
    }
  `,
})
export class PermisosConductorDialog {
  private readonly api = inject(FlotaInspeccionesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<PermisosConductorDialog, boolean>);
  protected readonly data = inject<PermisosConductorDialogData>(NZ_MODAL_DATA);

  protected readonly formato = formatoFecha;
  protected readonly cargando = signal(true);
  protected readonly historia = signal<PermisoHistoria[]>([]);
  protected readonly anulando = signal<string | null>(null);
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  private hubo = false;
  protected readonly puedeGestionar = computed(() => this.auth.can('flota.conductores.gestionar'));

  constructor() {
    this.recargar();
  }

  private recargar(): void {
    this.api.historiaPermisos(this.data.conductor.usuario.id).subscribe({
      next: (h) => {
        this.historia.set(h);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected pedirAnular(permisoId: string): void {
    this.motivo.set('');
    this.anulando.set(permisoId);
  }

  protected confirmar(): void {
    const id = this.anulando();
    if (!id || this.motivo().trim().length < 5 || this.enviando()) return;
    this.enviando.set(true);
    this.api.anularPermiso(id, this.motivo().trim()).subscribe({
      next: () => {
        this.notify.success('Documento anulado', this.data.conductor.usuario.nombre);
        this.hubo = true;
        this.enviando.set(false);
        this.anulando.set(null);
        this.recargar();
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.notify.error(
          'No se pudo anular',
          mensajeDeError(e, 'No se pudo anular el documento.'),
        );
      },
    });
  }

  protected cerrar(): void {
    this.modalRef.close(this.hubo);
  }
}
