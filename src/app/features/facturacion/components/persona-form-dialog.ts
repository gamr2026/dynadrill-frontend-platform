import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillInputComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { CatalogosService } from '../../../shared/services/catalogos.service';
import { PersonaContacto, TIPO_PERSONA_LABELS, TipoPersonaContacto } from '../../../shared/models/catalogos.model';

export interface PersonaFormDialogData {
  persona?: PersonaContacto;
  /** Preselecciona el tipo al crear desde una sección ya filtrada. */
  tipoInicial?: TipoPersonaContacto;
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
  private readonly catalogosService = inject(CatalogosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<PersonaFormDialog, PersonaContacto | undefined>);
  private readonly data = inject<PersonaFormDialogData | null>(NZ_MODAL_DATA, { optional: true });

  protected readonly editando = computed(() => !!this.data?.persona);
  protected readonly tipo = signal<TipoPersonaContacto | null>(this.data?.persona?.tipo ?? this.data?.tipoInicial ?? null);
  protected readonly nombre = signal(this.data?.persona?.nombre ?? '');
  protected readonly submitting = signal(false);

  protected readonly tipoOptions: DynadrillSelectOption[] = (Object.entries(TIPO_PERSONA_LABELS) as [TipoPersonaContacto, string][]).map(
    ([value, label]) => ({ label, value }),
  );

  protected readonly puedeGuardar = computed(() => !!this.tipo() && this.nombre().trim().length > 0);

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);
    const nombre = this.nombre().trim();
    const existente = this.data?.persona;

    const request = existente
      ? this.catalogosService.actualizarPersona(existente.id, { nombre })
      : this.catalogosService.crearPersona({ tipo: this.tipo()!, nombre });

    request.subscribe({
      next: persona => {
        this.notify.success(existente ? 'Actualizado' : 'Creado', `${nombre} guardado.`);
        this.modalRef.close(persona);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar.');
      },
    });
  }
}
