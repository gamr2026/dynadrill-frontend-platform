import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError, type ListaPreciosResumen } from '../pedidos-comercial/models/pedido-comercial.model';
import type { ClientePlataforma } from '../pedidos-comercial/models/catalogos-plataforma.model';
import { CatalogosPlataformaService } from '../pedidos-comercial/services/catalogos-plataforma.service';
import { ListasPreciosComercialService } from '../pedidos-comercial/services/listas-precios-comercial.service';

export interface ListaPreciosCabeceraDialogData {}

/** Fase 2 — alta de una Lista de Precios (cliente/contrato). La edición se retiró de la UI (RN: solo se actualiza vía import real de datos). */
@Component({
  selector: 'app-lista-precios-cabecera-dialog',
  imports: [
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-precios-cabecera-dialog.html',
  styleUrl: './lista-precios-cabecera-dialog.scss',
  host: { class: 'app-dialog-sheet-mobile' },
})
export class ListaPreciosCabeceraDialog {
  private readonly listaService = inject(ListasPreciosComercialService);
  private readonly catalogosService = inject(CatalogosPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ListaPreciosCabeceraDialog, ListaPreciosResumen | undefined>);
  protected readonly data = inject<ListaPreciosCabeceraDialogData>(NZ_MODAL_DATA);

  /**
   * Catálogo real de clientes — antes era texto libre, así que dos personas
   * podían escribir el mismo cliente real con dos strings distintos y la
   * prefactura del pedido de ese cliente no encontraba esta lista (bug $0
   * reportado). Mismo patrón que `nuevo-pedido-dialog.ts`.
   */
  private readonly clientesCatalogo = signal<ClientePlataforma[]>([]);
  protected readonly clienteOptions = computed<DynadrillSelectOption[]>(() =>
    this.clientesCatalogo().map(c => ({ label: c.nombreComercial, value: c.id })),
  );

  /** Id del cliente elegido en el catálogo. */
  protected readonly cliente = signal('');
  protected readonly numeroContrato = signal('');
  protected readonly vigenteDesde = signal<Date | null>(new Date());
  protected readonly activa = signal(true);
  protected readonly submitting = signal(false);

  protected readonly activaOptions: DynadrillSelectOption[] = [
    { label: 'Activa', value: 'si' },
    { label: 'Inactiva', value: 'no' },
  ];

  protected readonly puedeGuardar = computed(
    () => this.cliente().trim().length > 0 && this.numeroContrato().trim().length > 0 && this.vigenteDesde() !== null,
  );

  constructor() {
    this.catalogosService.clientes().subscribe(clientes => this.clientesCatalogo.set(clientes));
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    this.submitting.set(true);

    const payload = {
      clienteId: this.cliente(),
      numeroContrato: this.numeroContrato().trim(),
      vigenteDesde: this.vigenteDesde()!.toISOString().slice(0, 10),
      activa: this.activa(),
    };

    this.listaService.crear(payload).subscribe({
      next: lista => {
        this.notify.success('Lista creada', `${lista.clienteNombre} — ${lista.numeroContrato}`);
        this.modalRef.close(lista);
      },
      error: err => {
        this.submitting.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo guardar la lista de precios.'));
      },
    });
  }
}
