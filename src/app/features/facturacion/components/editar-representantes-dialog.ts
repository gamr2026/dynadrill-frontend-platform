import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { Pedido } from '../models/pedido.model';
import { PedidoService } from '../services/pedido.service';
import { CatalogosService, type TipoPersonaContacto } from '../../../shared/index';

export interface EditarRepresentantesDialogData {
  pedido: Pedido;
}

/**
 * FACT #9 — permite corregir los representantes del pedido (agente
 * comercial / representante de campo / representante en Quito / analista de
 * facturación) directamente desde la prefactura, sin abrir el diálogo
 * completo de edición del pedido (que además expone Administrativos e
 * Ítems, fuera de alcance acá). Actualiza el Pedido vía PATCH parcial — el
 * resto de sus campos queda intacto (`PrismaCrudService.update` mergea
 * sobre el payload existente).
 */
@Component({
  selector: 'app-editar-representantes-dialog',
  imports: [DynadrillSelectComponent, DynadrillButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './editar-representantes-dialog.html',
  styleUrl: './editar-representantes-dialog.scss',
  host: { class: 'app-dialog-sheet-mobile' },
})
export class EditarRepresentantesDialog {
  private readonly pedidoService = inject(PedidoService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<EditarRepresentantesDialog, Pedido | undefined>);
  protected readonly data = inject<EditarRepresentantesDialogData>(NZ_MODAL_DATA);

  protected readonly agenteComercial = signal(this.data.pedido.agenteComercial ?? '');
  protected readonly representanteCampo = signal(this.data.pedido.representanteCampo ?? '');
  protected readonly representanteQuito = signal(this.data.pedido.representanteQuito ?? '');
  protected readonly analistaFacturacion = signal(this.data.pedido.analistaFacturacion ?? '');

  protected readonly agenteComercialOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly representanteCampoOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly representanteQuitoOptions = signal<DynadrillSelectOption[]>([]);
  protected readonly analistaFacturacionOptions = signal<DynadrillSelectOption[]>([]);

  protected readonly submitting = signal(false);
  protected readonly puedeGuardar = computed(
    () =>
      this.agenteComercial().trim().length > 0 &&
      this.representanteCampo().trim().length > 0 &&
      this.representanteQuito().trim().length > 0,
  );

  /** Mismo criterio que nuevo-pedido-dialog.ts: el label incluye la cédula cuando la persona la trae, para poder buscarla por cédula además de por nombre. */
  private cargarPersonas(tipo: TipoPersonaContacto, destino: typeof this.agenteComercialOptions): void {
    this.catalogosService
      .personas(tipo)
      .subscribe(personas => destino.set(personas.map(p => ({ label: p.cedula ? `${p.nombre} — ${p.cedula}` : p.nombre, value: p.nombre }))));
  }

  constructor() {
    this.cargarPersonas('agente_comercial', this.agenteComercialOptions);
    this.cargarPersonas('representante_campo', this.representanteCampoOptions);
    this.cargarPersonas('representante_quito', this.representanteQuitoOptions);
    this.cargarPersonas('analista_facturacion', this.analistaFacturacionOptions);
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);
    this.pedidoService
      .update(this.data.pedido.id, {
        agenteComercial: this.agenteComercial().trim(),
        representanteCampo: this.representanteCampo().trim(),
        representanteQuito: this.representanteQuito().trim(),
        analistaFacturacion: this.analistaFacturacion().trim() || undefined,
      })
      .subscribe({
        next: pedido => {
          this.notify.success('Representantes actualizados', `Se actualizó el pedido ${pedido.code}.`);
          this.modalRef.close(pedido);
        },
        error: () => {
          this.submitting.set(false);
          this.notify.error('Error', 'No se pudieron actualizar los representantes.');
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
