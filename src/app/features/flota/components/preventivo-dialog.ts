import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import type { PreventivoFlota, UnidadFlota } from '../models/unidad-flota.model';
import { FlotaUnidadesService } from '../services/flota-unidades.service';
import { aFechaIso, mensajeDeError } from '../utils/flota.util';

export interface PreventivoDialogData {
  unidad: UnidadFlota;
}

const SERVICIO_OPCIONES: DynadrillSelectOption[] = [
  { label: 'Tipo A (cada 250 h)', value: 'a' },
  { label: 'Tipo B (cada 2.000 h, incluye el A)', value: 'b' },
];
const EJECUTADO_OPCIONES: DynadrillSelectOption[] = [
  { label: 'Interno (Dynadrill)', value: 'interno' },
  { label: 'Tercero (proveedor)', value: 'tercero' },
];

/** Registra un mantenimiento preventivo: el backend guarda la lectura de ese momento y reinicia el contador correspondiente. */
@Component({
  selector: 'app-preventivo-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preventivo-dialog">
      @if (esServicio) {
        <dynadrill-select
          label="Tipo de servicio"
          [options]="servicioOpciones"
          [value]="tipoServicio()"
          (valueChange)="tipoServicio.set($any($event))"
        />
      }
      <dynadrill-datetime-picker
        label="Fecha del mantenimiento"
        mode="date"
        [value]="$any(fecha())"
        (valueChange)="fecha.set($any($event))"
      />
      @if (esServicio || esTransporte) {
        <dynadrill-input
          [label]="etiquetaLectura"
          type="number"
          [value]="valor()"
          (valueChange)="valor.set($event)"
        />
      }
      <dynadrill-select
        label="Lo hizo"
        [options]="ejecutadoOpciones"
        [value]="ejecutadoPor()"
        (valueChange)="ejecutadoPor.set($any($event))"
      />
      @if (ejecutadoPor() === 'tercero') {
        <dynadrill-select
          label="Proveedor"
          placeholder="Seleccione el proveedor"
          [options]="proveedorOpciones()"
          [value]="proveedorId()"
          (valueChange)="proveedorId.set($any($event))"
        />
      }
      <dynadrill-textarea
        label="Observaciones"
        [value]="observaciones()"
        (valueChange)="observaciones.set($event)"
        [rows]="2"
      />
      <div class="preventivo-dialog__actions">
        <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
        <dynadrill-button [disabled]="!puedeGuardar()" (clicked)="guardar()">
          {{ enviando() ? 'Guardando…' : 'Registrar mantenimiento' }}
        </dynadrill-button>
      </div>
    </div>
  `,
  styles: `
    .preventivo-dialog {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .preventivo-dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid var(--border, #e5e4ea);
      padding-top: 16px;
    }
  `,
})
export class PreventivoDialog {
  private readonly flota = inject(FlotaUnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<PreventivoDialog, PreventivoFlota | undefined>);
  private readonly unidad = inject<PreventivoDialogData>(NZ_MODAL_DATA).unidad;

  protected readonly esServicio = this.unidad.tipo === 'servicio';
  protected readonly esTransporte = this.unidad.tipo === 'transporte';
  protected readonly etiquetaLectura = this.esServicio
    ? 'Horómetro al hacerlo (h)'
    : 'Kilometraje al hacerlo (km)';
  protected readonly servicioOpciones = SERVICIO_OPCIONES;
  protected readonly ejecutadoOpciones = EJECUTADO_OPCIONES;

  protected readonly tipoServicio = signal<'a' | 'b' | null>(null);
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly valor = signal('');
  protected readonly ejecutadoPor = signal<'interno' | 'tercero'>('interno');
  protected readonly proveedorId = signal<string | null>(null);
  protected readonly observaciones = signal('');
  protected readonly proveedorOpciones = signal<DynadrillSelectOption[]>([]);
  protected readonly enviando = signal(false);

  /** Una unidad que nunca tuvo lectura (p. ej. una cisterna sin horómetro) se controla solo por tiempo: el backend no la exige. */
  private readonly exigeLectura = this.esServicio
    ? !!this.unidad.horometro
    : this.esTransporte
      ? !!this.unidad.odometro
      : false;

  protected readonly puedeGuardar = computed(() => {
    if (this.enviando() || !this.fecha()) return false;
    if (this.esServicio && !this.tipoServicio()) return false;
    const v = this.valor().trim();
    if (v !== '' && Number.isNaN(Number(v))) return false;
    if (this.exigeLectura && v === '') return false;
    if (this.ejecutadoPor() === 'tercero' && !this.proveedorId()) return false;
    return true;
  });

  constructor() {
    this.flota.proveedores().subscribe({
      next: (ps) => this.proveedorOpciones.set(ps.map((p) => ({ label: p.nombre, value: p.id }))),
      error: () =>
        this.notify.error('Error', 'No se pudo cargar los proveedores de mantenimiento.'),
    });
  }

  protected guardar(): void {
    if (!this.puedeGuardar()) return;
    this.enviando.set(true);
    const v = this.valor().trim();
    this.flota
      .registrarPreventivo(this.unidad.id, {
        tipoServicio: this.esServicio ? this.tipoServicio() : null,
        fecha: aFechaIso(this.fecha()) as string,
        valor: v === '' ? null : Number(v),
        ejecutadoPor: this.ejecutadoPor(),
        proveedorMantenimientoId: this.ejecutadoPor() === 'tercero' ? this.proveedorId() : null,
        observaciones: this.observaciones().trim() || null,
      })
      .subscribe({
        next: (p) => {
          this.notify.success(
            'Mantenimiento registrado',
            `${this.unidad.codigo}: el contador se reinició.`,
          );
          this.modalRef.close(p);
        },
        error: (e: HttpErrorResponse) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo registrar',
            mensajeDeError(e, 'No se pudo registrar el mantenimiento.'),
          );
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
