import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { CatalogosPlataformaService } from '../../facturacion/pedidos-comercial/services/catalogos-plataforma.service';
import {
  CATEGORIA_PESO_LABEL,
  TIPO_UNIDAD_LABEL,
  type CategoriaPesoFlota,
  type ProveedorMantenimiento,
  type TipoUnidadFlota,
  type UnidadFlota,
} from '../models/unidad-flota.model';
import { FlotaUnidadesService } from '../services/flota-unidades.service';
import { aFechaIso, deFechaIso, mensajeDeError } from '../utils/flota.util';

export interface UnidadFormDialogData {
  /** Sin unidad: alta. Con unidad: edición (no cambia ni el código ni el tipo). */
  unidad?: UnidadFlota;
}

const TIPO_OPCIONES: DynadrillSelectOption[] = [
  { label: 'Servicio (control por horómetro)', value: 'servicio' },
  { label: 'Auxiliar (control por tiempo, cada 6 meses)', value: 'auxiliar' },
  { label: 'Transporte (control por kilometraje)', value: 'transporte' },
];

const CATEGORIA_OPCIONES: DynadrillSelectOption[] = [
  { label: `${CATEGORIA_PESO_LABEL.pesado} (camiones, cabezales)`, value: 'pesado' },
  { label: `${CATEGORIA_PESO_LABEL.liviano} (camionetas)`, value: 'liviano' },
];

const SIN_VALOR = '__ninguno__';

/** Alta y edición de una unidad de Flota. Los datos de matrícula (placa, marca, modelo, año) vienen del vehículo del catálogo. */
@Component({
  selector: 'app-unidad-form-dialog',
  /** Pantalla completa en móvil (formulario largo) — ver styles.scss. */
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillCheckboxComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidad-form-dialog.html',
  styleUrl: './unidad-form-dialog.scss',
})
export class UnidadFormDialog {
  private readonly flota = inject(FlotaUnidadesService);
  private readonly catalogos = inject(CatalogosPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<UnidadFormDialog, UnidadFlota | undefined>);
  private readonly data = inject<UnidadFormDialogData>(NZ_MODAL_DATA);

  protected readonly unidad = this.data.unidad;
  protected readonly editando = !!this.unidad;
  protected readonly tipoOpciones = TIPO_OPCIONES;
  protected readonly categoriaOpciones = CATEGORIA_OPCIONES;
  protected readonly tipoTexto = this.unidad ? TIPO_UNIDAD_LABEL[this.unidad.tipo] : '';

  protected readonly codigo = signal(this.unidad?.codigo ?? '');
  protected readonly nombre = signal(this.unidad?.nombre ?? '');
  protected readonly tipo = signal<TipoUnidadFlota | null>(this.unidad?.tipo ?? null);
  protected readonly categoriaPeso = signal<CategoriaPesoFlota | null>(
    this.unidad?.categoriaPeso ?? null,
  );
  protected readonly lecturaInicial = signal('');
  protected readonly vehiculoId = signal<string>(this.unidad?.vehiculo?.id ?? SIN_VALOR);
  protected readonly proveedorId = signal<string>(
    this.unidad?.proveedorMantenimiento?.id ?? SIN_VALOR,
  );
  protected readonly fechaMatricula = signal<Date | null>(
    deFechaIso(this.unidad?.documentos.fechaMatricula),
  );
  protected readonly caducidadMatricula = signal<Date | null>(
    deFechaIso(this.unidad?.documentos.caducidadMatricula),
  );
  protected readonly caducidadPoliza = signal<Date | null>(
    deFechaIso(this.unidad?.documentos.caducidadPoliza),
  );
  protected readonly vigenciaOtroDocumento = signal<Date | null>(
    deFechaIso(this.unidad?.documentos.vigenciaOtroDocumento),
  );
  protected readonly predeterminada = signal(this.unidad?.predeterminada ?? false);
  protected readonly nota = signal(this.unidad?.nota ?? '');
  protected readonly enviando = signal(false);

  protected readonly vehiculoOpciones = signal<DynadrillSelectOption[]>([
    { label: 'Sin vehículo del catálogo', value: SIN_VALOR },
  ]);
  protected readonly proveedorOpciones = signal<DynadrillSelectOption[]>([
    { label: 'Interno (Dynadrill)', value: SIN_VALOR },
  ]);

  protected readonly esServicio = computed(() => this.tipo() === 'servicio');
  protected readonly esTransporte = computed(() => this.tipo() === 'transporte');
  protected readonly lecturaEtiqueta = computed(() =>
    this.esServicio() ? 'Horómetro actual (h)' : 'Kilometraje actual (km)',
  );
  protected readonly puedeGuardar = computed(
    () =>
      this.codigo().trim().length >= 2 &&
      this.nombre().trim().length >= 2 &&
      this.tipo() !== null &&
      !this.enviando(),
  );

  constructor() {
    this.catalogos.vehiculos().subscribe({
      next: (vs) => {
        const propio = this.unidad?.vehiculo;
        const base = [{ label: 'Sin vehículo del catálogo', value: SIN_VALOR }];
        const opciones = vs
          .filter((v) => v.habilitado || v.id === propio?.id)
          .map((v) => ({
            label: [v.placa, v.marca, v.modelo].filter(Boolean).join(' · '),
            value: v.id,
          }));
        this.vehiculoOpciones.set([...base, ...opciones]);
      },
      error: () => this.notify.error('Error', 'No se pudo cargar el catálogo de vehículos.'),
    });
    this.flota.proveedores().subscribe({
      next: (ps) =>
        this.proveedorOpciones.set([
          { label: 'Interno (Dynadrill)', value: SIN_VALOR },
          ...ps.map((p: ProveedorMantenimiento) => ({ label: p.nombre, value: p.id })),
        ]),
      error: () =>
        this.notify.error('Error', 'No se pudo cargar los proveedores de mantenimiento.'),
    });
  }

  protected setTipo(valor: string): void {
    this.tipo.set((valor as TipoUnidadFlota) || null);
    if (valor !== 'transporte') this.categoriaPeso.set(null);
  }

  protected guardar(): void {
    const tipo = this.tipo();
    if (!this.puedeGuardar() || !tipo) return;
    const lectura = this.lecturaInicial().trim();
    if (!this.editando && lectura !== '' && Number.isNaN(Number(lectura))) {
      this.notify.error('Valor inválido', 'Revise el formato de la lectura inicial.');
      return;
    }
    this.enviando.set(true);
    const comun = {
      nombre: this.nombre().trim(),
      categoriaPeso: tipo === 'transporte' ? this.categoriaPeso() : null,
      vehiculoId: this.vehiculoId() === SIN_VALOR ? null : this.vehiculoId(),
      proveedorMantenimientoId: this.proveedorId() === SIN_VALOR ? null : this.proveedorId(),
      fechaMatricula: aFechaIso(this.fechaMatricula()),
      caducidadMatricula: aFechaIso(this.caducidadMatricula()),
      caducidadPoliza: aFechaIso(this.caducidadPoliza()),
      vigenciaOtroDocumento: aFechaIso(this.vigenciaOtroDocumento()),
      predeterminada: this.predeterminada(),
      nota: this.nota().trim() || null,
    };
    const peticion = this.unidad
      ? this.flota.actualizar(this.unidad.id, comun)
      : this.flota.crear({
          ...comun,
          codigo: this.codigo().trim(),
          tipo,
          lecturaInicial: tipo !== 'auxiliar' && lectura !== '' ? Number(lectura) : null,
        });
    peticion.subscribe({
      next: (u) => {
        this.notify.success(
          this.unidad ? 'Unidad actualizada' : 'Unidad creada',
          `${u.codigo} guardada.`,
        );
        this.modalRef.close(u);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.notify.error('No se pudo guardar', mensajeDeError(e, 'No se pudo guardar la unidad.'));
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
