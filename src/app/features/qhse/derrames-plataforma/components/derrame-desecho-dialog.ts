import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import type { CatalogosDesechoDerrame, DerrameDetalle } from '../models/derrame';
import { DerrameService } from '../services/derrame.service';

export interface DerrameDesechoDialogData {
  derrameId: string;
}

interface LineaEditable {
  clave: number;
  descripcion: string;
  codigo: string;
  numeroLote: string;
  cantidadGalones: number;
  bultos: number;
}

/**
 * Genera el desecho peligroso de un derrame en suelo (HSE-AMBIENTAL-001/002). Quien lo genera elige la característica CRETIB, el contenedor y
 * las líneas de la guía: el sistema no supone cuáles son. Devuelve el derrame actualizado al cerrarse, o nada si se cancela.
 */
@Component({
  selector: 'app-derrame-desecho-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillChipGroupComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './derrame-desecho-dialog.html',
  styleUrl: './derrame-desecho-dialog.scss',
})
export class DerrameDesechoDialog {
  private readonly data = inject<DerrameDesechoDialogData>(NZ_MODAL_DATA);
  private readonly servicio = inject(DerrameService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<DerrameDesechoDialog, DerrameDetalle | undefined>);

  private readonly catalogos = signal<CatalogosDesechoDerrame>({
    caracteristicas: [],
    contenedores: [],
  });
  protected readonly cretibOpciones = computed(() =>
    this.catalogos().caracteristicas.map((c) => c.nombre),
  );
  protected readonly cretibElegidas = signal<string[]>([]);
  protected readonly contenedorId = signal('');
  protected readonly nota = signal('');
  protected readonly opcionesContenedor = computed<DynadrillSelectOption[]>(() =>
    this.catalogos().contenedores.map((c) => ({ value: c.id, label: `${c.nombre} — ${c.uso}` })),
  );

  protected readonly items = signal<LineaEditable[]>([]);
  private siguiente = 1;
  protected readonly itemDescripcion = signal('');
  protected readonly itemCodigo = signal('');
  protected readonly itemNumeroLote = signal('');
  protected readonly itemCantidadGalones = signal('');
  protected readonly itemBultos = signal('');
  protected readonly enviando = signal(false);

  protected readonly puedeAgregarItem = computed(
    () =>
      !!this.itemDescripcion().trim() &&
      !!this.itemCodigo().trim() &&
      Number(this.itemCantidadGalones()) > 0,
  );
  protected readonly puedeGuardar = computed(
    () => this.cretibElegidas().length > 0 && !!this.contenedorId() && this.items().length > 0,
  );

  constructor() {
    this.servicio.catalogosDeDesecho().subscribe({
      next: (c) => this.catalogos.set(c),
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
        clave: this.siguiente++,
        descripcion: this.itemDescripcion().trim(),
        codigo: this.itemCodigo().trim(),
        numeroLote: this.itemNumeroLote().trim(),
        cantidadGalones: Number(this.itemCantidadGalones()),
        bultos: Math.max(0, Math.trunc(Number(this.itemBultos()) || 0)),
      },
    ]);
    this.itemDescripcion.set('');
    this.itemCodigo.set('');
    this.itemNumeroLote.set('');
    this.itemCantidadGalones.set('');
    this.itemBultos.set('');
  }

  protected quitarItem(clave: number): void {
    this.items.update((lista) => lista.filter((i) => i.clave !== clave));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.enviando()) return;
    const porNombre = new Map(this.catalogos().caracteristicas.map((c) => [c.nombre, c.id]));
    const caracteristicaIds = this.cretibElegidas()
      .map((n) => porNombre.get(n))
      .filter((id): id is string => !!id);
    this.enviando.set(true);
    this.servicio
      .generarDesecho(this.data.derrameId, {
        contenedorId: this.contenedorId(),
        caracteristicaIds,
        items: this.items().map((i) => ({
          descripcion: i.descripcion,
          codigo: i.codigo,
          cantidadGalones: i.cantidadGalones,
          ...(i.numeroLote ? { numeroLote: i.numeroLote } : {}),
          bultos: i.bultos,
        })),
        ...(this.nota().trim() ? { nota: this.nota().trim() } : {}),
      })
      .subscribe({
        next: (d) => {
          this.notify.success(
            'Registrado',
            `Se generó el desecho peligroso ${d.desecho?.codigo ?? ''} a partir de este derrame.`,
          );
          this.modalRef.close(d);
        },
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo generar',
            mensajeDeError(err, 'No se pudo generar el desecho.'),
          );
        },
      });
  }
}
