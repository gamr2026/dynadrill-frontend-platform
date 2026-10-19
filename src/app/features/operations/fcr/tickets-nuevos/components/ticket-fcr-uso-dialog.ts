import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import {
  ESTADO_USO_LABELS,
  fechaEnServicio,
  mensajeErrorTicket,
  validarPicker,
  type BitacoraTicket,
  type CatalogosFcr,
  type EstadoUso,
  type HerramientaTicket,
  type PickerEntrada,
  type TipoOt,
  type UsoTicket,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

export interface TicketFcrUsoDialogData {
  ticketId: string;
  tipoOt: TipoOt;
  /** Herramientas recibidas del ticket (solo esas se usan). */
  herramientas: HerramientaTicket[];
  servicio: BitacoraTicket['servicio'];
  /** Día propuesto. */
  fecha: string;
  herramientaId?: string;
}

const ESTADOS: DynadrillSelectOption[] = (Object.keys(ESTADO_USO_LABELS) as EstadoUso[]).map(
  (e) => ({ label: ESTADO_USO_LABELS[e], value: e }),
);

/**
 * Uso de una herramienta en un día: su estado de cobro (el que recibe Comercial) y, si se registra, el tipo de completación (venta) o de
 * trabajo (servicios) con el picker, la presión y el peso. Registrar otra vez la misma herramienta y día reemplaza el registro.
 */
@Component({
  selector: 'app-ticket-fcr-uso-dialog',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillCheckboxComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="u">
      @if (error(); as e) {
        <dynadrill-banner variant="critical" [message]="e" />
      }
      <dynadrill-select
        label="Herramienta"
        placeholder="Elija la herramienta"
        [options]="opcionesHerramienta()"
        [value]="herramientaId()"
        [searchable]="true"
        (valueChange)="herramientaId.set($any($event))"
      />
      <label class="u__fecha"
        ><span>Día</span
        ><input
          type="date"
          [value]="fecha()"
          [attr.min]="data.servicio.desde"
          [attr.max]="data.servicio.hasta"
          (input)="fecha.set($any($event.target).value)"
      /></label>
      <dynadrill-select
        label="Estado de cobro"
        [options]="estados"
        [value]="estado()"
        (valueChange)="estado.set($any($event))"
      />
      <dynadrill-checkbox
        label="Registrar completación o trabajo, picker, presión y peso"
        [checked]="conPicker()"
        (checkedChange)="conPicker.set($event)"
      />
      @if (conPicker()) {
        <div class="u__picker">
          @if (data.tipoOt === 'servicio') {
            <dynadrill-select
              label="Tipo de trabajo"
              placeholder="Elija"
              [options]="opcionesTrabajo()"
              [value]="trabajoId()"
              (valueChange)="trabajoId.set($any($event))"
            />
          } @else {
            <dynadrill-select
              label="Tipo de completación"
              placeholder="Elija"
              [options]="opcionesCompletacion()"
              [value]="completacionId()"
              (valueChange)="completacionId.set($any($event))"
            />
          }
          <dynadrill-select
            label="Tipo de picker"
            placeholder="Elija"
            [options]="opcionesPicker()"
            [value]="pickerId()"
            (valueChange)="pickerId.set($any($event))"
          />
          <dynadrill-input
            label="Presión"
            type="number"
            [value]="presion()"
            (valueChange)="presion.set($event)"
          />
          <dynadrill-input
            label="Peso"
            type="number"
            [value]="peso()"
            (valueChange)="peso.set($event)"
          />
        </div>
        <dynadrill-textarea
          label="Observación (solo si hubo alguna novedad)"
          [rows]="2"
          [value]="observacion()"
          (valueChange)="observacion.set($event)"
        />
      }
      @if (problema(); as p) {
        <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
      }
    </div>
    <footer class="u__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="!!problema() || enviando()" (clicked)="guardar()">{{
        enviando() ? 'Guardando…' : 'Guardar'
      }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .u {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .u__fecha {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: #5c5870;
    }
    .u__fecha input {
      padding: 8px 10px;
      border: 1px solid #ccc9d9;
      border-radius: 8px;
      font: inherit;
    }
    .u__picker {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }
    .u__acciones {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
  `,
})
export class TicketFcrUsoDialog {
  private readonly servicio = inject(TicketsFcrService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketFcrUsoDialog, UsoTicket | undefined>);
  protected readonly data = inject<TicketFcrUsoDialogData>(NZ_MODAL_DATA);

  protected readonly estados = ESTADOS;
  private readonly catalogos = signal<CatalogosFcr | null>(null);
  protected readonly herramientaId = signal<string | null>(this.data.herramientaId ?? null);
  protected readonly fecha = signal(this.data.fecha);
  protected readonly estado = signal<EstadoUso>('operacion');
  protected readonly conPicker = signal(false);
  protected readonly completacionId = signal<string | null>(null);
  protected readonly trabajoId = signal<string | null>(null);
  protected readonly pickerId = signal<string | null>(null);
  protected readonly presion = signal('');
  protected readonly peso = signal('');
  protected readonly observacion = signal('');
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly opcionesHerramienta = computed<DynadrillSelectOption[]>(() =>
    this.data.herramientas
      .filter((h) => h.estado === 'recibida')
      .map((h, i) => ({
        label: `${h.nombre} (${h.codigo})${h.numeroSerie ? ' · serie ' + h.numeroSerie : ''} #${i + 1}`,
        value: h.id,
      })),
  );
  private readonly opciones = (
    l: Array<{ id: string; nombre: string }> | undefined,
  ): DynadrillSelectOption[] => (l ?? []).map((x) => ({ label: x.nombre, value: x.id }));
  protected readonly opcionesCompletacion = computed(() =>
    this.opciones(this.catalogos()?.tiposCompletacion),
  );
  protected readonly opcionesTrabajo = computed(() =>
    this.opciones(this.catalogos()?.tiposTrabajo),
  );
  protected readonly opcionesPicker = computed(() => this.opciones(this.catalogos()?.tiposPicker));

  protected readonly problema = computed(() => {
    if (!this.herramientaId()) return 'Elija la herramienta.';
    if (!fechaEnServicio(this.fecha(), this.data.servicio))
      return 'El día debe estar dentro de las fechas del servicio.';
    if (!this.conPicker()) return null;
    return validarPicker(this.data.tipoOt, {
      tipoCompletacionId: this.completacionId(),
      tipoTrabajoId: this.trabajoId(),
      tipoPickerId: this.pickerId(),
      presion: this.presion(),
      peso: this.peso(),
    });
  });

  constructor() {
    this.servicio.catalogos().subscribe({
      next: (c) => this.catalogos.set(c),
      error: (err) => this.error.set(mensajeErrorTicket(err, 'No se pudo cargar los catálogos.')),
    });
  }

  protected guardar(): void {
    const h = this.herramientaId();
    if (!h || this.problema() || this.enviando()) return;
    const picker: PickerEntrada | undefined = this.conPicker()
      ? {
          ...(this.data.tipoOt === 'servicio'
            ? { tipoTrabajoId: this.trabajoId()! }
            : { tipoCompletacionId: this.completacionId()! }),
          tipoPickerId: this.pickerId()!,
          presion: Number(this.presion()),
          peso: Number(this.peso()),
          ...(this.observacion().trim() ? { observacion: this.observacion().trim() } : {}),
        }
      : undefined;
    this.enviando.set(true);
    this.error.set(null);
    this.servicio
      .registrarUso(this.data.ticketId, h, this.fecha(), this.estado(), picker)
      .subscribe({
        next: (u) => {
          this.notify.success('Uso registrado', `Día ${this.fecha()}.`);
          this.modalRef.close(u);
        },
        error: (err) => {
          this.enviando.set(false);
          this.error.set(mensajeErrorTicket(err, 'No se pudo registrar el uso.'));
        },
      });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
