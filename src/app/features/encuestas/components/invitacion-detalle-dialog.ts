import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADO_INVITACION_LABEL,
  mensajeErrorEncuesta,
  textoDeRespuesta,
  type InvitacionDetalle,
} from '../models/encuestas.model';
import { EncuestasService } from '../services/encuestas.service';

export interface InvitacionDetalleDialogData {
  invitacionId: string;
}

/** Lo que se envió a un cliente y, si ya contestó, quién y qué respondió en cada pregunta. */
@Component({
  selector: 'app-invitacion-detalle-dialog',
  imports: [DatePipe, DynadrillButtonComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    @if (error(); as e) {
      <dynadrill-text variant="body" role="alert">{{ e }}</dynadrill-text>
    } @else if (detalle(); as d) {
      <dl class="d__datos">
        <div>
          <dt>Estado</dt>
          <dd>{{ estado(d) }}</dd>
        </div>
        <div>
          <dt>Enviada a</dt>
          <dd>{{ d.correoDestino }}</dd>
        </div>
        <div>
          <dt>Versión</dt>
          <dd>{{ d.version }} · {{ d.titulo }}</dd>
        </div>
        <div>
          <dt>Vence</dt>
          <dd>{{ d.venceAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
        </div>
        @if (d.respondiente; as r) {
          <div>
            <dt>Respondió</dt>
            <dd>{{ r.nombre }}{{ r.cargo ? ' · ' + r.cargo : '' }}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{{ d.respondidaAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
          </div>
        }
      </dl>

      @if (d.envioError) {
        <dynadrill-text variant="caption" role="status"
          >El correo no salió: {{ d.envioError }}</dynadrill-text
        >
      }

      @if (d.respondiente) {
        <ol class="d__respuestas">
          @for (r of d.respuestas; track r.preguntaId) {
            <li>
              <span class="d__pregunta">{{ r.texto }}</span>
              <span class="d__valor">{{ texto(r.valor) }}</span>
            </li>
          }
        </ol>
      } @else {
        <dynadrill-text variant="caption"
          >El cliente todavía no ha respondido esta encuesta.</dynadrill-text
        >
      }
    } @else {
      <dynadrill-text variant="caption" role="status">Cargando…</dynadrill-text>
    }
    <footer class="d__acciones">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
    </footer>
  `,
  styles: `
    .d__datos {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin: 0 0 16px;
    }
    .d__datos dt {
      font-size: 12px;
      color: #5c5870;
    }
    .d__datos dd {
      margin: 0;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .d__respuestas {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding-left: 20px;
      max-height: 50vh;
      overflow-y: auto;
    }
    .d__pregunta {
      display: block;
      font-size: 13px;
      color: #5c5870;
    }
    .d__valor {
      display: block;
      font-weight: 600;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .d__acciones {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class InvitacionDetalleDialog {
  private readonly servicio = inject(EncuestasService);
  private readonly modalRef = inject(NzModalRef<InvitacionDetalleDialog, void>);
  private readonly data = inject<InvitacionDetalleDialogData>(NZ_MODAL_DATA);

  protected readonly detalle = signal<InvitacionDetalle | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly texto = textoDeRespuesta;

  constructor() {
    this.servicio.invitacion(this.data.invitacionId).subscribe({
      next: (d) => this.detalle.set(d),
      error: (err) =>
        this.error.set(
          mensajeErrorEncuesta(err, 'No se pudo cargar el detalle. Intente de nuevo.'),
        ),
    });
  }

  protected estado(d: InvitacionDetalle): string {
    return ESTADO_INVITACION_LABEL[d.estado];
  }

  protected cerrar(): void {
    this.modalRef.close();
  }
}
