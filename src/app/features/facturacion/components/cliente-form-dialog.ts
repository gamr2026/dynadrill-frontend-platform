import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillButtonComponent, DynadrillNotificationService, DynadrillInputComponent } from '@digitec-it-projects/dynadrill-ui';
import { CatalogosService } from '../../../shared/services/catalogos.service';
import { ClienteCatalogo } from '../../../shared/models/catalogos.model';

export interface ClienteFormDialogData {
  cliente?: ClienteCatalogo;
}

/** Alta/edición de un cliente del catálogo ClienteCatalogo — CRUD de Ventas (FACT-001). */
@Component({
  selector: 'app-cliente-form-dialog',
  imports: [DynadrillInputComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cliente-form-dialog.html',
  styleUrl: './cliente-form-dialog.scss',
})
export class ClienteFormDialog {
  private readonly catalogosService = inject(CatalogosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ClienteFormDialog, ClienteCatalogo | undefined>);
  private readonly data = inject<ClienteFormDialogData | null>(NZ_MODAL_DATA, { optional: true });

  protected readonly editando = computed(() => !!this.data?.cliente);
  protected readonly tipoIdentificacion = signal(this.data?.cliente?.tipoIdentificacion ?? 'Ruc');
  protected readonly identificacion = signal(this.data?.cliente?.identificacion ?? '');
  protected readonly nombreComercial = signal(this.data?.cliente?.nombreComercial ?? '');
  protected readonly nombreFiscal = signal(this.data?.cliente?.nombreFiscal ?? '');
  protected readonly submitting = signal(false);

  protected readonly puedeGuardar = computed(
    () => this.tipoIdentificacion().trim().length > 0 && this.identificacion().trim().length > 0 && this.nombreComercial().trim().length > 0,
  );

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);
    const existente = this.data?.cliente;
    const payload = {
      tipoIdentificacion: this.tipoIdentificacion().trim(),
      identificacion: this.identificacion().trim(),
      nombreComercial: this.nombreComercial().trim(),
      nombreFiscal: this.nombreFiscal().trim() || undefined,
    };

    const request = existente
      ? this.catalogosService.actualizarCliente(existente.id, payload)
      : this.catalogosService.crearCliente(payload);

    request.subscribe({
      next: cliente => {
        this.notify.success(existente ? 'Actualizado' : 'Creado', `${payload.nombreComercial} guardado.`);
        this.modalRef.close(cliente);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar.');
      },
    });
  }
}
