import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillStepperComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { DocumentoPdfService } from '../../../shared/documentos';
import { InspeccionVehiculoHoja } from '../../../shared/documentos/formatos/inspeccion-vehiculo-hoja';
import { hojaDeInspeccion } from '../models/hojas.mapper';
import {
  ESTADO_DOCUMENTO_LABEL,
  ESTADO_INSPECCION_LABEL,
  type CasoInspeccion,
  type ConductorEstado,
  type EstadoDocumento,
  type InspeccionDetalle,
  type ItemInspeccion,
  type MomentoInspeccion,
  type ResultadoChecklist,
} from '../models/inspeccion-flota.model';
import type { UnidadFlota } from '../models/unidad-flota.model';
import { FlotaInspeccionesService } from '../services/flota-inspecciones.service';
import { FlotaUnidadesService } from '../services/flota-unidades.service';
import { formatoFecha, formatoNumero, mensajeDeError } from '../utils/flota.util';

export interface InspeccionVehiculoDialogData {
  /** Alta: el caso del ticket (fija la unidad y el momento) o, sin caso, una inspección suelta. */
  caso?: CasoInspeccion;
  momento?: MomentoInspeccion;
  /** Ver una inspección ya registrada (con las acciones del Supervisor y de Mantenimiento si el rol las tiene). */
  inspeccionId?: string;
}

const STEPS = ['Datos', 'Vehículo', 'Equipo', 'Conductor'];
const TONO_DOC: Record<EstadoDocumento, DynadrillTagVariant> = {
  vigente: 'success',
  por_vencer: 'warning',
  vencido: 'error',
  faltante: 'error',
};
const TONO_ESTADO: Record<string, DynadrillTagVariant> = {
  pendiente: 'warning',
  por_aprobar: 'warning',
  aprobada: 'success',
  anulada: 'neutral',
};
const RESULTADO_TEXTO: Record<ResultadoChecklist, string> = {
  cumple: '✓ Cumple',
  no_cumple: '✕ No cumple',
  no_aplica: 'N/A',
};

/**
 * DYN-SGI-RE-068 — checklist previo a la salida de los vehículos de transporte. Alta paso a paso o detalle de solo lectura.
 * Las reglas las aplica el servidor: documentos vigentes del conductor, formato completo y Nota 1 (el cinturón en «No cumple»
 * impide aprobar). El kilometraje es una lectura de odómetro de la unidad.
 */
@Component({
  selector: 'app-inspeccion-vehiculo-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    DatePipe,
    NgTemplateOutlet,
    DynadrillButtonComponent,
    DynadrillDatetimePickerComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillStepperComponent,
    DynadrillTagComponent,
    DynadrillTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspeccion-vehiculo-dialog.html',
  styleUrl: './inspeccion-vehiculo-dialog.scss',
})
export class InspeccionVehiculoDialog {
  private readonly api = inject(FlotaInspeccionesService);
  private readonly documentoPdf = inject(DocumentoPdfService);
  private readonly unidadesApi = inject(FlotaUnidadesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly modalRef = inject(NzModalRef<InspeccionVehiculoDialog, boolean>);
  private readonly data = inject<InspeccionVehiculoDialogData>(NZ_MODAL_DATA);

  protected readonly steps = STEPS;
  protected readonly tonoDoc = TONO_DOC;
  protected readonly etiquetaDoc = ESTADO_DOCUMENTO_LABEL;
  protected readonly resultadoTexto = RESULTADO_TEXTO;
  protected readonly formatoFecha = formatoFecha;

  protected readonly modoVer = !!this.data.inspeccionId;
  protected readonly momento: MomentoInspeccion = this.data.caso
    ? (this.data.momento ?? 'salida')
    : (this.data.momento ?? 'salida');
  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly paso = signal(0);

  // ---- alta
  protected readonly items = signal<ItemInspeccion[]>([]);
  protected readonly unidades = signal<UnidadFlota[]>([]);
  protected readonly conductores = signal<ConductorEstado[]>([]);
  protected readonly unidadId = signal<string | null>(this.data.caso?.unidad.id ?? null);
  protected readonly conductorId = signal<string | null>(null);
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly puntoPartida = signal('');
  protected readonly destino = signal('');
  protected readonly km = signal('');
  protected readonly observaciones = signal('');
  protected readonly resultados = signal<Record<string, ResultadoChecklist>>({});

  protected readonly unidadFija = !!this.data.caso;
  protected readonly unidadOpciones = computed<DynadrillSelectOption[]>(() =>
    this.unidades().map((u) => ({ label: `${u.codigo} — ${u.nombre}`, value: u.id })),
  );
  protected readonly conductorOpciones = computed<DynadrillSelectOption[]>(() =>
    this.conductores().map((c) => ({
      label: c.reuneCondiciones ? c.usuario.nombre : `${c.usuario.nombre} (sin condiciones)`,
      value: c.usuario.id,
    })),
  );
  protected readonly unidad = computed(
    () => this.unidades().find((u) => u.id === this.unidadId()) ?? null,
  );
  protected readonly conductor = computed(
    () => this.conductores().find((c) => c.usuario.id === this.conductorId()) ?? null,
  );
  protected readonly itemsVehiculo = computed(() =>
    this.items().filter((i) => i.seccion === 'vehiculo'),
  );
  protected readonly itemsEquipo = computed(() =>
    this.items().filter((i) => i.seccion === 'equipo'),
  );
  protected readonly cinturonBloquea = computed(() =>
    this.items().some((i) => i.bloqueaSiNoCumple && this.resultados()[i.id] === 'no_cumple'),
  );
  protected readonly sinMarcar = computed(
    () => this.items().filter((i) => !this.resultados()[i.id]).length,
  );
  protected readonly motivoNoGuardar = computed(() => {
    if (!this.unidadId()) return 'Falta seleccionar la unidad (paso «Datos»).';
    if (!this.conductorId()) return 'Falta seleccionar el conductor (paso «Datos»).';
    if (!this.puntoPartida().trim()) return 'Falta el punto de partida (paso «Datos»).';
    if (this.km().trim() === '' || Number.isNaN(Number(this.km())))
      return 'Falta el kilometraje del odómetro (paso «Datos»).';
    if (this.conductor() && !this.conductor()!.reuneCondiciones) {
      return `${this.conductor()!.usuario.nombre} no reúne las condiciones para conducir: cambie de conductor.`;
    }
    if (this.sinMarcar() > 0) return `Falta marcar ${this.sinMarcar()} ítem(s) del formato.`;
    return '';
  });

  // ---- detalle
  protected readonly detalle = signal<InspeccionDetalle | null>(null);
  protected readonly puedeAprobar = computed(
    () =>
      this.auth.can('flota.inspecciones.aprobar') &&
      this.detalle()?.estado === 'por_aprobar' &&
      this.detalle()?.momento === 'salida',
  );
  protected readonly puedeAnular = computed(
    () =>
      this.auth.can('flota.inspecciones.anular') &&
      !!this.detalle() &&
      this.detalle()!.estado !== 'anulada' &&
      this.detalle()!.estado !== 'aprobada',
  );
  protected readonly tonoEstado = TONO_ESTADO;
  protected readonly estadoTexto = ESTADO_INSPECCION_LABEL;
  protected readonly detalleVehiculo = computed(
    () => this.detalle()?.resultados.filter((r) => r.seccion === 'vehiculo') ?? [],
  );
  protected readonly detalleEquipo = computed(
    () => this.detalle()?.resultados.filter((r) => r.seccion === 'equipo') ?? [],
  );

  constructor() {
    if (this.modoVer) {
      this.api.obtener(this.data.inspeccionId!).subscribe({
        next: (d) => {
          this.detalle.set(d);
          this.cargando.set(false);
        },
        error: (e: HttpErrorResponse) => {
          this.notify.error('Error', mensajeDeError(e, 'No se pudo cargar la inspección.'));
          this.modalRef.close(false);
        },
      });
      return;
    }
    this.api.items().subscribe({
      next: (i) => this.items.set(i),
      error: () => this.notify.error('Error', 'No se pudo cargar el formato.'),
    });
    this.api.conductores().subscribe((c) => {
      this.conductores.set(c);
      const operador = this.data.caso?.operador.id;
      if (operador && c.some((x) => x.usuario.id === operador)) this.conductorId.set(operador);
    });
    this.unidadesApi.listar({ tipo: 'transporte' }).subscribe((u) => {
      this.unidades.set(u);
      this.cargando.set(false);
    });
  }

  protected marcar(itemId: string, r: ResultadoChecklist): void {
    this.resultados.update((m) =>
      m[itemId] === r
        ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== itemId))
        : { ...m, [itemId]: r },
    );
  }

  protected marcarTodos(lista: ItemInspeccion[], r: ResultadoChecklist): void {
    this.resultados.update((m) => ({ ...m, ...Object.fromEntries(lista.map((i) => [i.id, r])) }));
  }

  protected siguiente(): void {
    if (
      this.paso() === 0 &&
      (!this.unidadId() || !this.conductorId() || !this.puntoPartida().trim())
    ) {
      this.notify.error(
        'Falta información',
        'Complete la unidad, el conductor y el punto de partida antes de continuar.',
      );
      return;
    }
    this.paso.update((p) => Math.min(p + 1, STEPS.length - 1));
  }

  protected atras(): void {
    this.paso.update((p) => Math.max(p - 1, 0));
  }

  protected cerrar(): void {
    this.modalRef.close(false);
  }

  protected guardar(): void {
    if (this.enviando() || this.motivoNoGuardar()) return;
    this.enviando.set(true);
    const r = this.resultados();
    this.api
      .registrar({
        ...(this.data.caso ? { casoId: this.data.caso.id } : { unidadId: this.unidadId()! }),
        momento: this.momento,
        fecha: this.fecha()?.toISOString(),
        puntoPartida: this.puntoPartida().trim(),
        destino: this.destino().trim() || null,
        conductorId: this.conductorId()!,
        km: Number(this.km()),
        observaciones: this.observaciones().trim() || null,
        resultados: this.items().map((i) => ({ itemId: i.id, resultado: r[i.id] })),
      })
      .subscribe({
        next: (res) => {
          this.notify.success(
            'Inspección registrada',
            res.bloqueaUso
              ? 'Quedó con la Nota 1 incumplida: el vehículo no podrá aprobarse.'
              : 'Quedó pendiente de la aprobación del Supervisor.',
          );
          this.modalRef.close(true);
        },
        error: (e: HttpErrorResponse) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo guardar',
            mensajeDeError(e, 'No se pudo guardar la inspección.'),
          );
        },
      });
  }

  protected aprobar(): void {
    const d = this.detalle();
    if (!d || this.enviando()) return;
    this.enviando.set(true);
    this.api.aprobar(d.id).subscribe({
      next: () => {
        this.notify.success('Inspección aprobada', d.unidad.codigo);
        this.modalRef.close(true);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.notify.error(
          'No se pudo aprobar',
          mensajeDeError(e, 'No se pudo aprobar la inspección.'),
        );
      },
    });
  }

  /** Acción que espera su motivo (rechazar o anular): se pide dentro del mismo diálogo. */
  protected readonly accionConMotivo = signal<'rechazar' | 'anular' | null>(null);
  protected readonly motivo = signal('');
  protected readonly motivoValido = computed(() => this.motivo().trim().length >= 5);

  protected pedirMotivo(accion: 'rechazar' | 'anular'): void {
    this.motivo.set('');
    this.accionConMotivo.set(accion);
  }

  protected confirmarMotivo(): void {
    const accion = this.accionConMotivo();
    const d = this.detalle();
    if (!accion || !d || !this.motivoValido() || this.enviando()) return;
    this.enviando.set(true);
    const llamada =
      accion === 'rechazar'
        ? this.api.rechazar(d.id, this.motivo().trim())
        : this.api.anular(d.id, this.motivo().trim());
    llamada.subscribe({
      next: () => {
        this.notify.success(
          accion === 'rechazar' ? 'Inspección rechazada' : 'Inspección anulada',
          d.unidad.codigo,
        );
        this.modalRef.close(true);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.notify.error(
          'No se pudo completar',
          mensajeDeError(e, 'No se pudo completar la acción.'),
        );
      },
    });
  }

  /** «Marca modelo año» del vehículo del catálogo, sin los datos que falten. */
  protected descripcionVehiculo(
    v: { marca: string | null; modelo: string | null; anio: number | null } | null,
  ): string {
    return v ? [v.marca, v.modelo, v.anio].filter((x) => x !== null && x !== '').join(' ') : '';
  }

  /** Formato DYN-SGI-RE-068 con los datos de esta inspección; la firma se pone sobre el PDF. */
  protected verPdf(): void {
    const d = this.detalle();
    if (!d) return;
    this.documentoPdf.abrir({
      titulo: `Inspección de vehículos — ${d.unidad.codigo}`,
      component: InspeccionVehiculoHoja,
      inputs: { inspeccion: hojaDeInspeccion(d) },
      nombreArchivo: `Inspección de vehículos ${d.unidad.codigo} ${d.fecha.slice(0, 10)}`,
    });
  }

  protected kmTexto(d: InspeccionDetalle): string {
    return d.km === null ? '—' : `${formatoNumero(d.km)} km`;
  }
}
