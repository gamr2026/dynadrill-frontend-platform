import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DynadrillSelectComponent, type DynadrillSelectOption } from '@digitec-it-projects/dynadrill-ui';
import { forkJoin } from 'rxjs';
import type { LugarSeleccion } from '../../models/lugar.model';
import { CatalogosPlataformaService } from '../../../features/facturacion/pedidos-comercial/services/catalogos-plataforma.service';

const PREFIJO_BODEGA = 'b:';
const PREFIJO_POZO = 'p:';

/** Elige una bodega o un pozo del catálogo con un solo selector con búsqueda (las bodegas primero, luego los pozos). */
@Component({
  selector: 'app-lugar-selector',
  imports: [DynadrillSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dynadrill-select
      [label]="label()"
      [placeholder]="placeholder()"
      [options]="opciones()"
      [value]="valorInterno()"
      [searchable]="true"
      [disabled]="disabled()"
      (valueChange)="elegir($any($event))"
    />
  `,
})
export class LugarSelectorComponent {
  private readonly catalogos = inject(CatalogosPlataformaService);

  readonly label = input('Lugar');
  readonly placeholder = input('Seleccione una bodega o un pozo');
  readonly disabled = input(false);
  /** Selección actual (`{ bodegaId }` o `{ pozoId }`), o `null` si no hay. */
  readonly value = input<LugarSeleccion | null>(null);
  readonly valueChange = output<LugarSeleccion | null>();

  private readonly bodegas = signal<DynadrillSelectOption[]>([]);
  private readonly pozos = signal<DynadrillSelectOption[]>([]);

  protected readonly opciones = computed<DynadrillSelectOption[]>(() => [...this.bodegas(), ...this.pozos()]);
  protected readonly valorInterno = computed<string | null>(() => {
    const v = this.value();
    if (v?.bodegaId) return PREFIJO_BODEGA + v.bodegaId;
    if (v?.pozoId) return PREFIJO_POZO + v.pozoId;
    return null;
  });

  constructor() {
    forkJoin({ bodegas: this.catalogos.bodegas(), pozos: this.catalogos.pozos() }).subscribe(({ bodegas, pozos }) => {
      this.bodegas.set(bodegas.map((b) => ({ label: `Bodega · ${b.nombre}`, value: PREFIJO_BODEGA + b.id })));
      this.pozos.set(
        pozos
          .filter((p) => p.habilitado)
          .map((p) => ({ label: `Pozo · ${p.codigo} — ${p.nombreCompleto}`, value: PREFIJO_POZO + p.id })),
      );
    });
  }

  protected elegir(valor: string | null): void {
    if (!valor) this.valueChange.emit(null);
    else if (valor.startsWith(PREFIJO_BODEGA)) this.valueChange.emit({ bodegaId: valor.slice(PREFIJO_BODEGA.length) });
    else if (valor.startsWith(PREFIJO_POZO)) this.valueChange.emit({ pozoId: valor.slice(PREFIJO_POZO.length) });
  }
}
