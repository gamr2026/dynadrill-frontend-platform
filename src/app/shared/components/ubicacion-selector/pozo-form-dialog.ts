import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { firstValueFrom } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { CatalogosService } from '../../services/catalogos.service';
import type { Bloque, Campo } from '../../models/catalogos.model';

export interface PozoFormDialogData {
  /** Texto que se tipeó en el select ("+ Agregar"): se usa como código del pozo. */
  codigoInicial: string;
  campos: Campo[];
  bloques: Bloque[];
}

/**
 * Alta rápida de un pozo que no existe en el catálogo. Campo y Bloque se eligen de la lista o se agregan al vuelo
 * (se guardan en la base junto con el pozo); la Zona viene del Campo — solo se escribe cuando el Campo es nuevo.
 * Cierra con el id del pozo creado.
 */
@Component({
  selector: 'app-pozo-form-dialog',
  imports: [DynadrillSelectComponent, DynadrillInputComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="pozo-form">
      <dynadrill-input label="Código del pozo *" [value]="codigo()" (valueChange)="codigo.set($event)" />
      <dynadrill-input label="Nombre completo" placeholder="Por defecto, el código" [value]="nombreCompleto()" (valueChange)="nombreCompleto.set($event)" />
      <dynadrill-select
        label="Campo *"
        placeholder="Selecciona o agrega un campo"
        [options]="campos()"
        [value]="campo()"
        [searchable]="true"
        [creatable]="true"
        (valueChange)="campo.set($any($event))"
        (itemCreated)="agregarCampo($event)"
      />
      <dynadrill-input
        label="Zona"
        [placeholder]="campoNuevo() ? 'Ej. ZONA NORTE (opcional)' : ''"
        [value]="zona()"
        [disabled]="!campoNuevo()"
        (valueChange)="zonaNueva.set($event)"
      />
      <dynadrill-select
        label="Bloque *"
        placeholder="Selecciona o agrega un bloque"
        [options]="bloques()"
        [value]="bloque()"
        [searchable]="true"
        [creatable]="true"
        (valueChange)="bloque.set($any($event))"
        (itemCreated)="agregarBloque($event)"
      />
      <div class="pozo-form__actions">
        <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
        <dynadrill-button [disabled]="!puedeGuardar() || submitting()" (clicked)="guardar()">
          {{ submitting() ? 'Guardando…' : 'Guardar pozo' }}
        </dynadrill-button>
      </div>
    </div>
  `,
  styles: [
    `
      .pozo-form {
        display: grid;
        gap: 12px;
      }
      .pozo-form__actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 8px;
      }
    `,
  ],
})
export class PozoFormDialog {
  private readonly catalogos = inject(CatalogosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<PozoFormDialog, number | undefined>);
  private readonly data = inject<PozoFormDialogData>(NZ_MODAL_DATA);

  protected readonly codigo = signal(this.data.codigoInicial.trim().toUpperCase());
  protected readonly nombreCompleto = signal('');
  /** id (existente) o texto (nuevo) */
  protected readonly campo = signal<number | string | null>(null);
  protected readonly bloque = signal<number | string | null>(null);
  protected readonly zonaNueva = signal('');
  protected readonly submitting = signal(false);

  protected readonly campos = signal<DynadrillSelectOption[]>(this.data.campos.map(c => ({ label: c.nombre, value: c.id })));
  protected readonly bloques = signal<DynadrillSelectOption[]>(this.data.bloques.map(b => ({ label: b.nombre, value: b.id })));

  protected readonly campoNuevo = computed(() => typeof this.campo() === 'string');
  protected readonly zona = computed(() => (this.campoNuevo() ? this.zonaNueva() : (this.data.campos.find(c => c.id === this.campo())?.zona ?? '')));
  protected readonly puedeGuardar = computed(() => this.codigo().trim().length > 0 && this.campo() !== null && this.bloque() !== null);

  protected agregarCampo(texto: string): void {
    const nombre = texto.trim().toUpperCase();
    if (!nombre) return;
    const existente = this.data.campos.find(c => c.nombre.toUpperCase() === nombre);
    if (existente) {
      this.campo.set(existente.id);
      return;
    }
    if (!this.campos().some(o => o.value === nombre)) this.campos.update(o => [...o, { label: `${nombre} (nuevo)`, value: nombre }]);
    this.campo.set(nombre);
  }

  protected agregarBloque(texto: string): void {
    const nombre = texto.trim().toUpperCase();
    if (!nombre) return;
    const existente = this.data.bloques.find(b => b.nombre.toUpperCase() === nombre);
    if (existente) {
      this.bloque.set(existente.id);
      return;
    }
    if (!this.bloques().some(o => o.value === nombre)) this.bloques.update(o => [...o, { label: `${nombre} (nuevo)`, value: nombre }]);
    this.bloque.set(nombre);
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected async guardar(): Promise<void> {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);
    try {
      const codigo = this.codigo().trim().toUpperCase();
      let campoId = this.campo();
      if (typeof campoId === 'string') {
        const zona = this.zonaNueva().trim().toUpperCase();
        campoId = (await firstValueFrom(this.catalogos.crearCampo({ nombre: campoId, ...(zona ? { zona } : {}) }))).id;
      }
      let bloqueId = this.bloque();
      if (typeof bloqueId === 'string') bloqueId = (await firstValueFrom(this.catalogos.crearBloque({ nombre: bloqueId }))).id;
      const pozo = await firstValueFrom(
        this.catalogos.crearPozo({
          codigo,
          nombreCompleto: this.nombreCompleto().trim() || codigo,
          campoId: campoId as number,
          bloqueId: bloqueId as number,
        }),
      );
      this.notify.success('Pozo creado', `${codigo} guardado en el catálogo.`);
      this.modalRef.close(pozo.id);
    } catch {
      this.submitting.set(false);
      this.notify.error('Error', 'No se pudo guardar el pozo. Revisa que el código no exista ya.');
    }
  }
}
