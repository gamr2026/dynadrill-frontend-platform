import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import {
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { firstValueFrom } from 'rxjs';
import { PozoFormDialog, type PozoFormDialogData } from './pozo-form-dialog';
import { CatalogosService } from '../../services/catalogos.service';
import { UBICACION_VACIA, type Bloque, type Campo, type Pozo, type Taladro, type UbicacionSeleccion } from '../../models/catalogos.model';

/**
 * Selector de ubicación operativa reutilizable. Reemplaza los campos de
 * texto libre (Campo / Bloque / Pozo / Taladro) que estaban repartidos por
 * Facturación, Operaciones, Mantenimiento y QHSE.
 *
 * Cascada estricta: se elige el **Pozo** primero (único campo habilitado al
 * inicio, buscable por código o nombre — no hace falta filtrar por Campo
 * antes). Campo + Bloque se autocompletan y quedan de solo lectura — vienen
 * del registro del pozo, no se tipean. El **Taladro** se habilita recién
 * cuando hay Pozo (varía por pozo) y muestra su Rig Contractual.
 *
 * Emite un `UbicacionSeleccion` con ids (trazabilidad) y strings (para los
 * payloads que hoy ya guardan `campo`/`pozo`/`wellName`/`taladroRig`).
 */
@Component({
  selector: 'app-ubicacion-selector',
  imports: [DynadrillSelectComponent, DynadrillInputComponent, DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ubicacion-selector">
      <div class="ubicacion-selector__campo">
        <dynadrill-select
          label="Pozo"
          [placeholder]="permitirAlta() ? 'Selecciona o agrega el pozo' : 'Selecciona el pozo'"
          [options]="pozoOptions()"
          [value]="pozoId()"
          [searchable]="true"
          [creatable]="permitirAlta()"
          (valueChange)="onPozoChange($any($event))"
          (itemCreated)="altaPozo($event)"
        />
        @if (permitirAlta() && pozoId() !== null) {
          <dynadrill-icon-button icon="delete" tooltip="Eliminar este pozo del catálogo" (clicked)="eliminarPozo()" />
        }
      </div>
      <dynadrill-input label="Campo" [value]="campoNombre()" [disabled]="true" />
      <dynadrill-input label="Bloque" [value]="bloqueNombre()" [disabled]="true" />

      @if (mostrarTaladro()) {
        <div class="ubicacion-selector__campo">
          <dynadrill-select
            label="Taladro"
            [placeholder]="pozoId() === null ? 'Selecciona primero el pozo' : requiereTaladro() ? 'Selecciona el taladro (o RIGLESS)' : 'Taladro (opcional)'"
            [options]="taladroOptions()"
            [value]="taladroId()"
            [searchable]="true"
            [creatable]="permitirAlta()"
            [disabled]="pozoId() === null"
            (valueChange)="onTaladroChange($any($event))"
            (itemCreated)="altaTaladro($event)"
          />
          @if (permitirAlta() && taladroEliminable()) {
            <dynadrill-icon-button icon="delete" tooltip="Eliminar este taladro del catálogo" (clicked)="eliminarTaladro()" />
          }
        </div>
        @if (mostrarRigContractual() && rigContractual()) {
          <dynadrill-input label="Rig contractual" [value]="rigContractual()" [disabled]="true" />
        }
      }
    </div>
  `,
  styles: [`
    /**
     * Fijo a 2 columnas (no auto-fit): con auto-fit(minmax(200px,...)) el
     * número de campos visibles (3 a 5, según requiereTaladro/
     * mostrarRigContractual) a veces entraba 3 por fila y dejaba el último
     * solo en su propia fila — se veía desparejo. En celular colapsa a 1.
     */
    .ubicacion-selector {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    /* Select + botón de eliminar al costado (alta rápida). */
    .ubicacion-selector__campo {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }

    .ubicacion-selector__campo > dynadrill-select {
      flex: 1;
      min-width: 0;
    }

    @media (max-width: 600px) {
      .ubicacion-selector {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class UbicacionSelectorComponent {
  private readonly catalogos = inject(CatalogosService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  /** Prellena el selector al editar un registro existente. */
  readonly valorInicial = input<Partial<UbicacionSeleccion> | null>(null);
  /** true = el Taladro es obligatorio para que `completo()` sea verdadero. */
  readonly requiereTaladro = input(false);
  /** false = oculta el select de Taladro (formularios donde no aplica, ej. Reporte de Unidad). */
  readonly mostrarTaladro = input(true);
  /** false = oculta el campo de solo lectura "Rig contractual" (ej. alta de Pedido — a pedido del cliente, ver FACT-001). */
  readonly mostrarRigContractual = input(true);

  /**
   * true = se puede agregar al vuelo un pozo/taladro que no existe (queda guardado en la base) y eliminar el elegido,
   * con confirmación. Solo lo prenden los formularios de quien tiene permiso de escritura de catálogos (alta de Pedido).
   */
  readonly permitirAlta = input(false);

  readonly seleccionChange = output<UbicacionSeleccion>();

  protected readonly bloques = signal<Bloque[]>([]);

  protected readonly campos = signal<Campo[]>([]);
  protected readonly pozos = signal<Pozo[]>([]);
  protected readonly taladros = signal<Taladro[]>([]);

  protected readonly campoId = signal<number | null>(null);
  protected readonly pozoId = signal<number | null>(null);
  protected readonly taladroId = signal<number | null>(null);

  /** Último `valorInicial` ya aplicado — evita re-aplicar (y re-emitir) en cada corrida del effect. */
  private ultimoValorAplicado?: Partial<UbicacionSeleccion> | null;

  constructor() {
    this.catalogos.campos().subscribe(c => this.campos.set(c));
    this.catalogos.taladros().subscribe(t => this.taladros.set(t.filter(x => x.habilitado)));
    this.catalogos.pozos().subscribe(p => this.pozos.set(p));
    this.catalogos.bloques().subscribe(b => this.bloques.set(b));

    // El `valorInicial` puede llegar después del catálogo (ej. el ticket se
    // carga por HTTP y recién ahí se sabe el pozo), así que no alcanza con
    // aplicarlo una sola vez al resolver los pozos.
    effect(() => {
      const v = this.valorInicial();
      const hayPozos = this.pozos().length > 0;
      // `aplicarValorInicial` escribe las mismas señales que lee (pozoId,
      // campoId, taladroId), así que va en `untracked`: el effect sólo debe
      // depender del valor inicial y de que el catálogo ya esté cargado.
      untracked(() => {
        if (!hayPozos || v === this.ultimoValorAplicado) return;
        this.ultimoValorAplicado = v;
        this.aplicarValorInicial();
      });
    });
  }

  private aplicarValorInicial(): void {
    const v = this.valorInicial();
    if (!v) return;
    const pozo = v.pozoId ? this.pozos().find(p => p.id === v.pozoId) : this.buscarPozoPorNombre(v.pozo);
    if (pozo) {
      this.pozoId.set(pozo.id);
      this.campoId.set(pozo.campoId);
    } else if (v.campoId) {
      this.campoId.set(v.campoId);
    }
    if (v.taladroId) {
      this.taladroId.set(v.taladroId);
    } else if (v.taladro) {
      this.taladroId.set(this.taladros().find(t => t.nombre === v.taladro)?.id ?? null);
    }
    this.emitir();
  }

  /**
   * Los formularios traen el pozo como texto y no siempre con el mismo
   * formato: unos guardan el código ("AMSA-006"), otros el nombre completo
   * ("AMISTAD-A006"). Se prueban ambos, sin distinguir mayúsculas.
   */
  private buscarPozoPorNombre(nombre: string | undefined): Pozo | undefined {
    const q = nombre?.trim().toLowerCase();
    if (!q) return undefined;
    return this.pozos().find(p => p.codigo.toLowerCase() === q || p.nombreCompleto.toLowerCase() === q);
  }

  protected readonly pozoOptions = computed<DynadrillSelectOption[]>(() =>
    this.pozos().map(p => ({ label: `${p.codigo} — ${p.nombreCompleto}`, value: p.id })),
  );

  protected readonly taladroOptions = computed<DynadrillSelectOption[]>(() =>
    [...this.taladros()]
      .sort((a, b) => Number(esRigless(b.nombre)) - Number(esRigless(a.nombre)))
      .map(t => ({
        label: esRigless(t.nombre) ? 'RIGLESS (sin taladro)' : t.rigContractual ? `${t.nombre} · ${t.rigContractual}` : t.nombre,
        value: t.id,
      })),
  );

  /** RIGLESS es una opción fija: no se elimina. */
  protected readonly taladroEliminable = computed(() => {
    const t = this.taladros().find(x => x.id === this.taladroId());
    return !!t && !esRigless(t.nombre);
  });

  protected readonly pozoSeleccionado = computed<Pozo | undefined>(() =>
    this.pozos().find(p => p.id === this.pozoId()),
  );

  protected readonly campoNombre = computed(
    () => this.pozoSeleccionado()?.campo?.nombre ?? this.campos().find(c => c.id === this.campoId())?.nombre ?? '',
  );
  protected readonly bloqueNombre = computed(() => this.pozoSeleccionado()?.bloque?.nombre ?? '');
  protected readonly rigContractual = computed(
    () => this.taladros().find(t => t.id === this.taladroId())?.rigContractual ?? '',
  );

  /** true cuando hay lo mínimo para guardar (pozo, y taladro si se exige). */
  readonly completo = computed(() => this.pozoId() !== null && (!this.requiereTaladro() || this.taladroId() !== null));

  protected onPozoChange(pozoId: number | null): void {
    this.pozoId.set(pozoId);
    const pozo = this.pozos().find(p => p.id === pozoId);
    this.campoId.set(pozo?.campoId ?? null);
    // Taladro depende del Pozo (se deshabilita sin uno) — si se limpia el pozo, se limpia también.
    if (!pozo) this.taladroId.set(null);
    this.emitir();
  }

  // ── Alta rápida / baja (solo con `permitirAlta`) ──

  /** El texto tipeado en "+ Agregar" abre el alta del pozo (Campo y Bloque se eligen o se agregan ahí). */
  protected altaPozo(texto: string): void {
    const codigo = texto.trim();
    if (!codigo) return;
    const existente = this.buscarPozoPorNombre(codigo);
    if (existente) {
      this.onPozoChange(existente.id);
      return;
    }
    const ref = this.dialog.open<PozoFormDialog, PozoFormDialogData>({
      title: 'Nuevo pozo',
      content: PozoFormDialog,
      data: { codigoInicial: codigo, campos: this.campos(), bloques: this.bloques() },
      footer: false,
    });
    ref.afterClose.subscribe(async (pozoId: number | undefined) => {
      if (!pozoId) return;
      const [pozos, campos, bloques] = await Promise.all([
        firstValueFrom(this.catalogos.pozos()),
        firstValueFrom(this.catalogos.campos()),
        firstValueFrom(this.catalogos.bloques()),
      ]);
      this.pozos.set(pozos);
      this.campos.set(campos);
      this.bloques.set(bloques);
      this.onPozoChange(pozoId);
    });
  }

  protected async eliminarPozo(): Promise<void> {
    const pozo = this.pozoSeleccionado();
    if (!pozo) return;
    const confirmado = await this.dialog.confirm({
      title: `¿Eliminar el pozo ${pozo.codigo}?`,
      content: 'Se quita del catálogo para todos. Los pedidos y tickets que ya lo usan conservan su dato. Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!confirmado) return;
    this.catalogos.eliminarPozo(pozo.id).subscribe({
      next: () => {
        this.pozos.update(rows => rows.filter(p => p.id !== pozo.id));
        this.onPozoChange(null);
        this.notify.success('Eliminado', `Pozo ${pozo.codigo} eliminado.`);
      },
      error: () => this.notify.error('Error', 'No se pudo eliminar el pozo.'),
    });
  }

  protected altaTaladro(texto: string): void {
    const nombre = texto.trim().toUpperCase();
    if (!nombre) return;
    const existente = this.taladros().find(t => t.nombre.toUpperCase() === nombre);
    if (existente) {
      this.onTaladroChange(existente.id);
      return;
    }
    this.catalogos.crearTaladro({ nombre }).subscribe({
      next: taladro => {
        this.taladros.update(rows => [...rows, taladro]);
        this.onTaladroChange(taladro.id);
        this.notify.success('Taladro creado', `${nombre} guardado en el catálogo.`);
      },
      error: () => this.notify.error('Error', 'No se pudo guardar el taladro.'),
    });
  }

  protected async eliminarTaladro(): Promise<void> {
    const taladro = this.taladros().find(t => t.id === this.taladroId());
    if (!taladro || esRigless(taladro.nombre)) return;
    const confirmado = await this.dialog.confirm({
      title: `¿Eliminar el taladro ${taladro.nombre}?`,
      content: 'Se quita del catálogo para todos. Los pedidos y tickets que ya lo usan conservan su dato. Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!confirmado) return;
    this.catalogos.eliminarTaladro(taladro.id).subscribe({
      next: () => {
        this.taladros.update(rows => rows.filter(t => t.id !== taladro.id));
        this.onTaladroChange(null);
        this.notify.success('Eliminado', `Taladro ${taladro.nombre} eliminado.`);
      },
      error: () => this.notify.error('Error', 'No se pudo eliminar el taladro.'),
    });
  }

  protected onTaladroChange(taladroId: number | null): void {
    this.taladroId.set(taladroId);
    this.emitir();
  }

  private emitir(): void {
    const pozo = this.pozoSeleccionado();
    const campo = this.campos().find(c => c.id === (pozo?.campoId ?? this.campoId()));
    const taladro = this.taladros().find(t => t.id === this.taladroId());
    this.seleccionChange.emit({
      ...UBICACION_VACIA,
      pozoId: pozo?.id ?? null,
      pozo: pozo?.codigo ?? '',
      nombreCompletoPozo: pozo?.nombreCompleto ?? '',
      campoId: campo?.id ?? pozo?.campoId ?? this.campoId() ?? null,
      campo: campo?.nombre ?? pozo?.campo?.nombre ?? '',
      bloqueId: pozo?.bloqueId ?? null,
      bloque: pozo?.bloque?.nombre ?? '',
      taladroId: taladro?.id ?? null,
      taladro: taladro?.nombre ?? '',
      rigContractual: taladro?.rigContractual ?? '',
      zona: campo?.zona ?? pozo?.campo?.zona ?? '',
    });
  }
}

function esRigless(nombre: string): boolean {
  return nombre.trim().toUpperCase() === 'RIGLESS';
}
