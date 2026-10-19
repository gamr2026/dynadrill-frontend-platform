import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADO_VIAJE_LABEL,
  NIVEL_LABEL,
  TIPO_VIAJE_LABEL,
  type EstadoViaje,
  type ExtremoDetalle,
  type NivelRiesgo,
  type ViajeDetalle,
} from '../models/viaje-flota.model';
import { FlotaViajesService } from '../services/flota-viajes.service';
import { formatoFecha, mensajeDeError } from '../utils/flota.util';

export interface ViajeDetalleDialogData {
  viajeId: string;
}

export const TONO_NIVEL: Record<NivelRiesgo, DynadrillTagVariant> = {
  bajo: 'success',
  medio: 'warning',
  alto: 'error',
};
export const TONO_ESTADO_VIAJE: Record<EstadoViaje, DynadrillTagVariant> = {
  pendiente: 'warning',
  autorizado: 'success',
  rechazado: 'error',
};

/** Detalle de un Gerenciamiento de Viaje; quien tiene el permiso que exige su nivel de riesgo puede autorizarlo o rechazarlo. */
@Component({
  selector: 'app-viaje-detalle-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [DatePipe, DynadrillButtonComponent, DynadrillTagComponent, DynadrillTextareaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viaje-detalle">
      @if (viaje(); as v) {
        <div class="viaje-detalle__cabecera">
          <strong>{{ v.codigo }} · {{ tipoTexto[v.tipo] }}</strong>
          <dynadrill-tag [label]="'Riesgo ' + nivelTexto[v.nivel]" [variant]="tonoNivel[v.nivel]" />
          <dynadrill-tag [label]="estadoTexto[v.estado]" [variant]="tonoEstado[v.estado]" />
        </div>
        @if (v.descripcionNivel) {
          <p class="viaje-detalle__nota">{{ v.descripcionNivel }}</p>
        }

        <dl class="viaje-detalle__datos">
          <div>
            <dt>Conductor</dt>
            <dd>{{ v.conductor.nombre }}</dd>
          </div>
          <div>
            <dt>Unidad</dt>
            <dd>
              {{ v.unidad.codigo }}{{ v.unidad.placa ? ' · ' + v.unidad.placa : ''
              }}{{ v.unidad.categoriaPeso ? ' · ' + v.unidad.categoriaPeso : '' }}
            </dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{{ fecha(v.fecha) }}</dd>
          </div>
          <div>
            <dt>Horario</dt>
            <dd>{{ v.horaSalida ?? '—' }} a {{ v.horaLlegada ?? '—' }}</dd>
          </div>
          <div>
            <dt>Origen</dt>
            <dd>{{ lugar(v.origen) }}</dd>
          </div>
          <div>
            <dt>Destino</dt>
            <dd>{{ lugar(v.destino) }}</dd>
          </div>
          <div>
            <dt>Motivo</dt>
            <dd>{{ v.motivo }}</dd>
          </div>
          <div>
            <dt>Puntaje</dt>
            <dd>{{ v.puntajeTotal }}</dd>
          </div>
          @if (v.pasajeros) {
            <div>
              <dt>Pasajeros</dt>
              <dd>{{ v.pasajeros }}</dd>
            </div>
          }
          @if (v.datosPernocta) {
            <div>
              <dt>Pernocta</dt>
              <dd>{{ v.datosPernocta }}</dd>
            </div>
          }
          @if (v.aprobacionTelefonica; as t) {
            <div>
              <dt>Visto bueno telefónico</dt>
              <dd>{{ t.de }} {{ t.hora ?? '' }}</dd>
            </div>
          }
        </dl>

        <h3 class="viaje-detalle__seccion">Cuestionario de riesgo</h3>
        <ul class="viaje-detalle__lista">
          @for (r of v.respuestas; track r.orden) {
            <li>
              <span>{{ r.orden }}. {{ r.pregunta }}</span
              ><strong>{{ r.opcion }}</strong>
            </li>
          }
        </ul>

        @if (v.paradas.length) {
          <h3 class="viaje-detalle__seccion">Paradas</h3>
          <ul class="viaje-detalle__lista">
            @for (p of v.paradas; track p.lugar) {
              <li>
                <span>{{ p.lugar }}</span
                ><strong>{{ p.horaLlegada ?? '—' }} / {{ p.horaSalida ?? '—' }}</strong>
              </li>
            }
          </ul>
        }
        @if (v.comunicaciones.length) {
          <h3 class="viaje-detalle__seccion">Comunicación</h3>
          <ul class="viaje-detalle__lista">
            @for (c of v.comunicaciones; track c.personaContacto) {
              <li>
                <span>{{ c.frecuencia }} · {{ c.personaContacto }}</span
                ><strong>{{ c.datosContacto ?? '' }}</strong>
              </li>
            }
          </ul>
        }
        @if (v.decision; as d) {
          <p class="viaje-detalle__nota">
            {{ v.estado === 'autorizado' ? 'Autorizado' : 'Rechazado' }} por
            {{ d.por?.nombre ?? '—' }} el {{ d.at | date: 'dd/MM/yyyy HH:mm'
            }}{{ d.motivo ? ': ' + d.motivo : '' }}
          </p>
        }

        @if (rechazando()) {
          <dynadrill-textarea
            label="Motivo del rechazo"
            [value]="motivo()"
            (valueChange)="motivo.set($event)"
            [rows]="2"
          />
        }
        <div class="viaje-detalle__acciones">
          <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
          <div class="viaje-detalle__acciones-der">
            @if (v.puedeDecidir) {
              @if (rechazando()) {
                <dynadrill-button variant="secondary" (clicked)="rechazando.set(false)"
                  >Volver</dynadrill-button
                >
                <dynadrill-button
                  variant="error"
                  [disabled]="motivo().trim().length < 5 || enviando()"
                  (clicked)="rechazar()"
                  >Confirmar rechazo</dynadrill-button
                >
              } @else {
                <dynadrill-button variant="error" (clicked)="rechazando.set(true)"
                  >Rechazar</dynadrill-button
                >
                <dynadrill-button [disabled]="enviando()" (clicked)="autorizar()"
                  >Autorizar</dynadrill-button
                >
              }
            }
          </div>
        </div>
      } @else {
        <p role="status">Cargando…</p>
      }
    </div>
  `,
  styles: `
    .viaje-detalle {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .viaje-detalle__cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .viaje-detalle__nota {
      margin: 0;
      color: var(--text-muted, #5c5870);
      font-size: 13px;
    }
    .viaje-detalle__seccion {
      margin: 8px 0 0;
      font-size: 14px;
    }
    .viaje-detalle__datos {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 16px;
      margin: 0;
    }
    .viaje-detalle__datos dt {
      font-size: 12px;
      color: var(--text-muted, #5c5870);
    }
    .viaje-detalle__datos dd {
      margin: 0;
      font-weight: 600;
    }
    .viaje-detalle__lista {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .viaje-detalle__lista li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--surface-alt, rgba(0, 0, 0, 0.03));
      font-size: 13px;
    }
    .viaje-detalle__acciones {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--border, #e5e4ea);
    }
    .viaje-detalle__acciones-der {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    @media (max-width: 640px) {
      .viaje-detalle__datos {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ViajeDetalleDialog {
  private readonly api = inject(FlotaViajesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ViajeDetalleDialog, boolean>);
  private readonly data = inject<ViajeDetalleDialogData>(NZ_MODAL_DATA);

  protected readonly tipoTexto = TIPO_VIAJE_LABEL;
  protected readonly nivelTexto = NIVEL_LABEL;
  protected readonly estadoTexto = ESTADO_VIAJE_LABEL;
  protected readonly tonoNivel = TONO_NIVEL;
  protected readonly tonoEstado = TONO_ESTADO_VIAJE;
  protected readonly fecha = formatoFecha;

  protected readonly viaje = signal<ViajeDetalle | null>(null);
  protected readonly rechazando = signal(false);
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  protected readonly hayCambio = computed(() => false);

  constructor() {
    this.api.obtener(this.data.viajeId).subscribe({
      next: (v) => this.viaje.set(v),
      error: (e: HttpErrorResponse) => {
        this.notify.error(
          'Error',
          mensajeDeError(e, 'No se pudo cargar el gerenciamiento de viaje.'),
        );
        this.modalRef.close(false);
      },
    });
  }

  protected lugar(e: ExtremoDetalle): string {
    return e.tipo === 'pozo' && e.campo ? `${e.nombre} (${e.campo})` : e.nombre;
  }

  protected cerrar(): void {
    this.modalRef.close(false);
  }

  protected autorizar(): void {
    this.decidir(this.api.autorizar(this.data.viajeId), 'Viaje autorizado');
  }

  protected rechazar(): void {
    this.decidir(this.api.rechazar(this.data.viajeId, this.motivo().trim()), 'Viaje rechazado');
  }

  private decidir(llamada: ReturnType<FlotaViajesService['autorizar']>, exito: string): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    llamada.subscribe({
      next: () => {
        this.notify.success(exito, this.viaje()?.codigo ?? '');
        this.modalRef.close(true);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.notify.error(
          'No se pudo completar',
          mensajeDeError(e, 'No se pudo completar la acción.'),
        );
      },
    });
  }
}
