import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { MotivoDialog, type MotivoDialogData } from '../../../../shared/components/motivo-dialog/motivo-dialog';
import { DocumentoPdfService } from '../../../../shared/documentos';
import { EntregaEpiRegistroHoja } from '../../../../shared/documentos/formatos/entrega-epi-registro-hoja';
import {
  ESTADO_EPI_ETIQUETA,
  PERMISO_EPI_APROBAR,
  PERMISO_EPI_CREAR,
  PERMISO_EPI_DESPACHAR,
  esEditable,
  mensajeErrorEpi,
  pendientesDeDespacho,
  type ElementoEpi,
  type EntregaEpi,
  type EstadoEpi,
  type LugarEpi,
  type RenglonEntrada,
  type TallaEpi,
} from '../models/entrega-epi';
import { EntregaEpiService } from '../services/entrega-epi.service';

export interface EntregaEpiDetalleDialogData {
  entregaId: string;
}

const TONO: Record<EstadoEpi, DynadrillTagVariant> = { solicitado: 'warning', aprobado: 'brand', despachado: 'success', rechazado: 'error' };

interface Borrador {
  elementoId: string;
  cantidad: string;
  tallaId: string;
  recibioCapacitacion: boolean;
  observaciones: string;
}
const BORRADOR_VACIO: Borrador = { elementoId: '', cantidad: '1', tallaId: '', recibioCapacitacion: false, observaciones: '' };

const clave = (r: RenglonEntrada): string => `${r.elementoId}|${r.cantidad}|${r.tallaId ?? ''}|${r.recibioCapacitacion}|${r.observaciones ?? ''}`;

/**
 * Una entrega de EPI (DYN-SGI-RE-032): quién la recibe (con su cédula y cargo del perfil), los elementos entregados, la
 * declaración del trabajador y las acciones del ciclo (aprobar, rechazar, despachar, revertir) según el permiso de quien opera.
 * Los renglones se editan hasta despachar. "Recibe conforme Talento Humano" se firma después del despacho.
 */
@Component({
  selector: 'app-entrega-epi-detalle-dialog',
  host: { class: 'app-dialog-sheet-mobile' },
  imports: [DatePipe, DynadrillButtonComponent, DynadrillCheckboxComponent, DynadrillInputComponent, DynadrillSelectComponent, DynadrillTagComponent, DynadrillTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entrega(); as e) {
      <div class="eed">
        <div class="eed__cabecera">
          <dynadrill-tag [label]="etiqueta[e.estado]" [variant]="tono[e.estado]" />
          <span class="eed__meta">{{ e.codigo }}@if (e.ticket) { · Ticket {{ e.ticket.numero ?? '—' }} · Pedido {{ e.ticket.pedidoCodigo }} }</span>
        </div>

        <dl class="eed__datos">
          <div><dt>Trabajador</dt><dd>{{ e.trabajador.nombre }}</dd></div>
          <div><dt>Cédula</dt><dd>{{ e.trabajador.cedula ?? '—' }}</dd></div>
          <div><dt>Cargo</dt><dd>{{ e.trabajador.cargo ?? '—' }}</dd></div>
          <div>
            <dt>Declaración del trabajador</dt>
            <dd>{{ e.firmaTrabajador ? e.firmaTrabajador.nombre + ' — ' + (e.firmaTrabajador.at | date: 'dd/MM/yyyy HH:mm') : 'Pendiente' }}</dd>
          </div>
          @if (e.rechazado) {
            <div class="eed__rechazo"><dt>Motivo del rechazo</dt><dd>{{ e.rechazado.motivo }} ({{ e.rechazado.nombre }})</dd></div>
          }
        </dl>

        @if (editable()) {
          <dynadrill-select label="Base o bodega de la entrega" placeholder="Elija el lugar" [options]="opcionesLugares()" [value]="lugarId()" [searchable]="true" (valueChange)="lugarId.set($any($event))" />
        } @else {
          <p class="eed__lugar"><strong>Lugar:</strong> {{ e.lugar?.nombre ?? '—' }}</p>
        }

        <dynadrill-text variant="h2">Elementos entregados</dynadrill-text>
        @if (renglones().length === 0) {
          <dynadrill-text variant="caption">Todavía no hay elementos registrados.</dynadrill-text>
        } @else {
          <ul class="eed__renglones">
            @for (r of renglones(); track $index; let i = $index) {
              <li>
                <div>
                  <strong>{{ nombreElemento(r.elementoId) }}</strong>
                  <span>{{ r.cantidad }} unidad(es){{ r.tallaId ? ' — talla ' + nombreTalla(r.tallaId) : '' }}</span>
                  <span>{{ r.recibioCapacitacion ? 'Con capacitación en uso y manejo' : 'Sin capacitación registrada' }}{{ r.observaciones ? ' — ' + r.observaciones : '' }}</span>
                </div>
                @if (editable()) {
                  <dynadrill-button variant="secondary" size="small" (clicked)="quitar(i)">Quitar</dynadrill-button>
                }
              </li>
            }
          </ul>
        }

        @if (editable()) {
          <div class="eed__form">
            <dynadrill-select label="Elemento" placeholder="Elija el elemento" [options]="opcionesElementos()" [value]="borrador().elementoId" [searchable]="true" (valueChange)="cambiar('elementoId', $any($event))" />
            <dynadrill-input label="Cantidad" type="number" [value]="borrador().cantidad" (valueChange)="cambiar('cantidad', $event)" />
            @if (tipoTalla()) {
              <dynadrill-select label="Talla" placeholder="Elija la talla" [options]="opcionesTallas()" [value]="borrador().tallaId" (valueChange)="cambiar('tallaId', $any($event))" />
            }
            <dynadrill-input label="Observaciones (opcional)" [value]="borrador().observaciones" (valueChange)="cambiar('observaciones', $event)" />
            <dynadrill-checkbox label="Recibió capacitación en uso y manejo del EPI" [checked]="borrador().recibioCapacitacion" (checkedChange)="cambiar('recibioCapacitacion', $event)" />
            <dynadrill-button variant="secondary" size="small" [disabled]="!puedeAgregar()" (clicked)="agregar()">+ Agregar elemento</dynadrill-button>
          </div>
          <div><dynadrill-button [disabled]="enviando() || !hayCambios()" (clicked)="guardar()">Guardar cambios</dynadrill-button></div>
        }

        @if (faltantes().length > 0 && puedeDespachar()) {
          <p class="eed__aviso" role="status">Para despachar falta: {{ faltantes().join(', ') }}.</p>
        }

        @if (e.historial.length) {
          <details class="eed__historial">
            <summary>Historial ({{ e.historial.length }})</summary>
            <ul>
              @for (h of e.historial; track $index) {
                <li>{{ h.at | date: 'dd/MM/yyyy HH:mm' }} · {{ h.estadoAnterior ? etiqueta[h.estadoAnterior] + ' → ' : '' }}{{ etiqueta[h.estadoNuevo] }}@if (h.actor) { · {{ h.actor }} }@if (h.motivo) { — {{ h.motivo }} }</li>
              }
            </ul>
          </details>
        }

        @if (e.estado === 'despachado') {
          <section class="eed__th">
            <dynadrill-text variant="h2">Recibe conforme Talento Humano</dynadrill-text>
            @if (e.firmaTalentoHumano; as f) {
              <dynadrill-tag [label]="'Recibido por ' + f.nombre + ' — ' + (f.at | date: 'dd/MM/yyyy HH:mm')" variant="success" />
            } @else if (puedeDespachar()) {
              <dynadrill-button variant="secondary" size="small" [disabled]="enviando()" (clicked)="firmarTh()">Recibe conforme (Talento Humano)</dynadrill-button>
            } @else {
              <dynadrill-text variant="caption">Pendiente.</dynadrill-text>
            }
          </section>
        }

        <footer class="eed__acciones">
          <dynadrill-button variant="secondary" (clicked)="cerrar()">Cerrar</dynadrill-button>
          <dynadrill-button variant="secondary" (clicked)="verPdf()">Ver PDF</dynadrill-button>
          @if (puedeAprobar() && (e.estado === 'solicitado' || e.estado === 'aprobado')) {
            <dynadrill-button variant="secondary" [disabled]="enviando()" (clicked)="rechazar()">Rechazar</dynadrill-button>
          }
          @if (puedeAprobar() && e.estado === 'solicitado') {
            <dynadrill-button [disabled]="enviando()" (clicked)="aprobar()">Aprobar</dynadrill-button>
          }
          @if (puedeDespachar() && esEditableEstado() && !e.firmaTrabajador) {
            <dynadrill-button variant="secondary" [disabled]="enviando()" (clicked)="firmarTrabajador()">Registrar declaración del trabajador</dynadrill-button>
          }
          @if (puedeDespachar() && e.estado === 'aprobado') {
            <dynadrill-button [disabled]="enviando() || faltantes().length > 0 || hayCambios()" (clicked)="despachar()">Despachar</dynadrill-button>
          }
          @if (puedeDespachar() && e.estado === 'despachado') {
            <dynadrill-button variant="secondary" [disabled]="enviando()" (clicked)="revertir()">Revertir despacho</dynadrill-button>
          }
        </footer>
      </div>
    } @else {
      <dynadrill-text variant="caption">{{ error() || 'Cargando…' }}</dynadrill-text>
    }
  `,
  styleUrl: './entrega-epi-detalle-dialog.scss',
})
export class EntregaEpiDetalleDialog {
  private readonly data = inject<EntregaEpiDetalleDialogData>(NZ_MODAL_DATA);
  private readonly modalRef = inject(NzModalRef<EntregaEpiDetalleDialog, boolean | undefined>);
  private readonly servicio = inject(EntregaEpiService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly pdf = inject(DocumentoPdfService);

  protected readonly etiqueta = ESTADO_EPI_ETIQUETA;
  protected readonly tono = TONO;
  protected readonly entrega = signal<EntregaEpi | null>(null);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly elementos = signal<ElementoEpi[]>([]);
  protected readonly lugarId = signal('');
  protected readonly lugares = signal<LugarEpi[]>([]);
  protected readonly tallas = signal<TallaEpi[]>([]);
  protected readonly renglones = signal<RenglonEntrada[]>([]);
  protected readonly borrador = signal<Borrador>({ ...BORRADOR_VACIO });
  /** Algún cambio hecho en esta ventana (para que la bandeja se recargue al cerrar). */
  private cambio = false;

  protected readonly puedeAprobar = computed(() => this.auth.can(PERMISO_EPI_APROBAR));
  protected readonly puedeDespachar = computed(() => this.auth.can(PERMISO_EPI_DESPACHAR));
  protected readonly esEditableEstado = computed(() => {
    const e = this.entrega();
    return !!e && esEditable(e);
  });
  protected readonly editable = computed(() => this.esEditableEstado() && this.auth.can(PERMISO_EPI_CREAR));
  protected readonly opcionesElementos = computed<DynadrillSelectOption[]>(() => this.elementos().map(x => ({ value: x.id, label: x.nombre })));
  protected readonly opcionesLugares = computed<DynadrillSelectOption[]>(() => this.lugares().map(x => ({ value: x.id, label: x.nombre })));
  /** Tipo de talla del elemento elegido (`null` = no lleva talla). */
  protected readonly tipoTalla = computed(() => this.elementos().find(x => x.id === this.borrador().elementoId)?.tipoTalla ?? null);
  protected readonly opcionesTallas = computed<DynadrillSelectOption[]>(() => this.tallas().filter(t => t.tipo === this.tipoTalla()).map(t => ({ value: t.id, label: t.codigo })));
  protected readonly puedeAgregar = computed(() => {
    const b = this.borrador();
    const cantidad = Number(b.cantidad);
    return !!b.elementoId && Number.isInteger(cantidad) && cantidad >= 1 && (!this.tipoTalla() || b.tallaId.length > 0);
  });
  /** ¿Lo que se ve en pantalla difiere de lo guardado? Si sí, hay que guardar antes de despachar. */
  protected readonly hayCambios = computed(() => {
    const e = this.entrega();
    if (!e) return false;
    const guardados = e.renglones.map(r => clave(this.comoEntrada(r)));
    return guardados.join(';') !== this.renglones().map(clave).join(';') || (e.lugar?.id ?? '') !== this.lugarId();
  });
  protected readonly faltantes = computed(() => {
    const e = this.entrega();
    return e ? pendientesDeDespacho(e) : [];
  });

  constructor() {
    this.servicio.elementos().subscribe({
      next: x => this.elementos.set(x),
      error: () => this.notify.error('Error', 'No se pudo cargar el catálogo de elementos de EPI.'),
    });
    this.servicio.tallas().subscribe({ next: x => this.tallas.set(x), error: () => this.notify.error('Error', 'No se pudo cargar el catálogo de tallas.') });
    this.servicio.lugares().subscribe({ next: x => this.lugares.set(x), error: () => this.notify.error('Error', 'No se pudo cargar la lista de bases y bodegas.') });
    this.servicio.detalle(this.data.entregaId).subscribe({
      next: e => this.poner(e),
      error: err => this.error.set(mensajeErrorEpi(err, 'No se pudo cargar la entrega.')),
    });
  }

  protected nombreTalla(id: string): string {
    return this.tallas().find(t => t.id === id)?.codigo ?? this.entrega()?.renglones.find(r => r.tallaId === id)?.talla ?? '';
  }

  protected nombreElemento(id: string): string {
    return this.elementos().find(x => x.id === id)?.nombre ?? this.entrega()?.renglones.find(r => r.elementoId === id)?.elemento ?? '';
  }

  protected cambiar<K extends keyof Borrador>(campo: K, valor: Borrador[K]): void {
    this.borrador.update(b => ({ ...b, [campo]: valor }));
  }

  protected agregar(): void {
    if (!this.puedeAgregar()) return;
    const b = this.borrador();
    const r: RenglonEntrada = {
      elementoId: b.elementoId,
      cantidad: Number(b.cantidad),
      recibioCapacitacion: b.recibioCapacitacion,
      ...(b.tallaId ? { tallaId: b.tallaId } : {}),
      ...(b.observaciones.trim() ? { observaciones: b.observaciones.trim() } : {}),
    };
    this.renglones.update(l => [...l, r]);
    this.borrador.set({ ...BORRADOR_VACIO });
  }

  protected quitar(i: number): void {
    this.renglones.update(l => l.filter((_, j) => j !== i));
  }

  protected guardar(): void {
    const e = this.entrega();
    if (!e) return;
    this.ejecutar(this.servicio.guardarContenido(e.id, { ...(this.lugarId() ? { lugarBodegaId: this.lugarId() } : {}), renglones: this.renglones() }), 'Cambios guardados.', 'No se pudieron guardar los cambios.');
  }

  protected aprobar(): void {
    this.ejecutar(this.servicio.aprobar(this.entrega()!.id), 'Entrega aprobada.', 'No se pudo aprobar la entrega.');
  }

  protected despachar(): void {
    this.ejecutar(this.servicio.despachar(this.entrega()!.id), 'Entrega despachada: el requisito del ticket queda cumplido.', 'No se pudo despachar la entrega.');
  }

  protected firmarTrabajador(): void {
    this.ejecutar(this.servicio.firmarTrabajador(this.entrega()!.id), 'Declaración del trabajador registrada.', 'No se pudo registrar la declaración.');
  }

  protected firmarTh(): void {
    this.ejecutar(this.servicio.firmarTalentoHumano(this.entrega()!.id), 'Talento Humano recibió conforme.', 'No se pudo registrar la recepción.');
  }

  protected rechazar(): void {
    this.pedirMotivo('Rechazar entrega de EPI', '¿Por qué se rechaza esta entrega de EPI?', 'Motivo del rechazo', m =>
      this.ejecutar(this.servicio.rechazar(this.entrega()!.id, m), 'Entrega rechazada.', 'No se pudo rechazar la entrega.'),
    );
  }

  protected revertir(): void {
    this.pedirMotivo('Revertir despacho', 'El requisito del ticket se reabrirá. ¿Por qué se revierte el despacho?', 'Motivo de la reversión', m =>
      this.ejecutar(this.servicio.revertir(this.entrega()!.id, m), 'Despacho revertido.', 'No se pudo revertir el despacho.'),
    );
  }

  protected verPdf(): void {
    const e = this.entrega();
    if (!e) return;
    this.pdf.abrir({ titulo: `Entrega de EPI — ${e.codigo}`, component: EntregaEpiRegistroHoja, inputs: { entrega: e }, orientacion: 'landscape', nombreArchivo: `Entrega de EPI ${e.codigo}` });
  }

  protected cerrar(): void {
    this.modalRef.close(this.cambio);
  }

  private comoEntrada(r: EntregaEpi['renglones'][number]): RenglonEntrada {
    return {
      elementoId: r.elementoId,
      cantidad: r.cantidad,
      recibioCapacitacion: r.recibioCapacitacion,
      ...(r.tallaId ? { tallaId: r.tallaId } : {}),
      ...(r.observaciones ? { observaciones: r.observaciones } : {}),
    };
  }

  private poner(e: EntregaEpi): void {
    this.entrega.set(e);
    this.lugarId.set(e.lugar?.id ?? '');
    this.renglones.set(e.renglones.map(r => this.comoEntrada(r)));
  }

  private ejecutar(llamada: ReturnType<EntregaEpiService['detalle']>, exito: string, fallo: string): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    llamada.subscribe({
      next: e => {
        this.enviando.set(false);
        this.cambio = true;
        this.poner(e);
        this.notify.success('Listo', exito);
      },
      error: err => {
        this.enviando.set(false);
        this.notify.error('No se pudo', mensajeErrorEpi(err, fallo));
      },
    });
  }

  private pedirMotivo(titulo: string, mensaje: string, label: string, alConfirmar: (motivo: string) => void): void {
    const ref = this.dialogos.open<MotivoDialog, MotivoDialogData>({ title: titulo, content: MotivoDialog, data: { mensaje, label }, footer: false, width: '480px' });
    ref.afterClose.subscribe((motivo: string | undefined) => {
      if (motivo) alConfirmar(motivo);
    });
  }
}
