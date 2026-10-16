import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { switchMap, type Observable } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { ArchivosService } from '../../services/archivos.service';
import { OrdenesTrabajoComercialService } from '../../services/ordenes-trabajo-comercial.service';
import { mensajeErrorArchivo } from '../../models/documentos-pedido';
import {
  MODULO_ARCHIVO_ORDEN,
  mensajeErrorOrden,
  validarFactura,
  type CiudadOt,
  type EstadoCierre,
  type OrdenTrabajo,
} from '../../models/orden-trabajo';

export type TipoAccionOrden = 'emitir' | 'firmada' | 'factura';

export interface OrdenTrabajoDialogData {
  tipo: TipoAccionOrden;
  pedidoId: string;
  /** Para `firmada`. */
  ordenId?: string;
  /** Para `emitir`: lo que ya se sabe del representante del cliente. */
  sugerencia?: { descripcion?: string };
}

/** Un diálogo para las tres acciones con datos: generar la OT, marcarla firmada (con archivo opcional) y registrar la factura. */
@Component({
  selector: 'app-orden-trabajo-dialog',
  imports: [DynadrillButtonComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="ot">
      @switch (data.tipo) {
        @case ('emitir') {
          <dynadrill-text variant="body">La orden de trabajo toma el detalle de la prefactura firmada. Su número es propio y no se reinicia; lleva el pozo, la ciudad y el año. El representante del cliente sale de quien firmó la prefactura, si no lo cambia aquí.</dynadrill-text>
          <dynadrill-select label="Ciudad del número" placeholder="Elija la ciudad" [options]="opcionesCiudades()" [value]="ciudadId()" (valueChange)="ciudadId.set($any($event))" />
          <dynadrill-input label="Descripción del requerimiento (opcional)" [value]="descripcion()" (valueChange)="descripcion.set($event)" />
          <dynadrill-input label="Representante del cliente (opcional)" [value]="repNombre()" (valueChange)="repNombre.set($event)" />
          <dynadrill-input label="Cargo del representante (opcional)" [value]="repCargo()" (valueChange)="repCargo.set($event)" />
        }
        @case ('firmada') {
          <dynadrill-text variant="body">La firma de la orden de trabajo es física: aquí solo queda registrado que ya se firmó. Si tiene el escaneo, puede subirlo (PDF, PNG o JPEG, máximo 25 MB).</dynadrill-text>
          <label class="ot__archivo">
            <span>Orden de trabajo firmada (opcional)</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" [disabled]="enviando()" (change)="onArchivo($event)" />
          </label>
        }
        @case ('factura') {
          <dynadrill-text variant="body">Escriba el número de la factura que se emitió en AS2. Con esto el pedido queda facturado y cerrado.</dynadrill-text>
          <dynadrill-input label="Número de factura" [value]="factura()" (valueChange)="factura.set($event)" />
        }
      }
      @if (error(); as e) {
        <p class="ot__error" role="alert">{{ e }}</p>
      }
    </div>
    <footer class="ot__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="enviando()" (clicked)="confirmar()">{{ enviando() ? 'Enviando…' : boton() }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .ot { display: flex; flex-direction: column; gap: 14px; }
    .ot__archivo { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted, #5c5870); }
    .ot__archivo input { font: inherit; color: var(--text, #2c2b35); }
    .ot__error { margin: 0; font-size: 13px; color: var(--error, #cf1322); }
    .ot__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
  `,
})
export class OrdenTrabajoDialog {
  private readonly servicio = inject(OrdenesTrabajoComercialService);
  private readonly archivos = inject(ArchivosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<OrdenTrabajoDialog, OrdenTrabajo | EstadoCierre | undefined>);
  protected readonly data = inject<OrdenTrabajoDialogData>(NZ_MODAL_DATA);

  protected readonly ciudades = signal<CiudadOt[]>([]);
  protected readonly ciudadId = signal<string | null>(null);
  protected readonly descripcion = signal(this.data.sugerencia?.descripcion ?? '');
  protected readonly repNombre = signal('');
  protected readonly repCargo = signal('');
  protected readonly archivo = signal<File | null>(null);
  protected readonly factura = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly opcionesCiudades = computed<DynadrillSelectOption[]>(() => this.ciudades().map(c => ({ label: `${c.codigo} — ${c.nombre}`, value: c.id })));
  protected readonly boton = computed(() => ({ emitir: 'Generar orden de trabajo', firmada: 'Marcar como firmada', factura: 'Registrar factura' })[this.data.tipo]);

  constructor() {
    if (this.data.tipo === 'emitir') {
      this.servicio.ciudades().subscribe({
        next: c => {
          this.ciudades.set(c);
          if (c.length === 1) this.ciudadId.set(c[0].id);
        },
        error: () => this.error.set('No se pudo cargar el catálogo de ciudades.'),
      });
    }
  }

  protected onArchivo(e: Event): void {
    this.archivo.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected confirmar(): void {
    if (this.enviando()) return;
    this.error.set(null);
    switch (this.data.tipo) {
      case 'emitir': {
        const opc = (v: string) => (v.trim() ? v.trim() : undefined);
        const nombre = opc(this.repNombre());
        const cargo = opc(this.repCargo());
        if (!!nombre !== !!cargo) return void this.error.set('Para cambiar el representante del cliente indique su nombre y su cargo.');
        this.enviar(
          this.servicio.emitir(this.data.pedidoId, {
            ...(this.ciudadId() ? { ciudadId: this.ciudadId() as string } : {}),
            ...(opc(this.descripcion()) ? { descripcionRequerimiento: opc(this.descripcion()) } : {}),
            ...(nombre && cargo ? { representanteClienteNombre: nombre, representanteClienteCargo: cargo } : {}),
          }),
          'Orden de trabajo generada',
        );
        return;
      }
      case 'firmada': {
        const a = this.archivo();
        if (!a) return void this.enviar(this.servicio.marcarFirmada(this.data.ordenId as string), 'Orden de trabajo marcada como firmada');
        this.enviando.set(true);
        let subido = false;
        this.archivos
          .subir(a, MODULO_ARCHIVO_ORDEN)
          .pipe(
            switchMap(s => {
              subido = true;
              return this.servicio.marcarFirmada(this.data.ordenId as string, s.id);
            }),
          )
          .subscribe({
            next: o => this.terminar(o, 'Orden de trabajo marcada como firmada'),
            error: err => {
              this.enviando.set(false);
              this.error.set(subido ? mensajeErrorOrden(err, 'El archivo se subió, pero no se pudo registrar.') : mensajeErrorArchivo(err));
            },
          });
        return;
      }
      case 'factura': {
        const problema = validarFactura(this.factura());
        if (problema) return void this.error.set(problema);
        this.enviar(this.servicio.facturado(this.data.pedidoId, this.factura()), 'Pedido facturado');
      }
    }
  }

  private enviar(obs: Observable<OrdenTrabajo | EstadoCierre>, titulo: string): void {
    this.enviando.set(true);
    obs.subscribe({
      next: r => this.terminar(r, titulo),
      error: err => {
        this.enviando.set(false);
        this.error.set(mensajeErrorOrden(err, 'No se pudo completar la acción. Intente de nuevo.'));
      },
    });
  }

  private terminar(r: OrdenTrabajo | EstadoCierre, titulo: string): void {
    this.notify.success(titulo);
    this.modalRef.close(r);
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
