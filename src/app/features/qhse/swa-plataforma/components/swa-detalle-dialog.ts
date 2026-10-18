import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import {
  ESTADO_SWA_ETIQUETA,
  PERMISO_SWA_GESTIONAR,
  SWA_CERO_REPRESALIAS,
  type SwaDetalle,
} from '../models/swa';
import { SwaService } from '../services/swa.service';

export interface SwaDetalleDialogData {
  swaId: string;
}

/** Gestión de una SWA: notificar a la cadena, evaluar (bloqueada hasta notificar a todos), checklist de reinicio y reanudar. */
@Component({
  selector: 'app-swa-detalle-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DatePipe,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (swa(); as s) {
      <header class="sd__cab">
        <div>
          <strong>{{ s.codigo }}</strong> · {{ s.tipoPeligro.nombre }}
          <div class="sd__meta">
            Activada por {{ s.activadoPor }} el {{ s.activadoAt | date: 'dd/MM/yyyy HH:mm' }}
          </div>
          @if (s.ticketId) {
            <div class="sd__meta">
              Bloquea el ticket {{ s.ticketNumero ?? '—' }} · {{ s.pedidoCodigo }} ·
              {{ s.cliente ?? '—' }}
            </div>
          }
        </div>
        <dynadrill-tag
          [variant]="
            s.estado === 'cerrado' ? 'success' : s.estado === 'activo' ? 'error' : 'warning'
          "
          >{{ etiqueta[s.estado] }}</dynadrill-tag
        >
      </header>
      <p>
        {{ s.descripcion }}
        @if (s.ubicacion) {
          <span class="sd__meta"> — {{ s.ubicacion }}</span>
        }
      </p>
      <p class="sd__aviso">{{ aviso }}</p>

      <h4 class="sd__tit">1. Cadena de notificación</h4>
      <ul class="sd__lista">
        @for (c of s.cadena; track c.rolCadenaId) {
          <li>
            <span>{{ c.notificadoAt ? '✔' : '○' }} {{ c.rol }}</span>
            @if (c.notificadoAt) {
              <span class="sd__meta"
                >{{ c.notificadoPor }} · {{ c.notificadoAt | date: 'dd/MM HH:mm' }}</span
              >
            } @else if (s.estado === 'activo' && puedeGestionar()) {
              <dynadrill-button
                variant="secondary"
                [disabled]="trabajando()"
                (clicked)="notificar(c.rolCadenaId)"
                >Marcar notificado</dynadrill-button
              >
            }
          </li>
        }
      </ul>

      <h4 class="sd__tit">2. Evaluación del riesgo</h4>
      @if (s.estado === 'activo') {
        @if (!s.notificacionCompleta) {
          <p class="sd__meta">Bloqueada hasta notificar a todos los roles de la cadena.</p>
        } @else if (puedeGestionar()) {
          <dynadrill-input
            label="Nota de la evaluación (opcional)"
            [value]="nota()"
            (valueChange)="nota.set($event)"
          />
          <div class="sd__fila">
            <dynadrill-button [disabled]="trabajando()" (clicked)="evaluar(true)"
              >Riesgo real</dynadrill-button
            >
            <dynadrill-button
              variant="secondary"
              [disabled]="trabajando()"
              (clicked)="evaluar(false)"
              >Falsa alarma</dynadrill-button
            >
          </div>
        }
      } @else {
        <p>
          {{ s.riesgoReal ? 'Riesgo real' : 'Falsa alarma' }} — {{ s.evaluadoPor }} ·
          {{ s.evaluadoAt | date: 'dd/MM/yyyy HH:mm' }}
          @if (s.evaluacionNota) {
            <span class="sd__meta"> — {{ s.evaluacionNota }}</span>
          }
        </p>
      }

      <h4 class="sd__tit">3. Checklist de reinicio</h4>
      <ul class="sd__lista">
        @for (c of s.criterios; track c.criterioId) {
          <li>
            <span>{{ c.confirmadoAt ? '✔' : '○' }} {{ c.nombre }}</span>
            @if (c.confirmadoAt) {
              <span class="sd__meta">{{ c.confirmadoPor }}</span>
            } @else if (s.estado === 'evaluado' && puedeGestionar()) {
              <dynadrill-button
                variant="secondary"
                [disabled]="trabajando()"
                (clicked)="confirmar(c.criterioId)"
                >Confirmar</dynadrill-button
              >
            }
          </li>
        }
      </ul>
      @if (s.estado === 'evaluado' && puedeGestionar()) {
        <div class="sd__fila">
          <dynadrill-button
            [disabled]="!s.reinicioCompleto || trabajando()"
            (clicked)="reanudar(false)"
            >Reanudar el trabajo</dynadrill-button
          >
          <dynadrill-button
            variant="secondary"
            [disabled]="!s.reinicioCompleto || trabajando()"
            (clicked)="reanudar(true)"
            >Reanudar y reconocer «Héroe de Seguridad»</dynadrill-button
          >
        </div>
      }
      @if (s.estado === 'cerrado') {
        <p class="sd__meta">
          Reanudada por {{ s.reanudadoPor }} el {{ s.reanudadoAt | date: 'dd/MM/yyyy HH:mm' }}
          @if (s.heroeSeguridad) {
            · Héroe de Seguridad
          }
        </p>
      }

      <h4 class="sd__tit">Historial</h4>
      <ul class="sd__hist">
        @for (h of s.historial; track h.at) {
          <li>
            {{ h.at | date: 'dd/MM/yyyy HH:mm' }} ·
            {{ h.estadoAnterior ? etiqueta[h.estadoAnterior] + ' → ' : ''
            }}{{ etiqueta[h.estadoNuevo] }} · {{ h.actor }}
          </li>
        }
      </ul>
      <footer class="sd__pie">
        <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
      </footer>
    } @else {
      <dynadrill-text variant="caption">Consultando…</dynadrill-text>
    }
  `,
  styles: `
    .sd__cab {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .sd__meta {
      font-size: 12px;
      color: #6b6a77;
      margin-top: 2px;
    }
    .sd__aviso {
      background: #eef6ff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
    }
    .sd__tit {
      margin: 16px 0 6px;
      font-size: 14px;
    }
    .sd__lista {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .sd__lista li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .sd__fila {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .sd__hist {
      margin: 0;
      padding-left: 18px;
      font-size: 12px;
      color: #6b6a77;
    }
    .sd__pie {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class SwaDetalleDialog {
  private readonly data = inject<SwaDetalleDialogData>(NZ_MODAL_DATA);
  private readonly servicio = inject(SwaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<SwaDetalleDialog, boolean | undefined>);

  protected readonly etiqueta = ESTADO_SWA_ETIQUETA;
  protected readonly aviso = SWA_CERO_REPRESALIAS;
  protected readonly swa = signal<SwaDetalle | null>(null);
  protected readonly nota = signal('');
  protected readonly trabajando = signal(false);
  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_SWA_GESTIONAR));
  private huboCambio = false;

  constructor() {
    this.servicio.detalle(this.data.swaId).subscribe({
      next: (s) => this.swa.set(s),
      error: (err) => {
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la SWA.'));
        this.modalRef.close();
      },
    });
  }

  protected notificar(rolCadenaId: string): void {
    this.ejecutar(
      this.servicio.notificar(this.data.swaId, rolCadenaId),
      'Notificación registrada.',
    );
  }

  protected evaluar(riesgoReal: boolean): void {
    this.ejecutar(
      this.servicio.evaluar(this.data.swaId, riesgoReal, this.nota()),
      'Evaluación registrada.',
    );
  }

  protected confirmar(criterioId: string): void {
    this.ejecutar(
      this.servicio.confirmarCriterio(this.data.swaId, criterioId),
      'Criterio confirmado.',
    );
  }

  protected reanudar(heroe: boolean): void {
    this.ejecutar(
      this.servicio.reanudar(this.data.swaId, heroe),
      'Trabajo reanudado: el ticket queda libre si no tiene otras SWA abiertas.',
    );
  }

  protected cerrar(): void {
    this.modalRef.close(this.huboCambio);
  }

  private ejecutar(llamada: ReturnType<SwaService['detalle']>, exito: string): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    llamada.subscribe({
      next: (s) => {
        this.swa.set(s);
        this.huboCambio = true;
        this.trabajando.set(false);
        this.notify.success('Listo', exito);
      },
      error: (err) => {
        this.trabajando.set(false);
        this.notify.error('No se pudo', mensajeDeError(err, 'No se pudo completar la acción.'));
      },
    });
  }
}
