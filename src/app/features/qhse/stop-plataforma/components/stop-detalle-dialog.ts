import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../shared/components/motivo-dialog/motivo-dialog';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import {
  ESTADO_STOP_ETIQUETA,
  ESTADO_STOP_TONO,
  PERMISO_STOP_GESTIONAR,
  accionesDisponibles,
  type AccionStop,
  type StopDetalle,
} from '../models/stop';
import { StopService } from '../services/stop.service';

export interface StopDetalleDialogData {
  stopId: string;
}

/** Detalle de una tarjeta STOP: lo observado, lo que QHSE hizo con ella y las acciones que le quedan (derivar, resolver o cerrar). */
@Component({
  selector: 'app-stop-detalle-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DatePipe, DynadrillButtonComponent, DynadrillTagComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (stop(); as s) {
      <header class="sd__cab">
        <div>
          <strong>{{ s.codigo }}</strong> · {{ s.fecha | date: 'dd/MM/yyyy' }}
          <div class="sd__meta">
            Observador: {{ s.observador.nombre }} · Observado:
            {{ s.observado?.nombre ?? 'Anónimo / no indicado' }}
          </div>
          <div class="sd__meta">
            {{ s.operadora?.nombre ?? '—' }} · {{ s.campo?.nombre ?? '—' }} · {{ s.lugar ?? '—' }}
            @if (s.contacto) {
              · Contacto: {{ s.contacto }}
            }
          </div>
        </div>
        <dynadrill-tag [variant]="tono()">{{ etiqueta[s.estado] }}</dynadrill-tag>
      </header>

      @for (bloque of bloques; track bloque.clave) {
        @if (itemsDe(bloque.clave).length) {
          <h4 class="sd__tit">{{ bloque.titulo }}</h4>
          <ul class="sd__lista">
            @for (i of itemsDe(bloque.clave); track i.itemId) {
              <li>
                <span>{{ i.subcategoria }} · {{ i.item }}</span>
                <dynadrill-tag [variant]="i.estado === 'inseguro' ? 'error' : 'success'">{{
                  i.estado === 'inseguro' ? 'Inseguro' : 'Seguro'
                }}</dynadrill-tag>
              </li>
            }
          </ul>
          @if (bloque.clave === 'acciones' ? s.accionesQueObserva : s.condicionesQueObserva; as q) {
            <p class="sd__txt"><strong>Qué observa:</strong> {{ q }}</p>
          }
          @if (bloque.clave === 'acciones' ? s.accionesAccion : s.condicionesAccion; as a) {
            <p class="sd__txt"><strong>Acciones:</strong> {{ a }}</p>
          }
        }
      }

      @if (s.fotoArchivoId) {
        <dynadrill-button variant="secondary" (clicked)="verFoto(s.fotoArchivoId)"
          >Ver la foto</dynadrill-button
        >
      }

      @if (s.atendidoObservacion) {
        <p class="sd__aviso">
          {{ s.atendidoPor }} · {{ s.atendidoAt | date: 'dd/MM/yyyy HH:mm' }}:
          {{ s.atendidoObservacion }}
        </p>
      }
      @if (s.cerradoPor) {
        <p class="sd__meta">
          Cerrada por {{ s.cerradoPor }} el {{ s.cerradoAt | date: 'dd/MM/yyyy HH:mm' }}.
        </p>
      }

      @if (puedeGestionar() && acciones().length) {
        <div class="sd__fila">
          @for (a of acciones(); track a) {
            <dynadrill-button
              [variant]="a === 'cerrar' ? 'primary' : 'secondary'"
              [disabled]="trabajando()"
              (clicked)="actuar(a)"
              >{{ etiquetaAccion[a] }}</dynadrill-button
            >
          }
        </div>
      }

      <h4 class="sd__tit">Historial</h4>
      <ul class="sd__hist">
        @for (h of s.historial; track h.at) {
          <li>
            {{ h.at | date: 'dd/MM/yyyy HH:mm' }} ·
            {{ h.estadoAnterior ? etiqueta[h.estadoAnterior] + ' → ' : ''
            }}{{ etiqueta[h.estadoNuevo] }} · {{ h.actor }}
            @if (h.observacion) {
              — {{ h.observacion }}
            }
          </li>
        }
      </ul>
      <footer class="sd__pie">
        <dynadrill-button variant="secondary" (clicked)="cerrarDialogo()">Cerrar</dynadrill-button>
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
      font-size: 13.5px;
    }
    .sd__txt {
      margin: 4px 0;
      font-size: 13.5px;
    }
    .sd__aviso {
      background: #eef6ff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
    }
    .sd__fila {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
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
export class StopDetalleDialog {
  private readonly data = inject<StopDetalleDialogData>(NZ_MODAL_DATA);
  private readonly servicio = inject(StopService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<StopDetalleDialog, boolean | undefined>);

  protected readonly etiqueta = ESTADO_STOP_ETIQUETA;
  protected readonly etiquetaAccion: Record<AccionStop, string> = {
    derivar_mantenimiento: 'Derivar a Mantenimiento',
    derivar_otro: 'Derivar a otro departamento',
    resolver: 'Resolver por QHSE',
    cerrar: 'Cerrar (el otro departamento ya actuó)',
  };
  protected readonly bloques = [
    { clave: 'acciones' as const, titulo: 'Acciones' },
    { clave: 'condiciones' as const, titulo: 'Condiciones' },
  ];
  protected readonly stop = signal<StopDetalle | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_STOP_GESTIONAR));
  protected readonly acciones = computed(() => {
    const s = this.stop();
    return s ? accionesDisponibles(s.estado) : [];
  });
  protected readonly tono = computed<DynadrillTagVariant>(() => {
    const s = this.stop();
    return s ? (ESTADO_STOP_TONO[s.estado] as DynadrillTagVariant) : 'neutral';
  });
  private huboCambio = false;

  constructor() {
    this.servicio.detalle(this.data.stopId).subscribe({
      next: (s) => this.stop.set(s),
      error: (err) => {
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la tarjeta.'));
        this.modalRef.close();
      },
    });
  }

  protected itemsDe(bloque: 'acciones' | 'condiciones') {
    return this.stop()?.items.filter((i) => i.bloque === bloque) ?? [];
  }

  protected actuar(accion: AccionStop): void {
    const s = this.stop();
    if (!s) return;
    if (accion === 'cerrar') return this.ejecutar(this.servicio.cerrar(s.id), 'Tarjeta cerrada.');
    const titulo =
      accion === 'resolver'
        ? 'Resolver la tarjeta'
        : accion === 'derivar_mantenimiento'
          ? 'Derivar a Mantenimiento'
          : 'Derivar a otro departamento';
    const ref = this.dialogos.open<MotivoDialog, MotivoDialogData>({
      title: titulo,
      content: MotivoDialog,
      data: {
        mensaje:
          accion === 'resolver'
            ? '¿Qué se hizo para resolver la observación?'
            : '¿A quién se deriva y qué se pidió?',
        label: accion === 'resolver' ? 'Qué se hizo' : 'Observación',
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((obs: string | undefined) => {
      if (!obs) return;
      if (accion === 'resolver')
        this.ejecutar(this.servicio.resolver(s.id, obs), 'Tarjeta resuelta.');
      else
        this.ejecutar(
          this.servicio.derivar(
            s.id,
            accion === 'derivar_mantenimiento' ? 'mantenimiento' : 'otro',
            obs,
          ),
          'Tarjeta derivada.',
        );
    });
  }

  protected verFoto(archivoId: string): void {
    this.servicio.abrirFoto(archivoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) =>
        this.notify.error('No se pudo abrir', mensajeDeError(err, 'No se pudo abrir la foto.')),
    });
  }

  protected cerrarDialogo(): void {
    this.modalRef.close(this.huboCambio);
  }

  private ejecutar(llamada: Observable<StopDetalle>, exito: string): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    llamada.subscribe({
      next: (s) => {
        this.stop.set(s);
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
