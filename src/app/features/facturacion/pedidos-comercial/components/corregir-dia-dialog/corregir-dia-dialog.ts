import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type {
  ActividadOperativa,
  OrigenDocumentoOperativo,
} from '../../models/documentos-operativos';
import { mensajeDeError } from '../../models/pedido-comercial.model';
import { PedidosComercialService } from '../../services/pedidos-comercial.service';

export interface CorregirDiaDialogData {
  pedidoId: string;
  origen: OrigenDocumentoOperativo;
  /** Día del Reporte Job (`yyyy-MM-dd`). */
  fecha: string;
  actividades: ActividadOperativa[];
}

interface Fila {
  /** Posición de la actividad original (conserva su autor y sus tablas); `null` si es nueva. */
  previa: number | null;
  horaInicio: string;
  horaFin: string;
  detalle: string;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Horas entre dos horas HH:mm (si el fin es menor, cruza la medianoche); `null` si falta alguna. */
const duracion = (ini: string, fin: string): number | null => {
  if (!HORA.test(ini) || !HORA.test(fin)) return null;
  const [hi, mi] = ini.split(':').map(Number);
  const [hf, mf] = fin.split(':').map(Number);
  let min = hf * 60 + mf - (hi * 60 + mi);
  if (min < 0) min += 24 * 60;
  return Math.round((min / 60) * 100) / 100;
};

/**
 * Facturación corrige las actividades de un día del Reporte Job (hasta que el pedido sale al cliente para firmas). Con la presentación
 * del formulario de actividades de la demo. Quitar todas las actividades quita el día (Operaciones no podrá reenviarlo desde el ticket).
 */
@Component({
  selector: 'app-corregir-dia-dialog',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  template: `
    <section class="cd__bloque">
      <dynadrill-text variant="h2">Actividades del {{ fechaTexto }}</dynadrill-text>
      <dynadrill-text variant="caption">
        Corrija las horas o el detalle de cada actividad. Las tablas de cada actividad se conservan
        como las envió Operaciones.
      </dynadrill-text>

      <div class="cd__cabecera">
        <span>Inicio</span><span>Fin</span><span>Horas</span><span>Detalle de actividades</span
        ><span></span>
      </div>
      @for (f of filas(); track $index; let i = $index) {
        <div class="cd__fila">
          <input
            type="time"
            class="cd__hora"
            aria-label="Hora de inicio"
            [value]="f.horaInicio"
            (input)="cambiar(i, 'horaInicio', $any($event.target).value)"
          />
          <input
            type="time"
            class="cd__hora"
            aria-label="Hora de fin"
            [value]="f.horaFin"
            (input)="cambiar(i, 'horaFin', $any($event.target).value)"
          />
          <span class="cd__horas">{{ horasTexto(f) }}</span>
          <dynadrill-textarea
            label=""
            placeholder="Describa la actividad..."
            [value]="f.detalle"
            (valueChange)="cambiar(i, 'detalle', $event)"
          />
          <dynadrill-icon-button icon="delete" tooltip="Quitar actividad" (clicked)="quitar(i)" />
        </div>
      }
      <button type="button" class="cd__agregar" (click)="agregar()">+ Agregar actividad</button>
      <dynadrill-text variant="body"
        ><strong>Total del día:</strong> {{ total() }} h</dynadrill-text
      >

      @if (filas().length === 0) {
        <dynadrill-banner
          variant="warning"
          message="Sin actividades, el día se quita del Reporte Job y el ticket ya no podrá reenviarlo."
        />
      }
      @if (problema(); as p) {
        <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
      }
      @if (error(); as e) {
        <dynadrill-banner variant="critical" [message]="e" />
      }
    </section>
    <footer class="cd__acciones">
      <dynadrill-button variant="secondary" (clicked)="cerrar()">Cancelar</dynadrill-button>
      <dynadrill-button
        variant="success"
        [disabled]="!!problema() || enviando()"
        (clicked)="guardar()"
        >{{ enviando() ? 'Guardando…' : 'Guardar corrección' }}</dynadrill-button
      >
    </footer>
  `,
  styles: `
    .cd__bloque {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cd__cabecera,
    .cd__fila {
      display: grid;
      grid-template-columns: 100px 100px 60px 1fr 40px;
      gap: 12px;
      align-items: center;
    }
    .cd__cabecera {
      padding: 8px 0;
      border-bottom: 2px solid var(--border, #e0e0e0);
      font-weight: 600;
      font-size: 13px;
      color: var(--text-muted, #5c5870);
    }
    .cd__fila {
      padding: 10px 12px;
      border: 1px solid var(--border, #ecebf1);
      border-radius: 8px;
    }
    .cd__hora {
      height: 36px;
      width: 100%;
      padding: 0 8px;
      border: 1px solid var(--border, #d9d9d9);
      border-radius: 6px;
      font: inherit;
      font-size: 13px;
    }
    .cd__horas {
      text-align: center;
    }
    .cd__agregar {
      align-self: center;
      border: 0;
      background: none;
      color: var(--dynadrill-purple, #662e9b);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: 8px 16px;
    }
    .cd__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border, #e0e0e0);
    }
    @media (max-width: 640px) {
      .cd__cabecera {
        display: none;
      }
      .cd__fila {
        grid-template-columns: 1fr 1fr auto;
      }
      .cd__fila dynadrill-textarea {
        grid-column: 1 / -1;
      }
      .cd__horas {
        display: none;
      }
    }
  `,
})
export class CorregirDiaDialog {
  private readonly servicio = inject(PedidosComercialService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<CorregirDiaDialog, boolean>);
  private readonly data = inject<CorregirDiaDialogData>(NZ_MODAL_DATA);

  protected readonly fechaTexto = this.data.fecha.split('-').reverse().join('/');
  protected readonly filas = signal<Fila[]>(
    this.data.actividades.map((a, i) => ({
      previa: i,
      horaInicio: a.horaInicio ?? '',
      horaFin: a.horaFin ?? '',
      detalle: a.detalle ?? '',
    })),
  );
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly total = computed(
    () =>
      Math.round(
        this.filas().reduce((s, f) => s + (duracion(f.horaInicio, f.horaFin) ?? 0), 0) * 100,
      ) / 100,
  );
  protected readonly problema = computed(() => {
    for (const f of this.filas()) {
      if (!HORA.test(f.horaInicio) || !HORA.test(f.horaFin))
        return 'Indique la hora de inicio y de fin de cada actividad.';
      if (!f.detalle.trim()) return 'Describa cada actividad.';
    }
    return null;
  });

  protected horasTexto(f: Fila): string {
    const h = duracion(f.horaInicio, f.horaFin);
    return h === null ? '—' : String(h);
  }
  protected cambiar(i: number, campo: keyof Fila, valor: string): void {
    this.filas.update((l) => l.map((f, k) => (k === i ? { ...f, [campo]: valor } : f)));
  }
  protected agregar(): void {
    this.filas.update((l) => [...l, { previa: null, horaInicio: '', horaFin: '', detalle: '' }]);
  }
  protected quitar(i: number): void {
    this.filas.update((l) => l.filter((_, k) => k !== i));
  }

  protected guardar(): void {
    if (this.problema() || this.enviando()) return;
    // las tablas y el autor de cada actividad se conservan (se emparejan con la actividad original)
    const previas = this.data.actividades;
    this.enviando.set(true);
    this.error.set(null);
    this.servicio
      .corregirDiaOperativo(this.data.pedidoId, {
        origen: this.data.origen,
        fecha: this.data.fecha,
        actividades: this.filas().map((f) => {
          const previa = f.previa === null ? undefined : previas[f.previa];
          return {
            fecha: this.data.fecha,
            horaInicio: f.horaInicio,
            horaFin: f.horaFin,
            duracionHoras: duracion(f.horaInicio, f.horaFin) ?? 0,
            detalle: f.detalle.trim(),
            autor: previa?.autor ?? undefined,
            tablas: previa?.tablas?.map((t) => ({
              titulo: t.titulo ?? undefined,
              columnas: t.columnas,
              filas: t.filas,
            })),
          };
        }),
      })
      .subscribe({
        next: () => this.modalRef.close(true),
        error: (err) => {
          this.enviando.set(false);
          this.error.set(mensajeDeError(err, 'No se pudo guardar la corrección.'));
          this.notify.error(
            'No se pudo guardar',
            mensajeDeError(err, 'No se pudo guardar la corrección.'),
          );
        },
      });
  }

  protected cerrar(): void {
    this.modalRef.close(false);
  }
}
