import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import type { CatalogosIperc, MatrizDetalle, TipoCatalogo } from '../models/iperc';
import { IpercMaestraService } from '../services/iperc-maestra.service';

/** Agrega una actividad a la matriz maestra (con su primera versión en borrador). Un proceso o una zona nueva se escribe en el selector. */
@Component({
  selector: 'app-iperc-actividad-nueva-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="an">
      <dynadrill-text variant="body"
        >La actividad se agrega a la matriz maestra. Después se describen sus tareas, peligros y
        controles, y la aprueba el Gerente HSE.</dynadrill-text
      >
      <dynadrill-input label="Actividad" [value]="nombre()" (valueChange)="nombre.set($event)" />
      <dynadrill-select
        label="Proceso"
        placeholder="Elija o escriba un proceso"
        [options]="opcionesProceso()"
        [value]="procesoId()"
        [searchable]="true"
        [creatable]="true"
        (valueChange)="procesoId.set($any($event) ?? '')"
        (itemCreated)="crear('proceso', $event)"
      />
      <dynadrill-select
        label="Zona / lugar"
        placeholder="Elija o escriba una zona"
        [options]="opcionesZona()"
        [value]="zonaId()"
        [searchable]="true"
        [creatable]="true"
        (valueChange)="zonaId.set($any($event) ?? '')"
        (itemCreated)="crear('zona', $event)"
      />
    </div>
    <footer class="an__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button
        [disabled]="!nombre().trim() || !procesoId() || !zonaId() || enviando()"
        (clicked)="crearActividad()"
        >{{ enviando() ? 'Creando…' : 'Crear actividad' }}</dynadrill-button
      >
    </footer>
  `,
  styles: `
    .an {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .an__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class IpercActividadNuevaDialog {
  private readonly servicio = inject(IpercMaestraService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(
    NzModalRef<IpercActividadNuevaDialog, MatrizDetalle | undefined>,
  );

  protected readonly catalogos = signal<CatalogosIperc | null>(null);
  protected readonly nombre = signal('');
  protected readonly procesoId = signal('');
  protected readonly zonaId = signal('');
  protected readonly enviando = signal(false);
  protected readonly opcionesProceso = computed<DynadrillSelectOption[]>(() =>
    (this.catalogos()?.procesos ?? []).map((p) => ({ value: p.id, label: p.nombre })),
  );
  protected readonly opcionesZona = computed<DynadrillSelectOption[]>(() =>
    (this.catalogos()?.zonas ?? []).map((z) => ({ value: z.id, label: z.nombre })),
  );

  constructor() {
    this.recargar();
  }

  private recargar(alTerminar?: () => void): void {
    this.servicio.catalogos().subscribe({
      next: (c) => {
        this.catalogos.set(c);
        alTerminar?.();
      },
      error: (err) =>
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar los catálogos.')),
    });
  }

  /** Un proceso o zona escrito en el selector: se da de alta (o devuelve el que ya existe con ese nombre) y queda elegido. */
  protected crear(tipo: TipoCatalogo, nombre: string): void {
    this.servicio.agregarCatalogo(tipo, nombre).subscribe({
      next: (r) =>
        this.recargar(() =>
          tipo === 'proceso' ? this.procesoId.set(r.id) : this.zonaId.set(r.id),
        ),
      error: (err) =>
        this.notify.error(
          'No se pudo agregar',
          mensajeDeError(err, 'No se pudo agregar el elemento.'),
        ),
    });
  }

  protected cancelar(): void {
    this.modalRef.close();
  }

  protected crearActividad(): void {
    if (!this.nombre().trim() || !this.procesoId() || !this.zonaId() || this.enviando()) return;
    this.enviando.set(true);
    this.servicio
      .crearActividad({
        procesoId: this.procesoId(),
        zonaId: this.zonaId(),
        nombre: this.nombre().trim(),
      })
      .subscribe({
        next: (m) => this.modalRef.close(m),
        error: (err) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo crear',
            mensajeDeError(err, 'No se pudo crear la actividad.'),
          );
        },
      });
  }
}
