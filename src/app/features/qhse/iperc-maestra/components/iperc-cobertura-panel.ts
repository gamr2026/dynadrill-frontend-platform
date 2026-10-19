import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  DynadrillButtonComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { PedidosComercialService } from '../../../facturacion/pedidos-comercial/services/pedidos-comercial.service';
import { mensajeDeError } from '../../../../shared/utils/mensaje-error.util';
import { nombreDeCodigo, type ActividadResumen, type MapaCobertura } from '../models/iperc';
import { IpercMaestraService } from '../services/iperc-maestra.service';

interface FilaCobertura {
  codigo: string;
  nombre: string;
  seleccion: string[];
  original: string[];
}

/**
 * Cobertura: qué actividades de la matriz maestra exige cada tipo de servicio. El PTW de un pedido solo avanza si todas esas actividades
 * tienen una matriz aprobada y vigente. Los nombres de los tipos salen del catálogo de comercial; si la cuenta no puede leerlo se muestran
 * los códigos con formato legible.
 */
@Component({
  selector: 'app-iperc-cobertura-panel',
  imports: [DynadrillButtonComponent, DynadrillSelectComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dynadrill-text variant="caption"
      >Un tipo de servicio sin actividades no exige ninguna matriz al PTW. Elija las actividades que
      exige cada uno y guarde.</dynadrill-text
    >
    @for (f of filas(); track f.codigo) {
      <div class="cp__fila">
        <strong class="cp__tipo">{{ f.nombre }}</strong>
        <dynadrill-select
          class="cp__sel"
          placeholder="Sin actividades"
          [options]="opciones()"
          [value]="f.seleccion"
          [multiple]="true"
          [searchable]="true"
          [disabled]="!puedeEditar()"
          (valueChange)="elegir(f.codigo, $any($event) ?? [])"
        />
        @if (puedeEditar()) {
          <dynadrill-button
            variant="secondary"
            [disabled]="!cambio(f) || guardando() === f.codigo"
            (clicked)="guardar(f)"
            >{{ guardando() === f.codigo ? 'Guardando…' : 'Guardar' }}</dynadrill-button
          >
        }
      </div>
    } @empty {
      <dynadrill-text variant="caption">{{
        cargando() ? 'Consultando…' : 'Aún no hay tipos de servicio conocidos.'
      }}</dynadrill-text>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cp__fila {
      display: grid;
      grid-template-columns: 240px 1fr auto;
      gap: 12px;
      align-items: center;
    }
    .cp__sel {
      min-width: 0;
    }
    @media (max-width: 720px) {
      .cp__fila {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class IpercCoberturaPanel {
  private readonly servicio = inject(IpercMaestraService);
  private readonly comercial = inject(PedidosComercialService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly actividades = input.required<ActividadResumen[]>();
  readonly puedeEditar = input(false);

  protected readonly cargando = signal(true);
  protected readonly guardando = signal<string | null>(null);
  protected readonly filas = signal<FilaCobertura[]>([]);
  protected readonly opciones = computed<DynadrillSelectOption[]>(() =>
    this.actividades()
      .filter((a) => a.activo)
      .map((a) => ({ value: a.id, label: `${a.proceso.nombre} · ${a.nombre}` })),
  );

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    forkJoin({
      tipos: this.servicio.tiposDeServicio(),
      mapa: this.servicio.cobertura(),
      // los nombres viven en comercial; si la cuenta no puede leer su catálogo se usan los códigos
      catalogo: this.comercial.catalogoServicios().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ tipos, mapa, catalogo }) => {
        const nombres = new Map<string, string>();
        for (const l of catalogo?.lineas ?? [])
          for (const t of l.tipos) nombres.set(t.codigo, t.nombre);
        const codigos = [...new Set([...nombres.keys(), ...tipos, ...Object.keys(mapa)])];
        this.filas.set(this.armar(codigos, mapa, nombres));
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la cobertura.'));
      },
    });
  }

  private armar(
    codigos: string[],
    mapa: MapaCobertura,
    nombres: Map<string, string>,
  ): FilaCobertura[] {
    return codigos
      .map((codigo) => {
        const ids = (mapa[codigo] ?? []).map((a) => a.id);
        return {
          codigo,
          nombre: nombres.get(codigo) ?? nombreDeCodigo(codigo),
          seleccion: ids,
          original: ids,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  protected elegir(codigo: string, ids: string[]): void {
    this.filas.update((fs) => fs.map((f) => (f.codigo === codigo ? { ...f, seleccion: ids } : f)));
  }

  protected cambio(f: FilaCobertura): boolean {
    return [...f.seleccion].sort().join('|') !== [...f.original].sort().join('|');
  }

  protected guardar(f: FilaCobertura): void {
    this.guardando.set(f.codigo);
    this.servicio.fijarCobertura(f.codigo, f.seleccion).subscribe({
      next: (mapa) => {
        this.guardando.set(null);
        this.filas.update((fs) =>
          fs.map((x) =>
            x.codigo === f.codigo ? { ...x, original: (mapa[f.codigo] ?? []).map((a) => a.id) } : x,
          ),
        );
        this.notify.success('Guardado', `Cobertura de ${f.nombre} actualizada.`);
      },
      error: (err) => {
        this.guardando.set(null);
        this.notify.error(
          'No se pudo guardar',
          mensajeDeError(err, 'No se pudo guardar la cobertura.'),
        );
      },
    });
  }
}
