import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillInputComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../pedidos-comercial/models/pedido-comercial.model';
import { TIPO_PERSONA_LABELS } from '../../../shared/models/catalogos.model';
import type {
  PersonaPlataforma,
  TipoPersonaPlataforma,
} from '../pedidos-comercial/models/catalogos-plataforma.model';
import { CatalogosPlataformaService } from '../pedidos-comercial/services/catalogos-plataforma.service';

export interface PersonaFormDialogData {
  persona?: PersonaPlataforma;
  /** Preselecciona el tipo al crear desde una sección ya filtrada. */
  tipoInicial?: TipoPersonaPlataforma;
}

/** Alta/edición de una persona del catálogo PersonaContacto — CRUD de Ventas (FACT-001). */
@Component({
  selector: 'app-persona-form-dialog',
  imports: [DynadrillSelectComponent, DynadrillInputComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './persona-form-dialog.html',
  styleUrl: './persona-form-dialog.scss',
  host: { class: 'app-dialog-sheet-mobile' },
})
export class PersonaFormDialog {
  private readonly catalogosService = inject(CatalogosPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<PersonaFormDialog, PersonaPlataforma | undefined>);
  private readonly data = inject<PersonaFormDialogData | null>(NZ_MODAL_DATA, { optional: true });

  protected readonly editando = computed(() => !!this.data?.persona);
  protected readonly tipo = signal<TipoPersonaPlataforma | null>(
    this.data?.persona?.tipo ?? this.data?.tipoInicial ?? null,
  );
  protected readonly nombre = signal(this.data?.persona?.nombre ?? '');
  protected readonly cedula = signal(this.data?.persona?.cedula ?? '');
  /** Solo el Company Man (representante de campo) lleva cédula: el cliente pide buscarlo por ella. */
  protected readonly pideCedula = computed(() => this.tipo() === 'representante_campo');
  protected readonly submitting = signal(false);

  protected readonly tipoOptions: DynadrillSelectOption[] = (
    Object.entries(TIPO_PERSONA_LABELS) as [TipoPersonaPlataforma, string][]
  ).map(([value, label]) => ({ label, value }));

  protected readonly puedeGuardar = computed(
    () => !!this.tipo() && this.nombre().trim().length > 0,
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);
    const nombre = this.nombre().trim();
    const cedula = this.pideCedula() ? this.cedula().trim() || undefined : undefined;
    const existente = this.data?.persona;

    const request = existente
      ? this.catalogosService.actualizarPersona(existente.id, { nombre, cedula })
      : this.catalogosService.crearPersona({ tipo: this.tipo()!, nombre, cedula });

    request.subscribe({
      next: (persona) => {
        this.notify.success(existente ? 'Actualizado' : 'Creado', `${nombre} guardado.`);
        this.modalRef.close(persona);
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo guardar.'));
      },
    });
  }
}
