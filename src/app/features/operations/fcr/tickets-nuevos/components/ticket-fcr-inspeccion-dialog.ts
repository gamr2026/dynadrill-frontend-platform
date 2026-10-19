import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { concatMap, from, last, of, type Observable } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  ESTADO_INSPECCION_LABELS,
  ESTADO_INSPECCION_TONO,
  FIRMAS,
  FIRMA_LABELS,
  RESPONSABLE_LABELS,
  RESULTADO_LABELS,
  faltaParaFirmar,
  inspeccionEditable,
  mensajeErrorTicket,
  puedeFirmar,
  siguienteFirma,
  type InspeccionHerramienta,
  type ResponsableTrabajo,
  type ResultadoParte,
  type RolFirma,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

export interface TicketFcrInspeccionDialogData {
  ticketId: string;
  inspeccionId: string;
}

interface FilaParte {
  id: string;
  visual: ResultadoParte | null;
  endResultado: ResultadoParte | null;
  cambio: string;
  accion: string;
  cambiada: boolean;
}

const RESPONSABLES: DynadrillSelectOption[] = (
  Object.keys(RESPONSABLE_LABELS) as ResponsableTrabajo[]
).map((r) => ({ label: RESPONSABLE_LABELS[r], value: r }));
const RESULTADOS: DynadrillSelectOption[] = (Object.keys(RESULTADO_LABELS) as ResultadoParte[]).map(
  (r) => ({ label: RESULTADO_LABELS[r], value: r }),
);

/**
 * «Inspección y reparación de herramientas» de una herramienta (entrada SERVICIOS). Las partes son una copia fija de las del artículo; si
 * falta una, quien inspecciona la agrega a mano (y solo esas se pueden quitar). Tres firmas en orden con la cuenta de quien firma: reparado
 * por (el operador que inspecciona; desde ahí los datos quedan bloqueados), revisado por (el Supervisor del ticket) y liberado por QHSE.
 */
@Component({
  selector: 'app-ticket-fcr-inspeccion-dialog',
  imports: [
    DatePipe,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillTextareaComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-sheet-mobile' },
  template: `
    <dynadrill-spinner mode="overlay" [spinning]="cargando() || ocupado()" tip="Procesando…">
      @if (error(); as e) {
        <dynadrill-banner variant="critical" [message]="e" />
      }
      @if (insp(); as i) {
        <div class="i">
          <header class="i__cabecera">
            <div>
              <strong>{{ i.descripcionHerramienta }}</strong>
              <span class="i__meta"> · {{ i.codigoHerramienta }} · versión {{ i.version }}</span>
              <div class="i__meta">{{ i.cliente ?? '—' }} · Pozo {{ i.pozo ?? '—' }}</div>
            </div>
            <dynadrill-tag [label]="estadoTxt()" [variant]="estadoTono()" [uppercase]="false" />
          </header>

          @if (i.motivoRechazo) {
            <dynadrill-banner
              variant="warning"
              [message]="'Devuelta por el Supervisor de Operaciones: ' + i.motivoRechazo"
            />
          }
          @if (editable() && !puedeEditar) {
            <dynadrill-text variant="caption"
              >Solo el operador asignado a la inspección llena los datos; usted puede firmar si le
              corresponde.</dynadrill-text
            >
          } @else if (!editable()) {
            <dynadrill-text variant="caption">{{
              i.estado === 'borrador'
                ? '«Reparado por» ya firmó: los datos y las partes quedaron bloqueados.'
                : 'La inspección ya fue enviada: solo se consulta.'
            }}</dynadrill-text>
          }

          <section class="i__bloque" aria-label="Datos de la inspección">
            <dynadrill-input
              label="Número de serie"
              [value]="serie()"
              [disabled]="!puedeLlenar()"
              (valueChange)="serie.set($event)"
            />
            <label class="i__fecha"
              ><span>Fecha de inspección</span
              ><input
                type="date"
                [value]="fechaInsp()"
                [disabled]="!puedeLlenar()"
                (input)="fechaInsp.set($any($event.target).value)"
            /></label>
            <label class="i__fecha"
              ><span>Fecha de envío</span
              ><input
                type="date"
                [value]="fechaEnvio()"
                [disabled]="!puedeLlenar()"
                (input)="fechaEnvio.set($any($event.target).value)"
            /></label>
            <dynadrill-select
              label="Inspeccionado por"
              placeholder="Elija"
              [options]="responsables"
              [value]="inspeccionadoPor()"
              [disabled]="!puedeLlenar()"
              (valueChange)="inspeccionadoPor.set($any($event))"
            />
            <dynadrill-select
              label="Reparado por"
              placeholder="Elija"
              [options]="responsables"
              [value]="reparadoPor()"
              [disabled]="!puedeLlenar()"
              (valueChange)="reparadoPor.set($any($event))"
            />
            @if (i.fechaReparacion) {
              <div class="i__fecha">
                <span>Fecha de revisión (al firmar «reparado por»)</span
                ><strong>{{ i.fechaReparacion }}</strong>
              </div>
            }
          </section>
          <dynadrill-textarea
            label="Nota general"
            [rows]="2"
            [value]="notas()"
            [disabled]="!puedeLlenar()"
            (valueChange)="notas.set($event)"
          />

          <section aria-label="Partes de la herramienta">
            <h3>Partes</h3>
            @if (!i.partes.length) {
              <dynadrill-text variant="caption"
                >La herramienta no trae partes en el catálogo: agréguelas a mano
                abajo.</dynadrill-text
              >
            } @else {
              <div class="i__tabla">
                <table>
                  <caption class="sr-only">
                    Partes y resultados de la inspección
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Ítem</th>
                      <th scope="col">Código</th>
                      <th scope="col">Descripción</th>
                      <th scope="col">Cant.</th>
                      <th scope="col">Visual</th>
                      <th scope="col">END</th>
                      <th scope="col">Cambio (cant.)</th>
                      <th scope="col">Acción</th>
                      <th scope="col"><span class="sr-only">Quitar</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of i.partes; track p.id) {
                      @if (fila(p.id); as f) {
                        <tr>
                          <td>{{ p.item }}</td>
                          <td>{{ p.codigo ?? '—' }}</td>
                          <td>
                            {{ p.descripcion }}
                            @if (p.manual) {
                              <span class="i__meta"> (a mano)</span>
                            }
                          </td>
                          <td>{{ p.cantidadEsperada }}</td>
                          <td>
                            <dynadrill-select
                              label="Visual"
                              [options]="resultados"
                              [value]="f.visual"
                              [disabled]="!puedeLlenar()"
                              (valueChange)="cambiar(p.id, 'visual', $any($event))"
                            />
                          </td>
                          <td>
                            <dynadrill-select
                              label="END"
                              [options]="resultados"
                              [value]="f.endResultado"
                              [disabled]="!puedeLlenar()"
                              (valueChange)="cambiar(p.id, 'endResultado', $any($event))"
                            />
                          </td>
                          <td>
                            <dynadrill-input
                              label="Cambio"
                              type="number"
                              [value]="f.cambio"
                              [disabled]="!puedeLlenar()"
                              (valueChange)="cambiar(p.id, 'cambio', $event)"
                            />
                          </td>
                          <td>
                            <dynadrill-input
                              label="Acción"
                              [value]="f.accion"
                              [disabled]="!puedeLlenar()"
                              (valueChange)="cambiar(p.id, 'accion', $event)"
                            />
                          </td>
                          <td>
                            @if (p.manual && puedeLlenar()) {
                              <button
                                type="button"
                                class="i__quitar"
                                [attr.aria-label]="'Quitar la parte ' + p.descripcion"
                                (click)="quitarParte(p.id)"
                              >
                                Quitar
                              </button>
                            }
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            }
            @if (puedeLlenar()) {
              <div class="i__nueva">
                <dynadrill-input
                  label="Parte a mano (descripción)"
                  [value]="nuevaDescripcion()"
                  (valueChange)="nuevaDescripcion.set($event)"
                />
                <dynadrill-input
                  label="Código (opcional)"
                  [value]="nuevoCodigo()"
                  (valueChange)="nuevoCodigo.set($event)"
                />
                <dynadrill-button
                  variant="secondary"
                  size="small"
                  [disabled]="!nuevaDescripcion().trim()"
                  (clicked)="agregarParte()"
                  >Agregar parte</dynadrill-button
                >
              </div>
            }
          </section>

          <section aria-label="Firmas" class="i__firmas">
            <h3>Firmas</h3>
            @for (rol of firmas; track rol) {
              <div class="i__firma">
                <strong>{{ etiquetaFirma(rol) }}</strong>
                @if (i.firmas[rol]; as f) {
                  <span>{{ f.nombre }} · {{ f.firmadaAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                } @else if (rol === siguiente() && i.estado === 'borrador' && puedeFirmarRol(rol)) {
                  <dynadrill-button
                    variant="primary"
                    size="small"
                    [disabled]="ocupado()"
                    (clicked)="firmar(rol)"
                    >Firmar como {{ etiquetaFirma(rol) }}</dynadrill-button
                  >
                } @else {
                  <span class="i__meta">Pendiente</span>
                }
              </div>
            }
            @if (problemaFirma(); as p) {
              <dynadrill-text variant="caption" role="status">{{ p }}</dynadrill-text>
            }
          </section>
        </div>
        <footer class="i__acciones">
          <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
          @if (puedeLlenar()) {
            <dynadrill-button variant="secondary" [disabled]="ocupado()" (clicked)="guardarTodo()"
              >Guardar datos y resultados</dynadrill-button
            >
          }
          @if (puedeEnviar()) {
            <dynadrill-button variant="primary" [disabled]="ocupado()" (clicked)="enviar()"
              >Enviar inspección</dynadrill-button
            >
          }
        </footer>
      }
    </dynadrill-spinner>
  `,
  styles: `
    .i {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .i__cabecera {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    .i__meta {
      font-size: 12px;
      color: #5c5870;
    }
    .i__bloque {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px 16px;
      align-items: end;
    }
    .i__fecha {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
      color: #5c5870;
    }
    .i__fecha input {
      padding: 8px 10px;
      border: 1px solid #ccc9d9;
      border-radius: 8px;
      font: inherit;
    }
    .i__tabla {
      overflow-x: auto;
    }
    .i__tabla table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .i__tabla th,
    .i__tabla td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #ecebf1;
      vertical-align: top;
    }
    .i__quitar {
      background: none;
      border: 0;
      color: #5c5870;
      text-decoration: underline;
      cursor: pointer;
    }
    .i__nueva {
      display: grid;
      grid-template-columns: 2fr 1fr auto;
      gap: 8px;
      align-items: end;
      margin-top: 10px;
    }
    .i__firmas {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .i__firma {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
    }
    .i__acciones {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #ecebf1;
    }
    h3 {
      margin: 4px 0 8px;
      font-size: 14px;
    }
  `,
})
export class TicketFcrInspeccionDialog {
  private readonly servicio = inject(TicketsFcrService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<TicketFcrInspeccionDialog, boolean | undefined>);
  protected readonly data = inject<TicketFcrInspeccionDialogData & { puedeEditar?: boolean }>(
    NZ_MODAL_DATA,
  );

  protected readonly responsables = RESPONSABLES;
  protected readonly resultados = RESULTADOS;
  protected readonly firmas = FIRMAS;
  protected readonly etiquetaFirma = (r: RolFirma) => FIRMA_LABELS[r];
  /** El operador asignado a la inspección (o Superadmin) llena los datos. */
  protected readonly puedeEditar = this.data.puedeEditar ?? false;

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly insp = signal<InspeccionHerramienta | null>(null);
  private hubo = false;

  // datos editables
  protected readonly serie = signal('');
  protected readonly fechaInsp = signal('');
  protected readonly fechaEnvio = signal('');
  protected readonly inspeccionadoPor = signal<ResponsableTrabajo | null>(null);
  protected readonly reparadoPor = signal<ResponsableTrabajo | null>(null);
  protected readonly notas = signal('');
  private readonly filas = signal<FilaParte[]>([]);
  protected readonly nuevaDescripcion = signal('');
  protected readonly nuevoCodigo = signal('');

  protected readonly editable = computed(() => {
    const i = this.insp();
    return !!i && inspeccionEditable(i);
  });
  protected readonly puedeLlenar = computed(() => this.editable() && this.puedeEditar);
  protected readonly estadoTxt = computed(
    () => ESTADO_INSPECCION_LABELS[this.insp()?.estado ?? 'borrador'],
  );
  protected readonly estadoTono = computed(
    () => ESTADO_INSPECCION_TONO[this.insp()?.estado ?? 'borrador'],
  );
  protected readonly siguiente = computed(() => {
    const i = this.insp();
    return i ? siguienteFirma(i.firmas) : null;
  });
  protected readonly puedeEnviar = computed(() => {
    const i = this.insp();
    return !!i && i.estado === 'borrador' && this.puedeEditar && !siguienteFirma(i.firmas);
  });
  protected readonly problemaFirma = computed(() => {
    const i = this.insp();
    if (!i || i.estado !== 'borrador' || this.siguiente() !== 'reparado_por') return null;
    return faltaParaFirmar({
      inspeccionadoPor: this.inspeccionadoPor(),
      reparadoPor: this.reparadoPor(),
    });
  });

  constructor() {
    this.servicio.inspeccion(this.data.ticketId, this.data.inspeccionId).subscribe({
      next: (i) => {
        this.aplicar(i);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar la inspección.'));
      },
    });
  }

  protected fila(id: string): FilaParte | undefined {
    return this.filas().find((f) => f.id === id);
  }

  protected puedeFirmarRol(rol: RolFirma): boolean {
    return puedeFirmar(rol, this.auth.currentUser()?.roleCode);
  }

  protected cambiar(
    id: string,
    campo: 'visual' | 'endResultado' | 'cambio' | 'accion',
    valor: unknown,
  ): void {
    this.filas.update((l) =>
      l.map((f) =>
        f.id === id
          ? {
              ...f,
              [campo]:
                campo === 'cambio' || campo === 'accion'
                  ? String(valor ?? '')
                  : (valor as ResultadoParte | null),
              cambiada: true,
            }
          : f,
      ),
    );
  }

  private aplicar(i: InspeccionHerramienta): void {
    this.insp.set(i);
    this.serie.set(i.numeroSerie ?? '');
    this.fechaInsp.set(i.fechaInspeccion ?? '');
    this.fechaEnvio.set(i.fechaEnvio ?? '');
    this.inspeccionadoPor.set(i.inspeccionadoPor);
    this.reparadoPor.set(i.reparadoPor);
    this.notas.set(i.observaciones ?? '');
    this.filas.set(
      i.partes.map((p) => ({
        id: p.id,
        visual: p.visual,
        endResultado: p.endResultado,
        cambio: p.cambioCantidad === null ? '' : String(p.cambioCantidad),
        accion: p.accion ?? '',
        cambiada: false,
      })),
    );
  }

  /** Ejecuta una llamada con el indicador de «procesando» y deja el resultado como la inspección vigente. */
  private ejecutar(
    llamada: Observable<InspeccionHerramienta>,
    exito?: string,
    despues?: () => void,
  ): void {
    this.ocupado.set(true);
    this.error.set(null);
    llamada.subscribe({
      next: (i) => {
        this.ocupado.set(false);
        this.hubo = true;
        this.aplicar(i);
        if (exito) this.notify.success(exito, '');
        despues?.();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo completar la acción.'));
      },
    });
  }

  /** Guarda la cabecera y los resultados de las partes que cambiaron (una llamada tras otra). */
  private guardarPendiente(): Observable<InspeccionHerramienta> {
    const id = this.data.inspeccionId;
    const t = this.data.ticketId;
    const cabecera = {
      ...(this.fechaInsp() ? { fechaInspeccion: this.fechaInsp() } : {}),
      ...(this.fechaEnvio() ? { fechaEnvio: this.fechaEnvio() } : {}),
      ...(this.inspeccionadoPor() ? { inspeccionadoPor: this.inspeccionadoPor()! } : {}),
      ...(this.reparadoPor() ? { reparadoPor: this.reparadoPor()! } : {}),
      observaciones: this.notas(),
      numeroSerie: this.serie(),
    };
    const cambiadas = this.filas().filter((f) => f.cambiada);
    return this.servicio.guardarEncabezado(t, id, cabecera).pipe(
      concatMap((i) =>
        cambiadas.length
          ? from(cambiadas).pipe(
              concatMap((f) =>
                this.servicio.guardarParte(t, id, f.id, {
                  ...(f.visual ? { visual: f.visual } : {}),
                  ...(f.endResultado ? { endResultado: f.endResultado } : {}),
                  ...(f.cambio.trim() !== '' && !Number.isNaN(Number(f.cambio))
                    ? { cambioCantidad: Number(f.cambio) }
                    : {}),
                  ...(f.accion.trim() ? { accion: f.accion.trim() } : {}),
                }),
              ),
              last(),
            )
          : of(i),
      ),
    );
  }

  protected guardarTodo(): void {
    this.ejecutar(this.guardarPendiente(), 'Inspección guardada');
  }

  protected agregarParte(): void {
    const descripcion = this.nuevaDescripcion().trim();
    if (!descripcion) return;
    this.ejecutar(
      this.servicio.agregarParte(this.data.ticketId, this.data.inspeccionId, {
        descripcion,
        ...(this.nuevoCodigo().trim() ? { codigo: this.nuevoCodigo().trim() } : {}),
      }),
      undefined,
      () => {
        this.nuevaDescripcion.set('');
        this.nuevoCodigo.set('');
      },
    );
  }

  protected quitarParte(parteId: string): void {
    this.ejecutar(this.servicio.quitarParte(this.data.ticketId, this.data.inspeccionId, parteId));
  }

  protected firmar(rol: RolFirma): void {
    // «reparado por» certifica lo que se ve: primero se guarda todo
    const paso =
      rol === 'reparado_por' && this.puedeLlenar()
        ? this.guardarPendiente().pipe(
            concatMap(() => this.servicio.firmar(this.data.ticketId, this.data.inspeccionId, rol)),
          )
        : this.servicio.firmar(this.data.ticketId, this.data.inspeccionId, rol);
    this.ejecutar(paso, `Firmó ${FIRMA_LABELS[rol]}`);
  }

  protected enviar(): void {
    this.ejecutar(
      this.servicio.enviarInspeccion(this.data.ticketId, this.data.inspeccionId),
      'Inspección enviada',
    );
  }

  protected cerrar(): void {
    this.modalRef.close(this.hubo);
  }
}
