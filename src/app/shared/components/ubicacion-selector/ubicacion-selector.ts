import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DynadrillInputComponent, DynadrillSelectComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { CatalogosService } from '../../services/catalogos.service';
import { UBICACION_VACIA, type Campo, type Pozo, type Taladro, type UbicacionSeleccion } from '../../models/catalogos.model';

/**
 * Selector de ubicación operativa reutilizable. Reemplaza los campos de
 * texto libre (Campo / Bloque / Pozo / Taladro) que estaban repartidos por
 * Facturación, Operaciones, Mantenimiento y QHSE.
 *
 * Cascada: se elige el **Pozo** (opcionalmente filtrado por Campo) y el
 * Campo + Bloque se autocompletan y quedan de solo lectura — vienen del
 * registro del pozo, no se tipean. El **Taladro** se elige aparte (varía
 * por pozo) y muestra su Rig Contractual.
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
        label="Campo"
        placeholder="Todos los campos"
        [options]="campoOptions()"
        [value]="campoId()"
        [searchable]="true"
        (valueChange)="onCampoChange($any($event))"
      />
      <dynadrill-select
        label="Pozo"
        placeholder="Selecciona el pozo"
        [options]="pozoOptions()"
        [value]="pozoId()"
        [searchable]="true"
        (valueChange)="onPozoChange($any($event))"
      />
      <dynadrill-input label="Bloque" [value]="bloqueNombre()" [disabled]="true" />

      @if (mostrarTaladro()) {
        <dynadrill-select
          label="Taladro"
          [placeholder]="requiereTaladro() ? 'Selecciona el taladro' : 'Taladro (opcional)'"
          [options]="taladroOptions()"
          [value]="taladroId()"
          [searchable]="true"
          (valueChange)="onTaladroChange($any($event))"
        />
        @if (rigContractual()) {
          <dynadrill-input label="Rig contractual" [value]="rigContractual()" [disabled]="true" />
        }
      }
    </div>
  `,
  styles: [`
    .ubicacion-selector {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
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

  readonly seleccionChange = output<UbicacionSeleccion>();

  protected readonly campos = signal<Campo[]>([]);
  protected readonly pozos = signal<Pozo[]>([]);
  protected readonly taladros = signal<Taladro[]>([]);

  protected readonly campoId = signal<number | null>(null);
  protected readonly pozoId = signal<number | null>(null);
  protected readonly taladroId = signal<number | null>(null);

  constructor() {
    this.catalogos.campos().subscribe(c => this.campos.set(c));
    this.catalogos.taladros().subscribe(t => this.taladros.set(t.filter(x => x.habilitado)));
    this.catalogos.pozos().subscribe(p => {
      this.pozos.set(p);
      this.aplicarValorInicial();
    });
  }

  private aplicarValorInicial(): void {
    const v = this.valorInicial();
    if (!v) return;
    const pozo = v.pozoId
      ? this.pozos().find(p => p.id === v.pozoId)
      : v.pozo
        ? this.pozos().find(p => p.codigo === v.pozo)
        : undefined;
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

  protected readonly campoOptions = computed<DynadrillSelectOption[]>(() =>
    [...this.campos()]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(c => ({ label: c.activo ? `${c.nombre} (${c.activo})` : c.nombre, value: c.id })),
  );

  protected readonly pozosFiltrados = computed<Pozo[]>(() => {
    const cid = this.campoId();
    return cid ? this.pozos().filter(p => p.campoId === cid) : this.pozos();
  });

  protected readonly pozoOptions = computed<DynadrillSelectOption[]>(() =>
    this.pozosFiltrados().map(p => ({ label: `${p.codigo} — ${p.nombreCompleto}`, value: p.id })),
  );

  protected readonly taladroOptions = computed<DynadrillSelectOption[]>(() =>
    this.taladros().map(t => ({ label: t.rigContractual ? `${t.nombre} · ${t.rigContractual}` : t.nombre, value: t.id })),
  );

  protected readonly pozoSeleccionado = computed<Pozo | undefined>(() =>
    this.pozos().find(p => p.id === this.pozoId()),
  );

  protected readonly bloqueNombre = computed(() => this.pozoSeleccionado()?.bloque?.nombre ?? '');
  protected readonly rigContractual = computed(
    () => this.taladros().find(t => t.id === this.taladroId())?.rigContractual ?? '',
  );

  /** true cuando hay lo mínimo para guardar (pozo, y taladro si se exige). */
  readonly completo = computed(() => this.pozoId() !== null && (!this.requiereTaladro() || this.taladroId() !== null));

  protected onCampoChange(campoId: number | null): void {
    this.campoId.set(campoId);
    // Si el pozo elegido ya no pertenece al campo filtrado, se limpia.
    const pozo = this.pozoSeleccionado();
    if (pozo && campoId && pozo.campoId !== campoId) {
      this.pozoId.set(null);
    }
    this.emitir();
  }

  protected onPozoChange(pozoId: number | null): void {
    this.pozoId.set(pozoId);
    const pozo = this.pozos().find(p => p.id === pozoId);
    if (pozo) this.campoId.set(pozo.campoId);
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
    });
  }
}
