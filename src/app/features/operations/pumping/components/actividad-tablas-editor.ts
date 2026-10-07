import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DynadrillIconButtonComponent } from '@digitec-it-projects/dynadrill-ui';
import type { ActividadTabla } from '../../../../shared/models/operativo-docs.model';
import { crearTablaVacia } from '../../../../shared/utils/actividad-tablas';

/**
 * Tablas dentro de una actividad del Reporte diario (como las del Reporte Job real: volúmenes de bombeo, resumen del
 * día…). Se agrega una tabla en blanco; título, encabezados, filas y columnas son editables.
 * Va a todo el ancho de la actividad (no dentro de la columna angosta del detalle). Es "tonto": no guarda nada,
 * emite la lista nueva en cada cambio.
 */
@Component({
  selector: 'app-actividad-tablas-editor',
  imports: [DynadrillIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ted" aria-label="Tablas de la actividad">
      <header class="ted__seccion">
        <span class="ted__seccion-titulo">Tablas de la actividad</span>
        <span class="ted__seccion-nota">Opcional · volúmenes de bombeo, resumen del día… (o cárgalas desde el Excel)</span>
      </header>

      @for (tabla of tablas(); track $index; let t = $index) {
        <article class="ted__tabla">
          <div class="ted__tabla-cabecera">
            <label class="ted__campo">
              <span class="ted__etiqueta">Título de la tabla</span>
              <input
                type="text"
                class="ted__input ted__input--titulo"
                placeholder="Ej. BOMBEO"
                [value]="tabla.titulo"
                (input)="cambiarTitulo(t, $any($event.target).value)"
              />
            </label>
            <dynadrill-icon-button icon="delete" tooltip="Quitar la tabla" (clicked)="quitarTabla(t)" />
          </div>

          <div class="ted__scroll">
            <table class="ted__grid">
              <thead>
                <tr>
                  @for (col of tabla.columnas; track $index; let c = $index) {
                    <th scope="col">
                      <div class="ted__th">
                        <input
                          type="text"
                          class="ted__input ted__input--head"
                          [attr.aria-label]="'Encabezado de la columna ' + (c + 1)"
                          [value]="col"
                          (input)="cambiarColumna(t, c, $any($event.target).value)"
                        />
                        @if (tabla.columnas.length > 1) {
                          <button type="button" class="ted__x" title="Quitar la columna" aria-label="Quitar la columna" (click)="quitarColumna(t, c)">×</button>
                        }
                      </div>
                    </th>
                  }
                  <th class="ted__acc"></th>
                </tr>
              </thead>
              <tbody>
                @for (fila of tabla.filas; track $index; let f = $index) {
                  <tr>
                    @for (col of tabla.columnas; track $index; let c = $index) {
                      <td>
                        <input
                          type="text"
                          class="ted__input"
                          [attr.aria-label]="'Fila ' + (f + 1) + ', ' + (col || 'columna ' + (c + 1))"
                          [value]="celda(fila, c)"
                          (input)="cambiarCelda(t, f, c, $any($event.target).value)"
                        />
                      </td>
                    }
                    <td class="ted__acc">
                      @if (tabla.filas.length > 1) {
                        <button type="button" class="ted__x" title="Quitar la fila" aria-label="Quitar la fila" (click)="quitarFila(t, f)">×</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="ted__acciones">
            <button type="button" class="ted__btn" (click)="agregarFila(t)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
              Agregar fila
            </button>
            <button type="button" class="ted__btn" (click)="agregarColumna(t)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
              Agregar columna
            </button>
          </div>
        </article>
      }

      <div class="ted__agregar">
        <button type="button" class="ted__chip" (click)="agregarTabla()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" /></svg>
          Agregar tabla
        </button>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .ted {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px dashed var(--border, #d9d7e0);
    }

    .ted__seccion {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 10px;
    }

    .ted__seccion-titulo {
      font-size: 14px;
      font-weight: 700;
      color: var(--text, #2c2b35);
    }

    .ted__seccion-nota {
      font-size: 12px;
      color: var(--text-muted, #5c5870);
    }

    .ted__tabla {
      padding: 16px;
      border: 1px solid var(--border, #e5e4ea);
      border-radius: 12px;
      background: var(--surface, #fff);
      box-shadow: 0 1px 2px rgba(44, 43, 53, 0.05);
    }

    .ted__tabla-cabecera {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 14px;
    }

    .ted__campo {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .ted__etiqueta {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted, #5c5870);
    }

    .ted__scroll {
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .ted__grid {
      width: calc(100% + 12px);
      border-collapse: separate;
      border-spacing: 6px;
      margin: -6px;
    }

    .ted__th {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .ted__input {
      width: 100%;
      min-width: 150px;
      height: 38px;
      padding: 0 10px;
      border: 1px solid var(--border, #d9d7e0);
      border-radius: 8px;
      background: var(--surface, #fff);
      color: var(--text, #2c2b35);
      font: inherit;
      font-size: 14px;

      &:hover {
        border-color: var(--dynadrill-purple, #662e9b);
      }

      &:focus-visible {
        outline: 2px solid var(--dynadrill-purple, #662e9b);
        outline-offset: 1px;
      }

      &--titulo {
        font-weight: 600;
      }

      &--head {
        border-color: transparent;
        background: var(--dynadrill-purple-tint, #efe7f6);
        font-weight: 700;
        color: var(--dynadrill-purple, #662e9b);
      }
    }

    .ted__acc {
      width: 36px;
      min-width: 36px;
      text-align: center;
    }

    .ted__x {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--text-muted, #5c5870);
      font-size: 20px;
      line-height: 1;
      cursor: pointer;

      &:hover {
        background: #fde8e8;
        color: #b42318;
      }

      &:focus-visible {
        outline: 2px solid var(--dynadrill-purple, #662e9b);
      }
    }

    .ted__acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }

    .ted__btn,
    .ted__chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 999px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--dynadrill-purple, #662e9b);
        outline-offset: 2px;
      }
    }

    .ted__btn {
      border: 1px solid var(--border, #d9d7e0);
      background: var(--surface, #fff);
      color: var(--text, #2c2b35);

      &:hover {
        background: var(--dynadrill-purple-tint, #f6f3f9);
      }
    }

    .ted__agregar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .ted__chip {
      border: 1px dashed var(--dynadrill-purple, #662e9b);
      background: transparent;
      color: var(--dynadrill-purple, #662e9b);

      &:hover {
        background: var(--dynadrill-purple-tint, #f6f3f9);
      }
    }

    @media (max-width: 840px) {
      .ted__tabla {
        padding: 12px;
      }

      .ted__input {
        min-width: 130px;
      }
    }
  `,
})
export class ActividadTablasEditor {
  readonly tablas = input<ActividadTabla[]>([]);
  readonly tablasChange = output<ActividadTabla[]>();

  private actualizar(t: number, cambio: (tabla: ActividadTabla) => ActividadTabla): void {
    this.tablasChange.emit(this.tablas().map((tabla, i) => (i === t ? cambio(tabla) : tabla)));
  }

  /** Una fila vieja puede traer menos celdas que columnas: la que falta se muestra vacía. */
  protected celda(fila: string[], c: number): string {
    return fila[c] ?? '';
  }

  protected agregarTabla(): void {
    this.tablasChange.emit([...this.tablas(), crearTablaVacia()]);
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
      filas: tabla.filas.map((fila, i) => (i === f ? tabla.columnas.map((_, j) => (j === c ? valor : this.celda(fila, j))) : fila)),
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
