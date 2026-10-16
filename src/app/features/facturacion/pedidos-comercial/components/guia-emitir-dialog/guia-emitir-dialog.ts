import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { forkJoin, of, switchMap } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { toLocalDateString } from '../../../../../shared/utils';
import { CatalogosPlataformaService } from '../../services/catalogos-plataforma.service';
import { GuiasComercialService } from '../../services/guias-comercial.service';
import type { ChoferPlataforma, TipoVehiculoPlataforma, TransportistaPlataforma, VehiculoPlataforma } from '../../models/catalogos-plataforma.model';
import {
  ORIGEN_ITEM_LABELS,
  PERMISOS_GUIAS,
  armarEmision,
  filaDesdeItem,
  filaVacia,
  mensajeErrorGuia,
  validarGuia,
  type BorradorGuia,
  type FilaGuia,
  type Guia,
  type LugarDespacho,
} from '../../models/guia-comercial';

export interface GuiaEmitirDialogData {
  pedidoId: string;
  /** Guía anulada a la que reemplaza la nueva (opcional). */
  reemplazaAId?: string;
}

type AltaTransporte = 'transportista' | 'vehiculo' | 'chofer' | 'lugar';

/**
 * Emite la guía de remisión. La propuesta (herramientas reportadas con su serie y materiales del pedido, sin personal,
 * horas ni precios) se puede editar, quitar y ampliar antes de emitir. El número sale del secuencial del portal; si se
 * escribe uno, se usa ese.
 */
@Component({
  selector: 'app-guia-emitir-dialog',
  imports: [DynadrillButtonComponent, DynadrillDatetimePickerComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTextComponent, DynadrillTextareaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <div class="ge">
      <dynadrill-text variant="body">La guía propone lo que sale físicamente de bodega. Revise los ítems: puede corregirlos, quitarlos o agregar otros antes de emitirla.</dynadrill-text>

      <div class="ge__grid">
        <dynadrill-datetime-picker mode="date" label="Fecha" [value]="fecha()!" (valueChange)="fecha.set($event)" />
        <dynadrill-select label="Lugar de origen" placeholder="Elija el lugar" [options]="opcionesLugares()" [value]="lugarId()" (valueChange)="lugarId.set($any($event))" />
        <label class="ge__hora">
          <span>Hora de salida</span>
          <input type="time" step="60" [value]="horaSalida()" (input)="horaSalida.set($any($event.target).value)" />
        </label>
        <label class="ge__hora">
          <span>Hora de llegada</span>
          <input type="time" step="60" [value]="horaLlegada()" (input)="horaLlegada.set($any($event.target).value)" />
        </label>
        <dynadrill-input label="Solicitado por" [value]="solicitadoPor()" (valueChange)="solicitadoPor.set($event)" />
        <dynadrill-input label="Despachado por" [value]="despachadoPor()" (valueChange)="despachadoPor.set($event)" />
      </div>

      <fieldset class="ge__bloque">
        <legend>Transporte</legend>
        <div class="ge__grid">
          <dynadrill-select label="Transportista" placeholder="Elija el transportista" [options]="opcionesTransportistas()" [value]="transportistaId()" (valueChange)="elegirTransportista($any($event))" />
          <dynadrill-select label="Vehículo (placa)" placeholder="Elija la placa" [options]="opcionesVehiculos()" [value]="vehiculoId()" (valueChange)="vehiculoId.set($any($event))" />
          <dynadrill-select label="Chofer" placeholder="Elija el chofer" [options]="opcionesChoferes()" [value]="choferId()" (valueChange)="choferId.set($any($event))" />
        </div>
        @if (puedeCrearTransporte()) {
          <div class="ge__altas" role="group" aria-label="Agregar al catálogo de transporte">
            <dynadrill-button variant="secondary" size="small" (clicked)="abrirAlta('transportista')">Nuevo transportista</dynadrill-button>
            <dynadrill-button variant="secondary" size="small" [disabled]="!transportistaId()" (clicked)="abrirAlta('vehiculo')">Nuevo vehículo</dynadrill-button>
            <dynadrill-button variant="secondary" size="small" [disabled]="!transportistaId()" (clicked)="abrirAlta('chofer')">Nuevo chofer</dynadrill-button>
            <dynadrill-button variant="secondary" size="small" (clicked)="abrirAlta('lugar')">Nuevo lugar de origen</dynadrill-button>
          </div>
        }
        @if (alta(); as tipo) {
          <div class="ge__alta">
            @switch (tipo) {
              @case ('transportista') {
                <dynadrill-input label="Nombre fiscal" [value]="altaA()" (valueChange)="altaA.set($event)" />
                <dynadrill-select label="Tipo de identificación" [options]="tiposId" [value]="altaTipoId()" (valueChange)="altaTipoId.set($any($event))" />
                <dynadrill-input label="Identificación" [value]="altaB()" (valueChange)="altaB.set($event)" />
              }
              @case ('vehiculo') {
                <dynadrill-input label="Placa (para el transportista elegido)" [value]="altaA()" (valueChange)="altaA.set($event)" />
                <dynadrill-select label="Tipo de vehículo" placeholder="Elija el tipo (opcional)" [options]="opcionesTipos()" [value]="altaTipoVehiculoId()" (valueChange)="altaTipoVehiculoId.set($any($event))" />
                <dynadrill-input label="O escriba un tipo nuevo (opcional)" [value]="altaTipoNuevo()" (valueChange)="altaTipoNuevo.set($event)" />
                <dynadrill-input label="Marca (opcional)" [value]="altaMarca()" (valueChange)="altaMarca.set($event)" />
                <dynadrill-input label="Modelo (opcional)" [value]="altaModelo()" (valueChange)="altaModelo.set($event)" />
                <dynadrill-input label="Año (opcional)" [value]="altaAnio()" (valueChange)="altaAnio.set($event)" />
              }
              @case ('chofer') {
                <dynadrill-input label="Nombre del chofer (del transportista elegido)" [value]="altaA()" (valueChange)="altaA.set($event)" />
                <dynadrill-input label="Licencia" [value]="altaB()" (valueChange)="altaB.set($event)" />
              }
              @case ('lugar') {
                <dynadrill-input label="Nombre del lugar" [value]="altaA()" (valueChange)="altaA.set($event)" />
              }
            }
            <div class="ge__alta-acciones">
              <dynadrill-button variant="secondary" size="small" (clicked)="alta.set(null)">Cancelar</dynadrill-button>
              <dynadrill-button size="small" [disabled]="guardandoAlta()" (clicked)="guardarAlta()">{{ guardandoAlta() ? 'Guardando…' : 'Guardar' }}</dynadrill-button>
            </div>
          </div>
        }
      </fieldset>

      <fieldset class="ge__bloque">
        <legend>Ítems de la guía ({{ filas().length }})</legend>
        <div class="ge__tabla">
          <table>
            <caption class="sr-only">Ítems de la guía de remisión</caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Descripción</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Unidad</th>
                <th scope="col">Serie</th>
                <th scope="col">Origen</th>
                <th scope="col"><span class="sr-only">Quitar</span></th>
              </tr>
            </thead>
            <tbody>
              @for (f of filas(); track $index; let i = $index) {
                <tr>
                  <td><input [attr.aria-label]="'Código del ítem ' + (i + 1)" [value]="f.codigo" (input)="cambiar(i, 'codigo', $event)" /></td>
                  <td><input [attr.aria-label]="'Descripción del ítem ' + (i + 1)" [value]="f.descripcion" (input)="cambiar(i, 'descripcion', $event)" /></td>
                  <td><input class="ge__corto" inputmode="decimal" [attr.aria-label]="'Cantidad del ítem ' + (i + 1)" [value]="f.cantidad" (input)="cambiar(i, 'cantidad', $event)" /></td>
                  <td><input class="ge__corto" [attr.aria-label]="'Unidad del ítem ' + (i + 1)" [value]="f.unidad" (input)="cambiar(i, 'unidad', $event)" /></td>
                  <td><input [attr.aria-label]="'Serie del ítem ' + (i + 1)" [value]="f.serie" (input)="cambiar(i, 'serie', $event)" /></td>
                  <td class="ge__origen">{{ origen(f) }}</td>
                  <td><dynadrill-button variant="secondary" size="small" (clicked)="quitar(i)">Quitar</dynadrill-button></td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="ge__vacio">La guía no tiene ítems. Agregue al menos uno.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <div class="ge__altas">
          <dynadrill-button variant="secondary" size="small" (clicked)="agregar()">Agregar ítem</dynadrill-button>
          <dynadrill-button variant="secondary" size="small" (clicked)="restaurar()">Restaurar propuesta</dynadrill-button>
        </div>
      </fieldset>

      <dynadrill-textarea label="Observaciones (opcional)" [rows]="2" [value]="observaciones()" (valueChange)="observaciones.set($event)" />
      <dynadrill-input label="Número de la guía (opcional: si lo deja vacío se usa el siguiente del secuencial)" [value]="numero()" (valueChange)="numero.set($event)" />

      @if (error(); as e) {
        <p class="ge__error" role="alert">{{ e }}</p>
      }
    </div>
    <footer class="ge__acciones">
      <dynadrill-button variant="secondary" (clicked)="cancelar()">Cancelar</dynadrill-button>
      <dynadrill-button [disabled]="enviando() || cargando()" (clicked)="emitir()">{{ enviando() ? 'Emitiendo…' : 'Emitir guía' }}</dynadrill-button>
    </footer>
  `,
  styles: `
    .ge { display: flex; flex-direction: column; gap: 14px; }
    .ge__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .ge__bloque { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 12px; border: 1px solid #ecebf1; border-radius: 8px; }
    .ge__bloque legend { padding: 0 6px; font-size: 13px; font-weight: 600; color: var(--text, #2c2b35); }
    .ge__hora { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted, #5c5870); }
    .ge__hora input { height: 32px; padding: 4px 11px; font: inherit; font-size: 14px; color: var(--text, #2c2b35); border: 1px solid #d9d7e3; border-radius: 8px; background: #fff; }
    .ge__hora input:focus { outline: none; border-color: var(--dynadrill-purple, #662e9b); }
    .ge__altas, .ge__alta-acciones { display: flex; flex-wrap: wrap; gap: 8px; }
    .ge__alta { display: flex; flex-direction: column; gap: 10px; padding: 10px; background: #f7f6fb; border-radius: 6px; }
    .ge__tabla { overflow-x: auto; }
    .ge__tabla table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .ge__tabla th { padding: 6px 4px; text-align: left; font-weight: 600; color: var(--text-muted, #5c5870); }
    .ge__tabla td { padding: 4px; vertical-align: middle; }
    .ge__tabla input { width: 100%; min-width: 90px; padding: 6px 8px; font: inherit; border: 1px solid #d9d7e3; border-radius: 6px; }
    .ge__tabla input.ge__corto { min-width: 64px; max-width: 90px; }
    .ge__origen { white-space: nowrap; color: var(--text-muted, #5c5870); }
    .ge__vacio { padding: 12px; text-align: center; color: var(--text-muted, #5c5870); }
    .ge__error { margin: 0; font-size: 13px; color: var(--error, #cf1322); }
    .ge__acciones { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #ecebf1; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
})
export class GuiaEmitirDialog {
  private readonly guias = inject(GuiasComercialService);
  private readonly catalogos = inject(CatalogosPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<GuiaEmitirDialog, Guia | undefined>);
  protected readonly data = inject<GuiaEmitirDialogData>(NZ_MODAL_DATA);

  protected readonly tiposId: DynadrillSelectOption[] = [
    { label: 'RUC', value: 'ruc' },
    { label: 'Cédula', value: 'cedula' },
    { label: 'Pasaporte', value: 'pasaporte' },
  ];

  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly lugarId = signal<string | null>(null);
  protected readonly horaSalida = signal('');
  protected readonly horaLlegada = signal('');
  protected readonly solicitadoPor = signal('');
  protected readonly despachadoPor = signal('');
  protected readonly transportistaId = signal<string | null>(null);
  protected readonly vehiculoId = signal<string | null>(null);
  protected readonly choferId = signal<string | null>(null);
  protected readonly observaciones = signal('');
  protected readonly numero = signal('');
  protected readonly filas = signal<FilaGuia[]>([]);

  private readonly lugares = signal<LugarDespacho[]>([]);
  private readonly transportistas = signal<TransportistaPlataforma[]>([]);
  private readonly vehiculos = signal<VehiculoPlataforma[]>([]);
  private readonly choferes = signal<ChoferPlataforma[]>([]);
  private propuesta: FilaGuia[] = [];

  protected readonly opcionesLugares = computed<DynadrillSelectOption[]>(() => this.lugares().map(l => ({ label: l.nombre, value: l.id })));
  protected readonly opcionesTransportistas = computed<DynadrillSelectOption[]>(() => this.transportistas().filter(t => t.habilitado).map(t => ({ label: `${t.nombreFiscal} (${t.identificacion})`, value: t.id })));
  protected readonly opcionesVehiculos = computed<DynadrillSelectOption[]>(() => this.vehiculos().filter(v => v.habilitado).map(v => ({ label: [v.placa, v.tipoVehiculo?.nombre, v.marca, v.modelo].filter(Boolean).join(' · '), value: v.id })));
  protected readonly opcionesChoferes = computed<DynadrillSelectOption[]>(() => this.choferes().filter(c => c.habilitado).map(c => ({ label: c.nombre, value: c.id })));
  protected readonly puedeCrearTransporte = computed(() => this.auth.can(PERMISOS_GUIAS.crearTransporte));

  protected readonly alta = signal<AltaTransporte | null>(null);
  protected readonly altaA = signal('');
  protected readonly altaB = signal('');
  protected readonly altaTipoId = signal<string>('ruc');
  protected readonly altaTipoVehiculoId = signal<string | null>(null);
  protected readonly altaTipoNuevo = signal('');
  protected readonly altaMarca = signal('');
  protected readonly altaModelo = signal('');
  protected readonly altaAnio = signal('');
  private readonly tiposVehiculo = signal<TipoVehiculoPlataforma[]>([]);
  protected readonly opcionesTipos = computed<DynadrillSelectOption[]>(() => this.tiposVehiculo().filter(t => t.habilitado).map(t => ({ label: t.nombre, value: t.id })));
  protected readonly guardandoAlta = signal(false);

  constructor() {
    forkJoin({
      lugares: this.guias.lugares(),
      transportistas: this.catalogos.transportistas(),
      tipos: this.catalogos.tiposVehiculo(),
      sugeridos: this.guias.itemsSugeridos(this.data.pedidoId),
    }).subscribe({
      next: r => {
        this.lugares.set(r.lugares);
        if (r.lugares.length === 1) this.lugarId.set(r.lugares[0].id);
        this.transportistas.set(r.transportistas);
        this.tiposVehiculo.set(r.tipos);
        this.propuesta = r.sugeridos.map(filaDesdeItem);
        this.filas.set([...this.propuesta]);
        this.cargando.set(false);
      },
      error: err => {
        this.cargando.set(false);
        this.error.set(mensajeErrorGuia(err, 'No se pudo preparar la guía. Intente de nuevo.'));
      },
    });
  }

  protected elegirTransportista(id: string | null): void {
    this.transportistaId.set(id);
    this.vehiculoId.set(null);
    this.choferId.set(null);
    this.vehiculos.set([]);
    this.choferes.set([]);
    if (!id) return;
    forkJoin({ v: this.catalogos.vehiculos(id), c: this.catalogos.choferes(id) }).subscribe({
      next: r => {
        this.vehiculos.set(r.v);
        this.choferes.set(r.c);
      },
      error: () => this.error.set('No se pudieron cargar los vehículos y choferes del transportista.'),
    });
  }

  protected readonly origen = (f: FilaGuia) => ORIGEN_ITEM_LABELS[f.origen];

  protected cambiar(i: number, campo: keyof Omit<FilaGuia, 'origen'>, e: Event): void {
    const valor = (e.target as HTMLInputElement).value;
    this.filas.update(fs => fs.map((f, k) => (k === i ? { ...f, [campo]: valor } : f)));
  }

  protected quitar(i: number): void {
    this.filas.update(fs => fs.filter((_, k) => k !== i));
  }

  protected agregar(): void {
    this.filas.update(fs => [...fs, filaVacia()]);
  }

  protected restaurar(): void {
    this.filas.set([...this.propuesta]);
  }

  protected abrirAlta(tipo: AltaTransporte): void {
    this.altaA.set('');
    this.altaB.set('');
    this.altaTipoId.set('ruc');
    this.altaTipoVehiculoId.set(null);
    this.altaTipoNuevo.set('');
    this.altaMarca.set('');
    this.altaModelo.set('');
    this.altaAnio.set('');
    this.alta.set(tipo);
  }

  protected guardarAlta(): void {
    const tipo = this.alta();
    if (!tipo || this.guardandoAlta()) return;
    const a = this.altaA().trim();
    const b = this.altaB().trim();
    const t = this.transportistaId();
    this.error.set(null);
    this.guardandoAlta.set(true);
    const terminar = (): void => {
      this.guardandoAlta.set(false);
      this.alta.set(null);
    };
    const fallar = (err: unknown): void => {
      this.guardandoAlta.set(false);
      this.error.set(mensajeErrorGuia(err, 'No se pudo guardar. Revise los datos e intente de nuevo.'));
    };
    switch (tipo) {
      case 'transportista':
        if (!a || !b) return this.faltan();
        this.catalogos.crearTransportista({ nombreFiscal: a, tipoIdentificacion: this.altaTipoId() as 'ruc' | 'cedula' | 'pasaporte', identificacion: b }).subscribe({
          next: n => {
            this.transportistas.update(l => [...l, n]);
            this.elegirTransportista(n.id);
            terminar();
          },
          error: fallar,
        });
        return;
      case 'vehiculo':
        if (!a || !t) return this.faltan();
        {
          const anioTexto = this.altaAnio().trim();
          const anio = anioTexto ? Number(anioTexto) : undefined;
          if (anio !== undefined && (!Number.isInteger(anio) || anio < 1950 || anio > 2100)) {
            this.guardandoAlta.set(false);
            this.error.set('El año del vehículo debe estar entre 1950 y 2100.');
            return;
          }
          const nuevoTipo = this.altaTipoNuevo().trim();
          // un tipo nuevo se agrega al catálogo antes de crear el vehículo
          const tipo$ = nuevoTipo
            ? this.catalogos.crearTipoVehiculo(nuevoTipo).pipe(
                switchMap(nt => {
                  this.tiposVehiculo.update(l => [...l, nt]);
                  return of(nt.id as string | null);
                }),
              )
            : of(this.altaTipoVehiculoId());
          tipo$
            .pipe(
              switchMap(tipoId =>
                this.catalogos.crearVehiculo({
                  placa: a,
                  transportistaId: t,
                  ...(tipoId ? { tipoVehiculoId: tipoId } : {}),
                  ...(this.altaMarca().trim() ? { marca: this.altaMarca().trim() } : {}),
                  ...(this.altaModelo().trim() ? { modelo: this.altaModelo().trim() } : {}),
                  ...(anio !== undefined ? { anio } : {}),
                }),
              ),
            )
            .subscribe({
              next: n => {
                this.vehiculos.update(l => [...l, n]);
                this.vehiculoId.set(n.id);
                terminar();
              },
              error: fallar,
            });
        }
        return;
      case 'chofer':
        if (!a || !b || !t) return this.faltan();
        this.catalogos.crearChofer({ transportistaId: t, nombre: a, licencia: b }).subscribe({
          next: n => {
            this.choferes.update(l => [...l, n]);
            this.choferId.set(n.id);
            terminar();
          },
          error: fallar,
        });
        return;
      case 'lugar':
        if (!a) return this.faltan();
        this.guias.crearLugar(a).subscribe({
          next: n => {
            this.lugares.update(l => [...l.filter(x => x.id !== n.id), n]);
            this.lugarId.set(n.id);
            terminar();
          },
          error: fallar,
        });
    }
  }

  private faltan(): void {
    this.guardandoAlta.set(false);
    this.error.set('Complete todos los datos para guardar.');
  }

  private borrador(): BorradorGuia {
    const f = this.fecha();
    return {
      fecha: f ? toLocalDateString(f) : null,
      lugarOrigenId: this.lugarId(),
      transportistaId: this.transportistaId(),
      vehiculoId: this.vehiculoId(),
      choferId: this.choferId(),
      solicitadoPorNombre: this.solicitadoPor(),
      despachadoPorNombre: this.despachadoPor(),
      horaSalida: this.horaSalida(),
      horaLlegada: this.horaLlegada(),
      observaciones: this.observaciones(),
      numero: this.numero(),
      filas: this.filas(),
    };
  }

  protected emitir(): void {
    if (this.enviando()) return;
    const b = this.borrador();
    const problema = validarGuia(b);
    if (problema) return void this.error.set(problema);
    this.error.set(null);
    this.enviando.set(true);
    this.guias.emitir(this.data.pedidoId, armarEmision(b, this.data.reemplazaAId)).subscribe({
      next: g => {
        this.notify.success('Guía emitida', g.codigo);
        this.modalRef.close(g);
      },
      error: err => {
        this.enviando.set(false);
        this.error.set(mensajeErrorGuia(err, 'No se pudo emitir la guía. Intente de nuevo.'));
      },
    });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
