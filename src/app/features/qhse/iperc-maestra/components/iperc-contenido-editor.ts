import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import {
  NC_OPCIONES,
  ND_OPCIONES,
  NE_OPCIONES,
  NIVEL_RIESGO_TONO,
  MOMENTO_CONTROL_ETIQUETA,
  TIPO_CONTROL_ETIQUETA,
  TIPOS_CONTROL,
  peligroVacio,
  tareaVacia,
  valorar,
  type CatalogosIperc,
  type ContenidoBorrador,
  type Ejes,
  type MomentoControl,
  type OpcionGtc,
  type PeligroBorrador,
  type TareaBorrador,
  type TipoCatalogo,
  type TipoControl,
} from '../models/iperc';

const opciones = (xs: OpcionGtc[]): DynadrillSelectOption[] =>
  xs.map((o) => ({ value: String(o.valor), label: `${o.valor} — ${o.label}` }));
const aNumero = (v: unknown): number | null =>
  v === '' || v === null || v === undefined ? null : Number(v);
type EjeClave = 'nd' | 'ne' | 'nc';
type Valoracion = 'inicial' | 'residual';

/**
 * Contenido de una matriz IPERC (tareas → peligros → valoración GTC 45 y controles). Es el mismo formulario para editar y, con
 * `editable = false`, para leer una matriz ya enviada o aprobada. Mientras se evalúa muestra al instante NP, NR, el nivel y la
 * aceptabilidad (misma cuenta del servidor).
 */
@Component({
  selector: 'app-iperc-contenido-editor',
  imports: [
    DynadrillButtonComponent,
    DynadrillCheckboxComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillTagComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (t of contenido().tareas; track $index; let i = $index) {
      <section class="ie__tarea">
        <header class="ie__tarea-cab">
          <strong>Tarea {{ i + 1 }}</strong>
          @if (editable()) {
            <dynadrill-button variant="secondary" (clicked)="quitarTarea(i)"
              >Quitar tarea</dynadrill-button
            >
          }
        </header>
        <div class="ie__rejilla">
          <dynadrill-input
            label="Tarea"
            [value]="t.descripcion"
            [disabled]="!editable()"
            (valueChange)="cambiarTarea(i, { descripcion: $event })"
          />
          <dynadrill-input
            label="Área o puesto de trabajo"
            [value]="t.areaPuesto"
            [disabled]="!editable()"
            (valueChange)="cambiarTarea(i, { areaPuesto: $event })"
          />
          <dynadrill-select
            label="Cargos expuestos"
            placeholder="Elija o escriba un cargo"
            [options]="opcionesCargos()"
            [value]="t.cargoIds"
            [multiple]="true"
            [creatable]="editable()"
            [disabled]="!editable()"
            (valueChange)="cambiarTarea(i, { cargoIds: $any($event) ?? [] })"
            (itemCreated)="crearCargo($event, i)"
          />
          <dynadrill-checkbox
            label="Tarea rutinaria"
            [checked]="t.rutinaria"
            [disabled]="!editable()"
            (checkedChange)="cambiarTarea(i, { rutinaria: $event })"
          />
        </div>

        @for (p of t.peligros; track $index; let j = $index) {
          <article class="ie__peligro">
            <header class="ie__tarea-cab">
              <span>Peligro {{ j + 1 }}</span>
              @if (editable()) {
                <dynadrill-button variant="secondary" (clicked)="quitarPeligro(i, j)"
                  >Quitar peligro</dynadrill-button
                >
              }
            </header>
            <div class="ie__rejilla">
              <dynadrill-input
                label="Peligro identificado"
                [value]="p.descripcion"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { descripcion: $event })"
              />
              <dynadrill-select
                label="Clasificación"
                placeholder="Elija"
                [options]="opcionesClasificacion()"
                [value]="p.clasificacionId"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { clasificacionId: $any($event) ?? '' })"
              />
              <dynadrill-input
                label="Fuente de riesgo"
                [value]="p.fuenteRiesgo"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { fuenteRiesgo: $event })"
              />
              <dynadrill-select
                label="Generado en"
                placeholder="Elija"
                [options]="opcionesGeneradoEn()"
                [value]="p.generadoEnId"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { generadoEnId: $any($event) ?? '' })"
              />
              <dynadrill-input
                label="Efectos posibles"
                [value]="p.efectosPosibles"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { efectosPosibles: $event })"
              />
              <dynadrill-input
                label="Peor consecuencia"
                [value]="p.peorConsecuencia"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { peorConsecuencia: $event })"
              />
              <dynadrill-input
                label="N.º de expuestos"
                [value]="p.numeroExpuestos === null ? '' : String(p.numeroExpuestos)"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { numeroExpuestos: aNumero($event) })"
              />
              <dynadrill-checkbox
                label="Existe requisito legal específico"
                [checked]="p.requisitoLegal"
                [disabled]="!editable()"
                (checkedChange)="cambiarPeligro(i, j, { requisitoLegal: $event })"
              />
              <dynadrill-input
                label="Controles existentes — fuente"
                [value]="p.controlExistenteFuente"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { controlExistenteFuente: $event })"
              />
              <dynadrill-input
                label="Controles existentes — medio"
                [value]="p.controlExistenteMedio"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { controlExistenteMedio: $event })"
              />
              <dynadrill-input
                label="Controles existentes — individuo"
                [value]="p.controlExistenteIndividuo"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { controlExistenteIndividuo: $event })"
              />
              <dynadrill-input
                label="Seguimiento"
                [value]="p.seguimiento"
                [disabled]="!editable()"
                (valueChange)="cambiarPeligro(i, j, { seguimiento: $event })"
              />
            </div>

            @for (v of valoraciones; track v) {
              <div class="ie__valoracion">
                <strong>{{
                  v === 'inicial'
                    ? 'Riesgo inicial'
                    : 'Riesgo residual (con los controles aplicados)'
                }}</strong>
                <div class="ie__rejilla ie__rejilla--3">
                  <dynadrill-select
                    label="Deficiencia (ND)"
                    placeholder="—"
                    [options]="opcionesNd"
                    [value]="texto(p[v].nd)"
                    [disabled]="!editable()"
                    (valueChange)="cambiarEje(i, j, v, 'nd', $any($event))"
                  />
                  <dynadrill-select
                    label="Exposición (NE)"
                    placeholder="—"
                    [options]="opcionesNe"
                    [value]="texto(p[v].ne)"
                    [disabled]="!editable()"
                    (valueChange)="cambiarEje(i, j, v, 'ne', $any($event))"
                  />
                  <dynadrill-select
                    label="Consecuencia (NC)"
                    placeholder="—"
                    [options]="opcionesNc"
                    [value]="texto(p[v].nc)"
                    [disabled]="!editable()"
                    (valueChange)="cambiarEje(i, j, v, 'nc', $any($event))"
                  />
                </div>
                @if (calcular(p[v]); as c) {
                  <div class="ie__resultado">
                    <span>NP {{ c.np }}</span>
                    <span>NR {{ c.nr }}</span>
                    <dynadrill-tag [variant]="tono(c.nivel)">Nivel {{ c.nivel }}</dynadrill-tag>
                    <span class="ie__meta">{{ c.aceptabilidad }}</span>
                  </div>
                } @else {
                  <dynadrill-text variant="caption"
                    >Sin valorar: elija los tres niveles.</dynadrill-text
                  >
                }
              </div>
            }
            <dynadrill-input
              label="Seguimiento del riesgo residual"
              [value]="p.seguimientoResidual"
              [disabled]="!editable()"
              (valueChange)="cambiarPeligro(i, j, { seguimientoResidual: $event })"
            />

            <div class="ie__controles">
              <strong>Controles</strong>
              @for (c of p.controles; track $index; let k = $index) {
                <div class="ie__control">
                  <dynadrill-select
                    label="Cuándo"
                    [options]="opcionesMomento"
                    [value]="c.momento"
                    [disabled]="!editable()"
                    (valueChange)="cambiarControl(i, j, k, { momento: $any($event) })"
                  />
                  <dynadrill-select
                    label="Tipo"
                    [options]="opcionesTipoControl"
                    [value]="c.tipo"
                    [disabled]="!editable()"
                    (valueChange)="cambiarControl(i, j, k, { tipo: $any($event) })"
                  />
                  <dynadrill-textarea
                    label="Descripción"
                    [rows]="2"
                    [value]="c.descripcion"
                    [disabled]="!editable()"
                    (valueChange)="cambiarControl(i, j, k, { descripcion: $event })"
                  />
                  @if (editable()) {
                    <dynadrill-button variant="secondary" (clicked)="quitarControl(i, j, k)"
                      >Quitar</dynadrill-button
                    >
                  }
                </div>
              }
              @if (editable()) {
                <dynadrill-button variant="secondary" (clicked)="agregarControl(i, j)"
                  >+ Agregar control</dynadrill-button
                >
              }
            </div>
          </article>
        }
        @if (editable()) {
          <dynadrill-button variant="secondary" (clicked)="agregarPeligro(i)"
            >+ Agregar peligro</dynadrill-button
          >
        }
      </section>
    }
    @if (editable()) {
      <dynadrill-button (clicked)="agregarTarea()">+ Agregar tarea</dynadrill-button>
    } @else if (!contenido().tareas.length) {
      <dynadrill-text variant="caption">Esta matriz aún no tiene tareas.</dynadrill-text>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .ie__tarea {
      border: 1px solid #ecebf1;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .ie__tarea-cab {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .ie__peligro {
      border-left: 3px solid #d8d4ee;
      padding: 8px 0 8px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .ie__rejilla {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .ie__rejilla--3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .ie__valoracion {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #faf9fd;
      border-radius: 10px;
      padding: 12px;
    }
    .ie__resultado {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }
    .ie__meta {
      color: #6b6a77;
      font-size: 12px;
    }
    .ie__controles {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ie__control {
      display: grid;
      grid-template-columns: 1fr 1fr 2fr auto;
      gap: 10px;
      align-items: end;
    }
    @media (max-width: 720px) {
      .ie__rejilla,
      .ie__rejilla--3,
      .ie__control {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class IpercContenidoEditor {
  readonly contenido = model.required<ContenidoBorrador>();
  readonly catalogos = input.required<CatalogosIperc>();
  readonly editable = input(false);
  /** Pide dar de alta un catálogo (p. ej. un cargo nuevo) y devuelve su id al terminar. */
  readonly altaCatalogo = output<{
    tipo: TipoCatalogo;
    nombre: string;
    alTerminar: (id: string) => void;
  }>();

  protected readonly valoraciones: Valoracion[] = ['inicial', 'residual'];
  protected readonly opcionesNd = opciones(ND_OPCIONES);
  protected readonly opcionesNe = opciones(NE_OPCIONES);
  protected readonly opcionesNc = opciones(NC_OPCIONES);
  protected readonly opcionesMomento: DynadrillSelectOption[] = (
    Object.keys(MOMENTO_CONTROL_ETIQUETA) as MomentoControl[]
  ).map((m) => ({ value: m, label: MOMENTO_CONTROL_ETIQUETA[m] }));
  protected readonly opcionesTipoControl: DynadrillSelectOption[] = TIPOS_CONTROL.map((t) => ({
    value: t,
    label: TIPO_CONTROL_ETIQUETA[t],
  }));
  protected readonly opcionesCargos = computed<DynadrillSelectOption[]>(() =>
    this.catalogos().cargos.map((c) => ({ value: c.id, label: c.nombre })),
  );
  protected readonly opcionesClasificacion = computed<DynadrillSelectOption[]>(() =>
    this.catalogos().clasificaciones.map((c) => ({ value: c.id, label: c.nombre })),
  );
  protected readonly opcionesGeneradoEn = computed<DynadrillSelectOption[]>(() =>
    this.catalogos().generadoEn.map((c) => ({ value: c.id, label: c.nombre })),
  );

  protected readonly aNumero = aNumero;
  protected readonly String = String;
  protected readonly texto = (n: number | null): string => (n === null ? '' : String(n));
  protected readonly calcular = (e: Ejes) => valorar(e);
  protected readonly tono = (n: 'I' | 'II' | 'III' | 'IV'): DynadrillTagVariant =>
    NIVEL_RIESGO_TONO[n] as DynadrillTagVariant;

  private actualizar(cambio: (c: ContenidoBorrador) => void): void {
    const copia = structuredClone(this.contenido());
    cambio(copia);
    this.contenido.set(copia);
  }

  protected agregarTarea(): void {
    this.actualizar((c) =>
      c.tareas.push(tareaVacia(this.catalogos().clasificaciones[0]?.id ?? '')),
    );
  }
  protected quitarTarea(i: number): void {
    this.actualizar((c) => c.tareas.splice(i, 1));
  }
  protected cambiarTarea(i: number, cambio: Partial<TareaBorrador>): void {
    this.actualizar((c) => Object.assign(c.tareas[i], cambio));
  }
  protected agregarPeligro(i: number): void {
    this.actualizar((c) =>
      c.tareas[i].peligros.push(peligroVacio(this.catalogos().clasificaciones[0]?.id ?? '')),
    );
  }
  protected quitarPeligro(i: number, j: number): void {
    this.actualizar((c) => c.tareas[i].peligros.splice(j, 1));
  }
  protected cambiarPeligro(i: number, j: number, cambio: Partial<PeligroBorrador>): void {
    this.actualizar((c) => Object.assign(c.tareas[i].peligros[j], cambio));
  }
  protected cambiarEje(i: number, j: number, v: Valoracion, eje: EjeClave, valor: unknown): void {
    this.actualizar((c) => (c.tareas[i].peligros[j][v][eje] = aNumero(valor)));
  }
  protected agregarControl(i: number, j: number): void {
    this.actualizar((c) =>
      c.tareas[i].peligros[j].controles.push({
        momento: 'propuesto',
        tipo: 'administrativo' as TipoControl,
        descripcion: '',
      }),
    );
  }
  protected quitarControl(i: number, j: number, k: number): void {
    this.actualizar((c) => c.tareas[i].peligros[j].controles.splice(k, 1));
  }
  protected cambiarControl(
    i: number,
    j: number,
    k: number,
    cambio: Partial<{ momento: MomentoControl; tipo: TipoControl; descripcion: string }>,
  ): void {
    this.actualizar((c) => Object.assign(c.tareas[i].peligros[j].controles[k], cambio));
  }

  /** Un cargo nuevo escrito en el selector: se da de alta en el catálogo y se agrega a la tarea. */
  protected crearCargo(nombre: string, i: number): void {
    this.altaCatalogo.emit({
      tipo: 'cargo',
      nombre,
      alTerminar: (id) => this.actualizar((c) => c.tareas[i].cargoIds.push(id)),
    });
  }
}
