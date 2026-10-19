import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { Observable } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  MotivoDialog,
  type MotivoDialogData,
} from '../../../../../shared/components/motivo-dialog/motivo-dialog';
import {
  AVISO_PRECARGA_LABELS,
  ESTADO_HERRAMIENTA_LABELS,
  ESTADO_HERRAMIENTA_TONO,
  PASO_PREPARACION,
  PERMISO_FCR_BODEGA,
  mensajeErrorTicket,
  resumenHerramientas,
  type HerramientaDisponible,
  type HerramientaTicket,
  type HerramientasTicket,
  type TicketFcr,
} from '../models/ticket-fcr';
import { TicketsFcrService } from '../services/tickets-fcr.service';

/**
 * Herramientas del ticket: precargadas desde el pedido (kit por cliente y código) o agregadas a mano. El Supervisor las solicita a Bodega,
 * Bodega las prepara y las envía, y el Supervisor las recibe; las novedades detienen la herramienta hasta resolverlas. Confirmado el
 * listado, no se agrega ni se quita nada. El retorno se registra en el control de retorno (otro panel).
 */
@Component({
  selector: 'app-ticket-fcr-herramientas-panel',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillTextComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h" aria-label="Herramientas del ticket">
      <header class="h__cabecera">
        <h2>Herramientas</h2>
        @for (r of resumen(); track r.estado) {
          <dynadrill-tag
            [label]="r.cantidad + ' · ' + estadoTxt(r.estado)"
            [variant]="tono(r.estado)"
            [uppercase]="false"
          />
        }
        @if (datos()?.listadoConfirmado) {
          <dynadrill-tag label="Listado confirmado" variant="success" [uppercase]="false" />
        }
      </header>
      @if (error(); as e) {
        <dynadrill-banner variant="warning" [message]="e" />
      }
      @for (a of datos()?.avisosPrecarga ?? []; track $index) {
        <dynadrill-banner
          variant="warning"
          [message]="
            avisoTxt(a.motivo) +
            (a.codigo
              ? ' Código ' + a.codigo + (a.descripcion ? ' (' + a.descripcion + ')' : '') + '.'
              : '') +
            (a.articulo ? ' ' + a.articulo + '.' : '')
          "
        />
      }
      <dynadrill-spinner mode="overlay" [spinning]="cargando() || ocupado()" tip="Procesando…">
        @if (puedeGestionar()) {
          <div class="h__acciones" role="group" aria-label="Acciones del Supervisor">
            @if (enPreparacion()) {
              <dynadrill-button
                variant="primary"
                size="small"
                [disabled]="!porSolicitar()"
                (clicked)="solicitar()"
                >Solicitar a Bodega lo pendiente</dynadrill-button
              >
              <dynadrill-button
                variant="secondary"
                size="small"
                [disabled]="!!datos()?.listadoConfirmado"
                (clicked)="
                  ejecutar(
                    servicio.recargarHerramientas(t().id),
                    'Listado recargado desde el pedido'
                  )
                "
                >Recargar desde el pedido</dynadrill-button
              >
              <dynadrill-button
                variant="secondary"
                size="small"
                (clicked)="
                  ejecutar(
                    servicio.confirmarListado(t().id, !datos()?.listadoConfirmado),
                    datos()?.listadoConfirmado ? 'Confirmación deshecha' : 'Listado confirmado'
                  )
                "
                >{{
                  datos()?.listadoConfirmado
                    ? 'Deshacer la confirmación del listado'
                    : 'Confirmar que el listado está completo'
                }}</dynadrill-button
              >
            }
            @if (!datos()?.listadoConfirmado || !enPreparacion()) {
              <dynadrill-button
                variant="secondary"
                size="small"
                (clicked)="buscando.set(!buscando())"
                >{{ buscando() ? 'Cerrar la búsqueda' : 'Agregar herramienta' }}</dynadrill-button
              >
            }
          </div>
          @if (buscando()) {
            <div class="h__busqueda">
              <dynadrill-input
                label="Buscar herramienta del inventario (2 letras o más)"
                [value]="q()"
                (valueChange)="q.set($event)"
                (keydown.enter)="buscar()"
              />
              <dynadrill-button
                variant="secondary"
                size="small"
                [disabled]="q().trim().length < 2"
                (clicked)="buscar()"
                >Buscar</dynadrill-button
              >
            </div>
            <ul class="h__resultados">
              @for (d of disponibles(); track d.id) {
                <li>
                  <span
                    >{{ d.codigo }} · {{ d.nombre }}
                    <span class="h__meta">({{ d.categoria }})</span></span
                  >
                  <dynadrill-button variant="secondary" size="small" (clicked)="agregar(d)"
                    >Agregar</dynadrill-button
                  >
                </li>
              } @empty {
                @if (buscado()) {
                  <li class="h__meta">Sin resultados.</li>
                }
              }
            </ul>
          }
        }

        @if (datos(); as d) {
          <div class="h__tabla">
            <table>
              <caption class="sr-only">
                Herramientas del ticket
              </caption>
              <thead>
                <tr>
                  <th scope="col">Herramienta</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Existencia</th>
                  <th scope="col"><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (h of d.herramientas; track h.id) {
                  <tr>
                    <td>
                      {{ h.nombre }}
                      <span class="h__meta"
                        >{{ h.codigo }}{{ h.numeroSerie ? ' · serie ' + h.numeroSerie : '' }}</span
                      >
                      @if (h.agregadaTarde) {
                        <dynadrill-tag
                          label="Agregada tarde"
                          variant="warning"
                          [uppercase]="false"
                        />
                      }
                      @if (h.bodegaNovedad) {
                        <div class="h__nov">Bodega: {{ h.bodegaNovedad }}</div>
                      }
                      @if (h.recepcionNovedad) {
                        <div class="h__nov">Recepción: {{ h.recepcionNovedad }}</div>
                      }
                      @if (h.faltanteMotivo) {
                        <div class="h__nov">Faltante: {{ h.faltanteMotivo }}</div>
                      }
                    </td>
                    <td>
                      {{
                        h.origen === 'pedido'
                          ? 'Pedido' + (h.codigoPedido ? ' (' + h.codigoPedido + ')' : '')
                          : 'A mano'
                      }}
                    </td>
                    <td>
                      <dynadrill-tag
                        [label]="estadoTxt(h.estado)"
                        [variant]="tono(h.estado)"
                        [uppercase]="false"
                      />
                    </td>
                    <td>{{ h.existencia ?? '—' }}</td>
                    <td class="h__fila-acciones">
                      @if (puedeGestionar()) {
                        @if (
                          h.estado === 'seleccionada' && !(enPreparacion() && d.listadoConfirmado)
                        ) {
                          <dynadrill-button
                            variant="secondary"
                            size="small"
                            (clicked)="
                              ejecutar(
                                servicio.quitarHerramienta(t().id, h.id),
                                'Herramienta quitada'
                              )
                            "
                            >Quitar</dynadrill-button
                          >
                        }
                        @if (
                          enPreparacion() &&
                          (h.estado === 'enviada' || h.estado === 'novedad_recepcion')
                        ) {
                          <dynadrill-button
                            variant="primary"
                            size="small"
                            (clicked)="
                              ejecutar(
                                servicio.recibirHerramienta(t().id, h.id),
                                'Herramienta recibida'
                              )
                            "
                            >Recibir</dynadrill-button
                          >
                          <dynadrill-button
                            variant="secondary"
                            size="small"
                            (clicked)="conNovedad(h, 'recibir')"
                            >Recibir con novedad</dynadrill-button
                          >
                        }
                        @if (
                          enPreparacion() &&
                          (h.estado === 'recibida' || h.estado === 'novedad_recepcion')
                        ) {
                          <dynadrill-button
                            variant="secondary"
                            size="small"
                            (clicked)="
                              ejecutar(
                                servicio.corregirRecepcion(t().id, h.id),
                                'Recepción deshecha'
                              )
                            "
                            >Deshacer recepción</dynadrill-button
                          >
                        }
                      }
                      @if (esBodega()) {
                        @if (h.estado === 'solicitada' || h.estado === 'novedad_bodega') {
                          <dynadrill-button
                            variant="primary"
                            size="small"
                            (clicked)="
                              ejecutar(
                                servicio.prepararHerramienta(t().id, h.id),
                                'Herramienta preparada'
                              )
                            "
                            >Preparar</dynadrill-button
                          >
                          <dynadrill-button
                            variant="secondary"
                            size="small"
                            (clicked)="conNovedad(h, 'preparar')"
                            >Preparar con novedad</dynadrill-button
                          >
                        }
                        @if (h.estado === 'preparada') {
                          <dynadrill-button
                            variant="primary"
                            size="small"
                            (clicked)="
                              ejecutar(
                                servicio.enviarHerramienta(t().id, h.id),
                                'Herramienta enviada al Supervisor'
                              )
                            "
                            >Enviar al Supervisor</dynadrill-button
                          >
                        }
                        @if (h.estado === 'preparada' || h.estado === 'novedad_bodega') {
                          <dynadrill-button
                            variant="secondary"
                            size="small"
                            (clicked)="
                              ejecutar(
                                servicio.corregirPreparacion(t().id, h.id),
                                'Preparación deshecha'
                              )
                            "
                            >Deshacer preparación</dynadrill-button
                          >
                        }
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="h__meta">Este ticket no tiene herramientas.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (d.movilizaciones.length) {
            <div>
              <dynadrill-text variant="caption"
                >Movilización del pedido (solo informativa: no pide herramientas a
                Bodega)</dynadrill-text
              >
              <ul class="h__resultados">
                @for (m of d.movilizaciones; track m.codigo) {
                  <li class="h__meta">
                    {{ m.codigo }} · {{ m.descripcion }} · {{ m.cantidad }} {{ m.unidad }}
                  </li>
                }
              </ul>
            </div>
          }
        }
      </dynadrill-spinner>
    </section>
  `,
  styles: `
    .h {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #ecebf1);
      border-radius: 14px;
    }
    .h h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }
    .h__cabecera,
    .h__acciones,
    .h__fila-acciones,
    .h__busqueda {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .h__busqueda {
      align-items: end;
    }
    .h__tabla {
      overflow-x: auto;
    }
    .h__tabla table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .h__tabla th,
    .h__tabla td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #ecebf1;
      vertical-align: top;
    }
    .h__meta {
      font-size: 12px;
      color: #5c5870;
    }
    .h__nov {
      font-size: 12px;
      color: #8a4b00;
    }
    .h__resultados {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
    }
    .h__resultados li {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
  `,
})
export class TicketFcrHerramientasPanel {
  protected readonly servicio = inject(TicketsFcrService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  readonly ticket = input.required<TicketFcr>();
  /** El panel cambió algo del ticket (para que la página lo recargue). */
  readonly cambio = output<void>();
  protected readonly t = this.ticket;

  protected readonly datos = signal<HerramientasTicket | null>(null);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly buscando = signal(false);
  protected readonly q = signal('');
  protected readonly buscado = signal(false);
  protected readonly disponibles = signal<HerramientaDisponible[]>([]);

  protected readonly estadoTxt = (e: HerramientaTicket['estado']) => ESTADO_HERRAMIENTA_LABELS[e];
  protected readonly tono = (e: HerramientaTicket['estado']) => ESTADO_HERRAMIENTA_TONO[e];
  protected readonly avisoTxt = (m: keyof typeof AVISO_PRECARGA_LABELS) => AVISO_PRECARGA_LABELS[m];
  protected readonly resumen = computed(() =>
    resumenHerramientas(this.datos()?.herramientas ?? []),
  );
  protected readonly enPreparacion = computed(() => this.ticket().paso.codigo === PASO_PREPARACION);
  protected readonly porSolicitar = computed(() =>
    (this.datos()?.herramientas ?? []).some((h) => h.estado === 'seleccionada'),
  );
  protected readonly esBodega = computed(
    () => this.auth.can(PERMISO_FCR_BODEGA) && this.ticket().paso.codigo !== 'cerrado',
  );
  /** El Supervisor del ticket (o Superadmin), mientras el ticket no esté cerrado ni en un paso que atienda otro rol. */
  protected readonly puedeGestionar = computed(() => {
    const t = this.ticket();
    const u = this.auth.currentUser();
    if (!u || t.paso.codigo === 'cerrado' || !t.paso.roles.includes('supervisor')) return false;
    return (
      u.roleCode === 'superadmin' ||
      (u.roleCode === 'supervisor' &&
        (!t.asignacion.supervisor || t.asignacion.supervisor.usuarioId === u.id))
    );
  });

  constructor() {
    effect(() => {
      this.ticket().version;
      this.cargar();
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servicio.herramientas(this.ticket().id).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo cargar las herramientas.'));
      },
    });
  }

  /** Ejecuta una acción sobre las herramientas y deja el resultado; avisa a la página para que recargue el ticket. */
  protected ejecutar(llamada: Observable<HerramientasTicket>, exito: string): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set(null);
    llamada.subscribe({
      next: (d) => {
        this.ocupado.set(false);
        this.datos.set(d);
        this.notify.success(exito, '');
        this.cambio.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeErrorTicket(err, 'No se pudo completar la acción.'));
      },
    });
  }

  protected solicitar(): void {
    this.ejecutar(
      this.servicio.solicitarHerramientas(this.ticket().id),
      'Herramientas solicitadas a Bodega',
    );
  }

  protected buscar(): void {
    const texto = this.q().trim();
    if (texto.length < 2) return;
    this.servicio.herramientasDisponibles(texto).subscribe({
      next: (l) => {
        this.disponibles.set(l);
        this.buscado.set(true);
      },
      error: (err) =>
        this.error.set(mensajeErrorTicket(err, 'No se pudo buscar en el inventario.')),
    });
  }

  protected agregar(d: HerramientaDisponible): void {
    this.ejecutar(
      this.servicio.agregarHerramienta(this.ticket().id, d.id),
      `Agregada: ${d.nombre}`,
    );
  }

  protected conNovedad(h: HerramientaTicket, accion: 'recibir' | 'preparar'): void {
    const ref = this.dialog.open<MotivoDialog, MotivoDialogData>({
      title: accion === 'recibir' ? 'Recibir con novedad' : 'Preparar con novedad',
      content: MotivoDialog,
      data: {
        mensaje: `${h.nombre} (${h.codigo}). La herramienta queda detenida hasta resolver la novedad.`,
        label: 'Novedad',
      },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((novedad: string | undefined) => {
      if (!novedad) return;
      const id = this.ticket().id;
      this.ejecutar(
        accion === 'recibir'
          ? this.servicio.recibirHerramienta(id, h.id, novedad)
          : this.servicio.prepararHerramienta(id, h.id, novedad),
        'Novedad registrada',
      );
    });
  }
}
