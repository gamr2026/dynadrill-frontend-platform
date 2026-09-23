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
import { ListaPrecios } from '../models/lista-precios.model';
import { ListaPreciosService } from '../services/pedido.service';
import { CatalogosService, type ClienteCatalogo } from '../../../shared/index';

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
})
export class ListaPreciosCabeceraDialog {
  private readonly listaService = inject(ListaPreciosService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ListaPreciosCabeceraDialog, ListaPrecios | undefined>);
  protected readonly data = inject<ListaPreciosCabeceraDialogData>(NZ_MODAL_DATA);

  /**
   * Catálogo real de clientes — antes era texto libre, así que dos personas
   * podían escribir el mismo cliente real con dos strings distintos y la
   * prefactura del pedido de ese cliente no encontraba esta lista (bug $0
   * reportado). Mismo patrón que `nuevo-pedido-dialog.ts`.
   */
  private readonly clientesCatalogo = signal<ClienteCatalogo[]>([]);
  protected readonly clienteOptions = computed<DynadrillSelectOption[]>(() =>
    this.clientesCatalogo().map(c => ({ label: c.nombreComercial, value: c.nombreComercial })),
  );
  protected readonly clienteId = computed(
    () => this.clientesCatalogo().find(c => c.nombreComercial === this.cliente())?.id ?? null,
  );

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
      cliente: this.cliente().trim(),
      clienteId: this.clienteId() ?? undefined,
      numeroContrato: this.numeroContrato().trim(),
      vigenteDesde: this.vigenteDesde()!.toISOString().slice(0, 10),
      activa: this.activa(),
    };

    this.listaService.create({ ...payload, items: [] }).subscribe({
      next: lista => {
        this.notify.success('Lista creada', `${lista.cliente} — ${lista.numeroContrato}`);
        this.modalRef.close(lista);
      },
      error: () => {
        this.submitting.set(false);
        this.notify.error('Error', 'No se pudo guardar la lista de precios.');
      },
    });
  }
}
