import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DynadrillIconButtonComponent } from '@digitec-it-projects/dynadrill-ui';
import type { ActividadTabla } from '../../../../shared/models/operativo-docs.model';
import { TABLAS_PLANTILLA } from '../../../../shared/utils/actividad-tablas';

/**
 * Tablas dentro de una actividad del Reporte diario (como las del Reporte Job real: volúmenes de bombeo, resumen del
 * día…). Se parte de un modelo ya armado o de una tabla en blanco; título, encabezados, filas y columnas son editables.
 * Es "tonto": no guarda nada, emite la lista nueva en cada cambio.
 */
@Component({
  selector: 'app-actividad-tablas-editor',
  imports: [DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (tabla of tablas(); track $index; let t = $index) {
      <div class="tablas-ed__tabla">
        <div class="tablas-ed__cabecera">
          <input
            type="text"
            class="tablas-ed__titulo"
            placeholder="Título de la tabla (opcional)"
            aria-label="Título de la tabla"
            [value]="tabla.titulo"
            (input)="cambiarTitulo(t, $any($event.target).value)"
          />
          <dynadrill-icon-button icon="delete" tooltip="Quitar la tabla" (clicked)="quitarTabla(t)" />
        </div>

        <div class="tablas-ed__scroll">
          <table class="tablas-ed__grid">
            <thead>
              <tr>
                @for (col of tabla.columnas; track $index; let c = $index) {
                  <th>
                    <div class="tablas-ed__th">
                      <input
                        type="text"
                        class="tablas-ed__celda tablas-ed__celda--head"
                        aria-label="Encabezado de la columna {{ c + 1 }}"
                        [value]="col"
                        (input)="cambiarColumna(t, c, $any($event.target).value)"
                      />
                      @if (tabla.columnas.length > 1) {
                        <dynadrill-icon-button icon="delete" tooltip="Quitar la columna" (clicked)="quitarColumna(t, c)" />
                      }
                    </div>
                  </th>
                }
                <th class="tablas-ed__acc"></th>
              </tr>
            </thead>
            <tbody>
              @for (fila of tabla.filas; track $index; let f = $index) {
                <tr>
                  @for (col of tabla.columnas; track $index; let c = $index) {
                    <td>
                      <input
                        type="text"
                        class="tablas-ed__celda"
                        aria-label="Fila {{ f + 1 }}, {{ col || 'columna ' + (c + 1) }}"
                        [value]="celda(fila, c)"
                        (input)="cambiarCelda(t, f, c, $any($event.target).value)"
                      />
                    </td>
                  }
                  <td class="tablas-ed__acc">
                    @if (tabla.filas.length > 1) {
                      <dynadrill-icon-button icon="delete" tooltip="Quitar la fila" (clicked)="quitarFila(t, f)" />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="tablas-ed__acciones">
          <button type="button" class="tablas-ed__btn" (click)="agregarFila(t)">+ Fila</button>
          <button type="button" class="tablas-ed__btn" (click)="agregarColumna(t)">+ Columna</button>
        </div>
      </div>
    }

    <div class="tablas-ed__agregar" role="group" aria-label="Agregar una tabla a la actividad">
      <span class="tablas-ed__agregar-label">Agregar tabla:</span>
      @for (p of plantillas; track p.id) {
        <button type="button" class="tablas-ed__btn tablas-ed__btn--agregar" (click)="agregarTabla(p.id)">{{ p.label }}</button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 8px;
    }

    .tablas-ed__tabla {
      margin-bottom: 12px;
      padding: 10px;
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 10px;
      background: var(--surface-muted, #faf9fc);
    }

    .tablas-ed__cabecera {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .tablas-ed__titulo {
      flex: 1;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--border, #d9d7e0);
      border-radius: 8px;
      font: inherit;
      font-weight: 600;
    }

    .tablas-ed__scroll {
      overflow-x: auto;
    }

    .tablas-ed__grid {
      width: 100%;
      border-collapse: collapse;
    }

    .tablas-ed__grid th,
    .tablas-ed__grid td {
      padding: 2px;
      vertical-align: middle;
    }

    .tablas-ed__th {
      display: flex;
      align-items: center;
    }

    .tablas-ed__celda {
      width: 100%;
      min-width: 110px;
      padding: 6px 8px;
      border: 1px solid var(--border, #d9d7e0);
      border-radius: 6px;
      background: var(--surface, #fff);
      font: inherit;
      font-size: 13px;

      &--head {
        font-weight: 600;
        background: var(--dynadrill-purple-tint, #f1ebf7);
      }
    }

    .tablas-ed__acc {
      width: 40px;
    }

    .tablas-ed__acciones,
    .tablas-ed__agregar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    .tablas-ed__agregar-label {
      font-size: 13px;
      color: var(--text-muted, #5c5870);
    }

    .tablas-ed__btn {
      padding: 4px 12px;
      border: 1px solid var(--border, #d9d7e0);
      border-radius: 8px;
      background: var(--surface, #fff);
      color: var(--text, #2c2b35);
      font: inherit;
      font-size: 13px;
      cursor: pointer;

      &:hover {
        background: var(--dynadrill-purple-tint, #f6f3f9);
      }

      &:focus-visible {
        outline: 2px solid var(--dynadrill-purple, #662e9b);
        outline-offset: 2px;
      }

      &--agregar {
        border-style: dashed;
      }
    }
  `,
})
export class ActividadTablasEditor {
  readonly tablas = input<ActividadTabla[]>([]);
  readonly tablasChange = output<ActividadTabla[]>();

  protected readonly plantillas = TABLAS_PLANTILLA;

  private actualizar(t: number, cambio: (tabla: ActividadTabla) => ActividadTabla): void {
    this.tablasChange.emit(this.tablas().map((tabla, i) => (i === t ? cambio(tabla) : tabla)));
  }

  /** Una fila vieja puede traer menos celdas que columnas: la que falta se muestra vacía. */
  protected celda(fila: string[], c: number): string {
    return fila[c] ?? '';
  }

  protected agregarTabla(id: string): void {
    const plantilla = this.plantillas.find(p => p.id === id);
    if (plantilla) this.tablasChange.emit([...this.tablas(), plantilla.crear()]);
  }

  protected quitarTabla(t: number): void {
    this.tablasChange.emit(this.tablas().filter((_, i) => i !== t));
  }

  protected cambiarTitulo(t: number, titulo: string): void {
    this.actualizar(t, tabla => ({ ...tabla, titulo }));
  }

  protected cambiarColumna(t: number, c: number, valor: string): void {
    this.actualizar(t, tabla => ({ ...tabla, columnas: tabla.columnas.map((x, i) => (i === c ? valor : x)) }));
  }

  protected cambiarCelda(t: number, f: number, c: number, valor: string): void {
    this.actualizar(t, tabla => ({
      ...tabla,
      filas: tabla.filas.map((fila, i) => (i === f ? tabla.columnas.map((_, j) => (j === c ? valor : (fila[j] ?? ''))) : fila)),
    }));
  }

  protected agregarFila(t: number): void {
    this.actualizar(t, tabla => ({ ...tabla, filas: [...tabla.filas, tabla.columnas.map(() => '')] }));
  }

  protected quitarFila(t: number, f: number): void {
    this.actualizar(t, tabla => ({ ...tabla, filas: tabla.filas.filter((_, i) => i !== f) }));
  }

  protected agregarColumna(t: number): void {
    this.actualizar(t, tabla => ({
      ...tabla,
      columnas: [...tabla.columnas, `Columna ${tabla.columnas.length + 1}`],
      filas: tabla.filas.map(fila => [...fila, '']),
    }));
  }

  protected quitarColumna(t: number, c: number): void {
    this.actualizar(t, tabla => ({
      ...tabla,
      columnas: tabla.columnas.filter((_, i) => i !== c),
      filas: tabla.filas.map(fila => fila.filter((_, i) => i !== c)),
    }));
  }
}
