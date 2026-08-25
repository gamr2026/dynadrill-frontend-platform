import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import {
  CONTENEDOR_COLOR_LABELS,
  CRETIB_CARACTERISTICAS,
  ClasificacionDesecho,
  ContenedorColor,
  CreateDesechoInput,
  CretibCaracteristica,
  Desecho,
} from '../models/desecho.model';
import { DesechoService } from '../services/desecho.service';

const CONTENEDOR_OPTIONS: DynadrillSelectOption[] = (Object.entries(CONTENEDOR_COLOR_LABELS) as [ContenedorColor, string][]).map(
  ([value, label]) => ({ label, value }),
);

/** Ubicaciones ya usadas en el resto de QHSE (IPERC/PTW/Inspecciones/STOP) — precargadas para no repetir texto libre a mano; el modo creatable permite agregar una nueva si no está en la lista. */
const UBICACIONES_BASE = ['Pozo Alfa-3', 'Pozo Beta-9', 'Pozo Delta-7'];

/** "Personal Operativo: Genera y clasifica desechos en campo" (HSE-AMBIENTAL-001) — abre desde "Reportar", sin roleGuard de QHSE. */
@Component({
  selector: 'app-desecho-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillChipGroupComponent,
    DynadrillSelectComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './desecho-dialog.html',
  styleUrl: './desecho-dialog.scss',
})
export class DesechoDialog {
  private readonly desechoService = inject(DesechoService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<DesechoDialog, Desecho | undefined>);

  protected readonly clasificacionOptions = ['Peligroso', 'No peligroso'];
  protected readonly clasificacionLabel = signal<string[]>(['No peligroso']);
  protected readonly cretibOptions = [...CRETIB_CARACTERISTICAS];
  protected readonly cretib = signal<string[]>([]);
  protected readonly contenedorOptions = CONTENEDOR_OPTIONS;
  protected readonly contenedorColor = signal<ContenedorColor>('gris');
  protected readonly descripcion = signal('');
  protected readonly pesoKg = signal('');
  protected readonly ubicacionOptions = signal<DynadrillSelectOption[]>(UBICACIONES_BASE.map(v => ({ label: v, value: v })));
  protected readonly ubicacion = signal('');
  protected readonly generadoPorNombre = signal(this.auth.currentUser()?.name ?? '');
  protected readonly submitting = signal(false);

  protected readonly esPeligroso = computed(() => this.clasificacionLabel()[0] === 'Peligroso');

  protected readonly puedeGuardar = computed(
    () => this.descripcion().trim().length > 0 && Number(this.pesoKg()) > 0 && (!this.esPeligroso() || this.cretib().length > 0),
  );

  protected agregarUbicacion(nombre: string): void {
    const value = nombre.trim();
    if (!value) return;
    if (!this.ubicacionOptions().some(o => o.value === value)) {
      this.ubicacionOptions.update(opts => [...opts, { label: value, value }]);
    }
    this.ubicacion.set(value);
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const clasificacion: ClasificacionDesecho = this.esPeligroso() ? 'peligroso' : 'no_peligroso';
    const input: CreateDesechoInput = {
      clasificacion,
      cretib: clasificacion === 'peligroso' ? (this.cretib() as CretibCaracteristica[]) : [],
      contenedorColor: this.contenedorColor(),
      descripcion: this.descripcion(),
      pesoKg: Number(this.pesoKg()),
      ubicacion: this.ubicacion() || undefined,
      generadoPorNombre: this.generadoPorNombre(),
    };

    this.desechoService.create(input).subscribe({
      next: desecho => {
        this.notify.success('Registrado', `Desecho ${desecho.code} registrado.`);
        this.modalRef.close(desecho);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo registrar el desecho.');
      },
    });
  }
}
