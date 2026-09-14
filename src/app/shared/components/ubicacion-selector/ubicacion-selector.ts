import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DynadrillInputComponent, DynadrillSelectComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { CatalogosService } from '../../services/catalogos.service';
import { UBICACION_VACIA, type Campo, type Pozo, type Taladro, type UbicacionSeleccion } from '../../models/catalogos.model';

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
  imports: [DynadrillSelectComponent, DynadrillInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ubicacion-selector">
      <dynadrill-select
        label="Pozo"
        placeholder="Selecciona el pozo"
        [options]="pozoOptions()"
        [value]="pozoId()"
        [searchable]="true"
        (valueChange)="onPozoChange($any($event))"
      />
      <dynadrill-input label="Campo" [value]="campoNombre()" [disabled]="true" />
      <dynadrill-input label="Bloque" [value]="bloqueNombre()" [disabled]="true" />

      @if (mostrarTaladro()) {
        <dynadrill-select
          label="Taladro"
          [placeholder]="pozoId() === null ? 'Selecciona primero el pozo' : requiereTaladro() ? 'Selecciona el taladro' : 'Taladro (opcional)'"
          [options]="taladroOptions()"
          [value]="taladroId()"
          [searchable]="true"
          [disabled]="pozoId() === null"
          (valueChange)="onTaladroChange($any($event))"
        />
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

    @media (max-width: 600px) {
      .ubicacion-selector {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class UbicacionSelectorComponent {
  private readonly catalogos = inject(CatalogosService);

  /** Prellena el selector al editar un registro existente. */
  readonly valorInicial = input<Partial<UbicacionSeleccion> | null>(null);
  /** true = el Taladro es obligatorio para que `completo()` sea verdadero. */
  readonly requiereTaladro = input(false);
  /** false = oculta el select de Taladro (formularios donde no aplica, ej. Reporte de Unidad). */
  readonly mostrarTaladro = input(true);
  /** false = oculta el campo de solo lectura "Rig contractual" (ej. alta de Pedido — a pedido del cliente, ver FACT-001). */
  readonly mostrarRigContractual = input(true);

  readonly seleccionChange = output<UbicacionSeleccion>();

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
    this.taladros().map(t => ({ label: t.rigContractual ? `${t.nombre} · ${t.rigContractual}` : t.nombre, value: t.id })),
  );

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
