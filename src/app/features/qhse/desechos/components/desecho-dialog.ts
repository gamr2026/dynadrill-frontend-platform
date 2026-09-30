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
  DesechoItem,
} from '../models/desecho.model';
import { DesechoService } from '../services/desecho.service';
import { CatalogosService } from '../../../../shared/index';

const CONTENEDOR_OPTIONS: DynadrillSelectOption[] = (Object.entries(CONTENEDOR_COLOR_LABELS) as [ContenedorColor, string][]).map(
  ([value, label]) => ({ label, value }),
);

/** "Personal Operativo: Genera y clasifica desechos en campo" (HSE-AMBIENTAL-001) — abre desde "Reportar", sin roleGuard de QHSE. */
@Component({
  selector: 'app-desecho-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
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
  private readonly catalogos = inject(CatalogosService);
  private readonly modalRef = inject(NzModalRef<DesechoDialog, Desecho | undefined>);

  constructor() {
    // Ubicaciones = pozos del catálogo. `agregarUbicacion` sigue permitiendo
    // cargar una ubicación que no sea un pozo (laydown, bodega, vía...).
    this.catalogos.pozos().subscribe(pozos =>
      this.ubicacionOptions.set(pozos.map(p => ({ label: p.nombreCompleto, value: p.nombreCompleto }))),
    );
  }

  protected readonly clasificacionOptions = ['Peligroso', 'No peligroso'];
  protected readonly clasificacionLabel = signal<string[]>(['No peligroso']);
  protected readonly cretibOptions = [...CRETIB_CARACTERISTICAS];
  protected readonly cretib = signal<string[]>([]);
  protected readonly contenedorOptions = CONTENEDOR_OPTIONS;
  protected readonly contenedorColor = signal<ContenedorColor>('gris');
  protected readonly descripcion = signal('');
  protected readonly ubicacionOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly ubicacion = signal('');
  protected readonly generadoPorNombre = signal(this.auth.currentUser()?.name ?? '');
  protected readonly submitting = signal(false);

  // ── Encabezado de la guía real (DYN-SGI-RE-063) ──
  protected readonly cliente = signal('');
  protected readonly clienteRuc = signal('');
  protected readonly solicitadoPor = signal('');
  protected readonly despachadoPor = signal('');
  protected readonly companiaTransportista = signal('');
  protected readonly conductorNombre = signal('');
  protected readonly cedulaConductor = signal('');
  protected readonly vehiculo = signal('');
  protected readonly placas = signal('');

  // ── Ítems (DESCRIPCIÓN / # DE LOTE / CÓDIGO / CANTIDAD EN GLNS / BULTOS) ──
  protected readonly items = signal<DesechoItem[]>([]);
  private nextItemId = 1;
  protected readonly itemDescripcion = signal('');
  protected readonly itemNumeroLote = signal('');
  protected readonly itemCodigo = signal('');
  protected readonly itemCantidadGalones = signal('');
  protected readonly itemBultos = signal('');

  protected readonly esPeligroso = computed(() => this.clasificacionLabel()[0] === 'Peligroso');

  protected readonly puedeAgregarItem = computed(
    () => this.itemDescripcion().trim().length > 0 && this.itemCodigo().trim().length > 0 && Number(this.itemCantidadGalones()) > 0,
  );

  protected agregarItem(): void {
    if (!this.puedeAgregarItem()) return;
    const item: DesechoItem = {
      id: this.nextItemId++,
      descripcion: this.itemDescripcion().trim(),
      numeroLote: this.itemNumeroLote().trim() || undefined,
      codigo: this.itemCodigo().trim(),
      cantidadGalones: Number(this.itemCantidadGalones()),
      bultos: Number(this.itemBultos()) || 0,
    };
    this.items.update(list => [...list, item]);
    this.itemDescripcion.set('');
    this.itemNumeroLote.set('');
    this.itemCodigo.set('');
    this.itemCantidadGalones.set('');
    this.itemBultos.set('');
  }

  protected quitarItem(id: number): void {
    this.items.update(list => list.filter(i => i.id !== id));
  }

  protected readonly puedeGuardar = computed(
    () => this.descripcion().trim().length > 0 && this.items().length > 0 && (!this.esPeligroso() || this.cretib().length > 0),
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
    const transportista =
      this.companiaTransportista() || this.conductorNombre() || this.cedulaConductor() || this.vehiculo() || this.placas()
        ? {
            companiaNombre: this.companiaTransportista().trim() || undefined,
            conductorNombre: this.conductorNombre().trim() || undefined,
            cedulaConductor: this.cedulaConductor().trim() || undefined,
            vehiculo: this.vehiculo().trim() || undefined,
            placas: this.placas().trim() || undefined,
          }
        : undefined;
    const input: CreateDesechoInput = {
      clasificacion,
      cretib: clasificacion === 'peligroso' ? (this.cretib() as CretibCaracteristica[]) : [],
      contenedorColor: this.contenedorColor(),
      descripcion: this.descripcion(),
      items: this.items(),
      ubicacion: this.ubicacion() || undefined,
      generadoPorNombre: this.generadoPorNombre(),
      cliente: this.cliente().trim() || undefined,
      clienteRuc: this.clienteRuc().trim() || undefined,
      solicitadoPor: this.solicitadoPor().trim() || undefined,
      despachadoPor: this.despachadoPor().trim() || undefined,
      transportista,
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
