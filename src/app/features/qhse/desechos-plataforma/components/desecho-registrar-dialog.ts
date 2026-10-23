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
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import {
  CLASIFICACION_ETIQUETA,
  etiquetaContenedor,
  type CatalogosDesecho,
  type ClasificacionDesecho,
} from '../models/desecho';
import { DesechoService } from '../services/desecho.service';

/** Una línea de la guía mientras se arma el formulario (columnas del formato DYN-SGI-RE-063). */
interface LineaBorrador {
  id: number;
  descripcion: string;
  numeroLote: string;
  codigo: string;
  cantidadGalones: number;
  bultos: number;
}

/** El valor de la ubicación escrita a mano (no es un pozo del catálogo). */
const PREFIJO_TEXTO = 'texto:';

/**
 * «Personal operativo: genera y clasifica desechos en campo» (HSE-AMBIENTAL-001). Lo puede abrir cualquier trabajador (también desde
 * «Reportar»). El transportista, las horas y el cliente de la guía ya no se piden aquí: se capturan al generar el manifiesto.
 */
@Component({
  selector: 'app-desecho-registrar-dialog',
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
  templateUrl: './desecho-registrar-dialog.html',
  styleUrl: './desecho-registrar-dialog.scss',
})
export class DesechoRegistrarDialog {
  private readonly servicio = inject(DesechoService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(
    NzModalRef<DesechoRegistrarDialog, { id: string } | undefined>,
  );

  protected readonly catalogos = signal<CatalogosDesecho | null>(null);

  protected readonly clasificacionOptions = [
    CLASIFICACION_ETIQUETA.peligroso,
    CLASIFICACION_ETIQUETA.no_peligroso,
  ];
  protected readonly clasificacionLabel = signal<string[]>([CLASIFICACION_ETIQUETA.no_peligroso]);
  protected readonly cretib = signal<string[]>([]);
  protected readonly contenedorId = signal('');
  protected readonly descripcion = signal('');
  /** Un pozo del catálogo (su id) o una ubicación escrita a mano (con el prefijo `texto:`). */
  protected readonly ubicacion = signal('');
  private readonly ubicacionesPropias = signal<string[]>([]);
  protected readonly generadoPorNombre = this.auth.currentUser()?.name ?? '';
  protected readonly submitting = signal(false);

  protected readonly items = signal<LineaBorrador[]>([]);
  private siguienteId = 1;
  protected readonly itemDescripcion = signal('');
  protected readonly itemNumeroLote = signal('');
  protected readonly itemCodigo = signal('');
  protected readonly itemCantidadGalones = signal('');
  protected readonly itemBultos = signal('');

  protected readonly cretibOptions = computed(
    () => this.catalogos()?.caracteristicas.map((c) => c.nombre) ?? [],
  );
  protected readonly contenedorOptions = computed<DynadrillSelectOption[]>(() =>
    (this.catalogos()?.contenedores ?? []).map((c) => ({
      value: c.id,
      label: etiquetaContenedor(c),
    })),
  );
  protected readonly ubicacionOptions = computed<DynadrillSelectOption[]>(() => [
    ...(this.catalogos()?.pozos ?? []).map((p) => ({ value: p.id, label: p.nombreCompleto })),
    ...this.ubicacionesPropias().map((t) => ({ value: PREFIJO_TEXTO + t, label: t })),
  ]);

  protected readonly esPeligroso = computed(
    () => this.clasificacionLabel()[0] === CLASIFICACION_ETIQUETA.peligroso,
  );

  protected readonly puedeAgregarItem = computed(
    () =>
      this.itemDescripcion().trim().length > 0 &&
      this.itemCodigo().trim().length > 0 &&
      Number(this.itemCantidadGalones()) > 0,
  );

  protected readonly puedeGuardar = computed(
    () =>
      this.contenedorId() !== '' &&
      this.descripcion().trim().length > 0 &&
      this.items().length > 0 &&
      (!this.esPeligroso() || this.cretib().length > 0),
  );

  constructor() {
    this.servicio.catalogos().subscribe({
      next: (c) => {
        this.catalogos.set(c);
        // como en la demo, el contenedor gris (no peligroso / común) viene elegido
        const gris = c.contenedores.find((x) => x.codigo === 'gris') ?? c.contenedores[0];
        if (gris && !this.contenedorId()) this.contenedorId.set(gris.id);
      },
      error: (err) =>
        this.notify.error(
          'Error',
          mensajeDeError(err, 'No se pudieron cargar los catálogos de desechos.'),
        ),
    });
  }

  protected agregarItem(): void {
    if (!this.puedeAgregarItem()) return;
    this.items.update((lista) => [
      ...lista,
      {
        id: this.siguienteId++,
        descripcion: this.itemDescripcion().trim(),
        numeroLote: this.itemNumeroLote().trim(),
        codigo: this.itemCodigo().trim(),
        cantidadGalones: Number(this.itemCantidadGalones()),
        bultos: Math.max(0, Math.trunc(Number(this.itemBultos()) || 0)),
      },
    ]);
    this.itemDescripcion.set('');
    this.itemNumeroLote.set('');
    this.itemCodigo.set('');
    this.itemCantidadGalones.set('');
    this.itemBultos.set('');
  }

  protected quitarItem(id: number): void {
    this.items.update((lista) => lista.filter((i) => i.id !== id));
  }

  protected agregarUbicacion(nombre: string): void {
    const valor = nombre.trim();
    if (!valor) return;
    if (!this.ubicacionesPropias().includes(valor))
      this.ubicacionesPropias.update((l) => [...l, valor]);
    this.ubicacion.set(PREFIJO_TEXTO + valor);
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);
    const clasificacion: ClasificacionDesecho = this.esPeligroso() ? 'peligroso' : 'no_peligroso';
    const cat = this.catalogos();
    const caracteristicaIds =
      clasificacion === 'peligroso'
        ? (cat?.caracteristicas ?? [])
            .filter((c) => this.cretib().includes(c.nombre))
            .map((c) => c.id)
        : [];
    const ubicacion = this.ubicacion();
    this.servicio
      .registrar({
        clasificacion,
        contenedorId: this.contenedorId(),
        ...(caracteristicaIds.length ? { caracteristicaIds } : {}),
        descripcion: this.descripcion().trim(),
        ...(ubicacion.startsWith(PREFIJO_TEXTO)
          ? { ubicacion: ubicacion.slice(PREFIJO_TEXTO.length) }
          : ubicacion
            ? { pozoId: ubicacion }
            : {}),
        items: this.items().map((i) => ({
          descripcion: i.descripcion,
          codigo: i.codigo,
          cantidadGalones: i.cantidadGalones,
          bultos: i.bultos,
          ...(i.numeroLote ? { numeroLote: i.numeroLote } : {}),
        })),
      })
      .subscribe({
        next: (r) => {
          this.notify.success('Registrado', `Desecho ${r.codigo} registrado.`);
          this.modalRef.close(r);
        },
        error: (err) => {
          this.submitting.set(false);
          this.notify.error(
            'No se pudo registrar',
            mensajeDeError(err, 'No se pudo registrar el desecho.'),
          );
        },
      });
  }
}
