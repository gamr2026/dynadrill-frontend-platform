import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DynadrillInputComponent, DynadrillNotificationService, DynadrillSelectComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { CatalogosPlataformaService } from '../../services/catalogos-plataforma.service';
import {
  construirUbicacion,
  esTaladroRigless,
  OPCION_RIGLESS,
  type PozoPlataforma,
  type TaladroPlataforma,
  type UbicacionPedido,
} from '../../models/catalogos-plataforma.model';

/** Valor con el que se prellena el selector al editar (UUID del catálogo de plataforma). */
export interface UbicacionInicial {
  pozoId: string | null;
  taladroId: string | null;
  rigless: boolean;
}

/**
 * Selector de ubicación del pedido contra el catálogo de plataforma (UUID). Se elige el pozo (campo y bloque se
 * autocompletan) y el taladro; "RIGLESS" es un taladro del catálogo que se traduce a `rigless` sin taladro.
 */
@Component({
  selector: 'app-ubicacion-pedido-selector',
  imports: [DynadrillSelectComponent, DynadrillInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ubicacion">
      <dynadrill-select label="Pozo" placeholder="Seleccione el pozo" [options]="pozoOpciones()" [value]="pozoId()" [searchable]="true" (valueChange)="onPozo($any($event))" />
      <dynadrill-input label="Campo" [value]="campoNombre()" [disabled]="true" />
      <dynadrill-input label="Bloque" [value]="bloqueNombre()" [disabled]="true" />
      <dynadrill-select
        label="Taladro"
        [placeholder]="pozoId() === null ? 'Seleccione primero el pozo' : 'Seleccione el taladro (o RIGLESS)'"
        [options]="taladroOpciones()"
        [value]="taladroId()"
        [searchable]="true"
        [disabled]="pozoId() === null"
        (valueChange)="onTaladro($any($event))"
      />
    </div>
  `,
  styles: `
    .ubicacion { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    @media (max-width: 600px) { .ubicacion { grid-template-columns: 1fr; } }
  `,
})
export class UbicacionPedidoSelector {
  private readonly catalogos = inject(CatalogosPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly valorInicial = input<UbicacionInicial | null>(null);
  readonly seleccionChange = output<UbicacionPedido>();

  private readonly pozos = signal<PozoPlataforma[]>([]);
  private readonly taladros = signal<TaladroPlataforma[]>([]);
  protected readonly pozoId = signal<string | null>(null);
  protected readonly taladroId = signal<string | null>(null);
  private aplicado: UbicacionInicial | null | undefined;

  protected readonly pozoOpciones = computed<DynadrillSelectOption[]>(() =>
    this.pozos().filter(p => p.habilitado || p.id === this.pozoId()).map(p => ({ label: `${p.codigo} — ${p.nombreCompleto}`, value: p.id })),
  );
  /** "RIGLESS" va siempre primero (no depende del catálogo de taladros) y luego los taladros reales. */
  protected readonly taladroOpciones = computed<DynadrillSelectOption[]>(() => [
    { label: 'RIGLESS (sin taladro)', value: OPCION_RIGLESS },
    ...this.taladros()
      .filter(t => !esTaladroRigless(t.nombre) && (t.habilitado || t.id === this.taladroId()))
      .map(t => ({ label: t.rigContractual ? `${t.nombre} · ${t.rigContractual}` : t.nombre, value: t.id })),
  ]);
  private readonly pozo = computed(() => this.pozos().find(p => p.id === this.pozoId()));
  protected readonly campoNombre = computed(() => this.pozo()?.campo?.nombre ?? '');
  protected readonly bloqueNombre = computed(() => this.pozo()?.bloque?.nombre ?? '');

  constructor() {
    const falla = () => this.notify.error('Error', 'No se pudo cargar el catálogo de ubicaciones.');
    this.catalogos.pozos().subscribe({ next: p => this.pozos.set(p), error: falla });
    this.catalogos.taladros().subscribe({ next: t => this.taladros.set(t), error: falla });
    // El valor inicial puede llegar antes o después de los catálogos: se aplica cuando ambos están.
    effect(() => {
      const v = this.valorInicial();
      const listo = this.pozos().length > 0 && this.taladros().length > 0;
      untracked(() => {
        if (!v || !listo || v === this.aplicado) return;
        this.aplicado = v;
        this.pozoId.set(v.pozoId);
        this.taladroId.set(v.rigless ? OPCION_RIGLESS : v.taladroId);
        this.emitir();
      });
    });
  }

  protected onPozo(id: string | null): void {
    this.pozoId.set(id);
    if (!id) this.taladroId.set(null);
    this.emitir();
  }

  protected onTaladro(id: string | null): void {
    this.taladroId.set(id);
    this.emitir();
  }

  private emitir(): void {
    const sinTaladro = this.taladroId() === OPCION_RIGLESS;
    const taladro = sinTaladro ? undefined : this.taladros().find(t => t.id === this.taladroId());
    this.seleccionChange.emit(construirUbicacion(this.pozo(), taladro, [], sinTaladro));
  }
}
