import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { CreateUnidadInput, Unidad, UnidadCategoriaPeso, UnidadTipo } from '../../maintenance/models/unidad.model';
import { UnidadesService } from '../../maintenance/services/unidades.service';

const TIPO_OPTIONS: DynadrillSelectOption[] = [
  { label: 'Servicio (control por horómetro)', value: 'Servicio' },
  { label: 'Auxiliar (control por tiempo, cada 6 meses)', value: 'Auxiliar' },
  { label: 'Transporte (control por kilometraje)', value: 'Transporte' },
];

const CATEGORIA_PESO_OPTIONS: DynadrillSelectOption[] = [
  { label: 'Pesado (camiones, cabezales)', value: 'Pesado' },
  { label: 'Liviano (camionetas)', value: 'Liviano' },
];

/**
 * Alta de una unidad nueva — no existía en ningún lado del sistema
 * (UnidadesService no tenía create()), así que tanto Mantenimiento como
 * Inventario dependían de que todas las unidades vinieran ya sembradas.
 * Vive en Inventario (igual que vehiculo-patrimonio-dialog) porque de acá
 * es de donde se pidió, pero captura también la línea base operativa
 * (horómetro/km de arranque) según el tipo elegido — sin eso,
 * calcularAlertas() en Mantenimiento no tendría de dónde partir y la
 * unidad nueva no generaría ninguna alerta preventiva hasta el primer
 * registrarMantenimiento().
 */
@Component({
  selector: 'app-unidad-create-dialog',
  imports: [DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextareaComponent, DynadrillCheckboxComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidad-create-dialog.html',
  styleUrl: './unidad-create-dialog.scss',
})
export class UnidadCreateDialog {
  private readonly unidadesService = inject(UnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<UnidadCreateDialog, Unidad | undefined>);

  protected readonly tipoOptions = TIPO_OPTIONS;
  protected readonly categoriaPesoOptions = CATEGORIA_PESO_OPTIONS;

  protected readonly code = signal('');
  protected readonly nombre = signal('');
  protected readonly tipo = signal<UnidadTipo | null>(null);
  protected readonly categoriaPeso = signal<UnidadCategoriaPeso | null>(null);

  // ── Línea base operativa, según el tipo elegido ──
  protected readonly horometroActual = signal('');
  protected readonly fechaUltimoMantenimiento = signal('');
  protected readonly kmActual = signal('');
  protected readonly kmUltimoMantenimiento = signal('');
  protected readonly fechaUltimoMantenimientoAux = signal('');
  protected readonly proveedorMantenimiento = signal('');

  // ── Datos patrimoniales (opcionales) ──
  protected readonly placa = signal('');
  protected readonly marca = signal('');
  protected readonly modelo = signal('');
  protected readonly anio = signal('');
  protected readonly responsablePatrimonial = signal('');
  protected readonly predeterminado = signal(false);
  protected readonly activo = signal(true);
  protected readonly notaInventario = signal('');

  protected readonly submitting = signal(false);

  protected readonly esServicio = computed(() => this.tipo() === 'Servicio');
  protected readonly esTransporte = computed(() => this.tipo() === 'Transporte');
  protected readonly esAuxiliar = computed(() => this.tipo() === 'Auxiliar');

  protected readonly canSave = computed(
    () => this.code().trim().length > 0 && this.nombre().trim().length > 0 && this.tipo() != null,
  );

  protected setTipo(value: string): void {
    this.tipo.set((value as UnidadTipo) || null);
  }

  protected setCategoriaPeso(value: string): void {
    this.categoriaPeso.set((value as UnidadCategoriaPeso) || null);
  }

  private numOrUndefined(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const value = Number(trimmed);
    return Number.isNaN(value) ? undefined : value;
  }

  /** Distingue "campo vacío" (válido, sin línea base) de "texto no numérico" (error del usuario) — sin esto, `numOrUndefined` descarta ambos en silencio y la unidad se crea sin poder generar alertas preventivas. */
  private camposNumericosInvalidos(tipo: UnidadTipo): string[] {
    const invalidos: string[] = [];
    const check = (raw: string, label: string) => {
      if (raw.trim() !== '' && this.numOrUndefined(raw) === undefined) invalidos.push(label);
    };
    if (tipo === 'Servicio') check(this.horometroActual(), 'Horómetro actual');
    if (tipo === 'Transporte') {
      check(this.kmActual(), 'Kilometraje actual');
      check(this.kmUltimoMantenimiento(), 'Kilometraje del último mantenimiento');
    }
    return invalidos;
  }

  protected save(): void {
    const tipo = this.tipo();
    if (!this.canSave() || !tipo || this.submitting()) return;

    const invalidos = this.camposNumericosInvalidos(tipo);
    if (invalidos.length > 0) {
      this.notify.error('Valor inválido', `Revisa el formato de: ${invalidos.join(', ')}.`);
      return;
    }

    this.submitting.set(true);
    const numOrUndefined = (raw: string) => this.numOrUndefined(raw);

    const input: CreateUnidadInput = {
      code: this.code().trim(),
      nombre: this.nombre().trim(),
      tipo,
      horometroActual: tipo === 'Servicio' ? numOrUndefined(this.horometroActual()) : undefined,
      fechaUltimoMantenimiento: tipo === 'Servicio' ? this.fechaUltimoMantenimiento().trim() || undefined : undefined,
      kmActual: tipo === 'Transporte' ? numOrUndefined(this.kmActual()) : undefined,
      kmUltimoMantenimiento: tipo === 'Transporte' ? numOrUndefined(this.kmUltimoMantenimiento()) : undefined,
      categoriaPeso: tipo === 'Transporte' ? this.categoriaPeso() ?? undefined : undefined,
      fechaUltimoMantenimientoAux: tipo === 'Auxiliar' ? this.fechaUltimoMantenimientoAux().trim() || undefined : undefined,
      proveedorMantenimiento: this.proveedorMantenimiento().trim() || undefined,
      placa: this.placa().trim() || undefined,
      marca: this.marca().trim() || undefined,
      modelo: this.modelo().trim() || undefined,
      anio: this.anio().trim() || undefined,
      responsablePatrimonial: this.responsablePatrimonial().trim() || undefined,
      predeterminado: this.predeterminado(),
      activo: this.activo(),
      notaInventario: this.notaInventario().trim() || undefined,
    };

    this.unidadesService.create(input).subscribe({
      next: unidad => {
        this.notify.success('Unidad creada', `${unidad.code} — ${unidad.nombre}`);
        this.modalRef.close(unidad);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo crear la unidad.');
      },
    });
  }

  protected cancel(): void {
    this.modalRef.close(undefined);
  }
}
