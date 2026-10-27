import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillContextCardComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDatetimePickerComponent,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillStepperComponent,
  DynadrillTagComponent,
  DynadrillTextComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../core/services/auth.service';
import { FlotaInspeccionesService } from '../services/flota-inspecciones.service';
import { FlotaViajesService } from '../services/flota-viajes.service';
import type { InspeccionDetalle } from '../models/inspeccion-flota.model';
import {
  NIVEL_LABEL,
  TIPO_VIAJE_LABEL,
  previsualizarRiesgo,
  type PreguntaRiesgo,
  type TipoViaje,
  type UmbralRiesgo,
  type UnidadViaje,
  type ViajeContextoPumping,
} from '../models/viaje-flota.model';
import { aFechaIso, mensajeDeError } from '../utils/flota.util';

/** Desde una tarea del conductor: el ticket, el tipo de viaje y la unidad ya vienen definidos. */
export interface ViajeSolicitudDialogData {
  ticket: ViajeContextoPumping;
  tipo: TipoViaje;
  unidadId: string;
}

const STEPS = ['General', 'Evaluación', 'Plan y ruta', 'Confirmación'];

const VEHICLE_TYPE_OPTIONS: DynadrillSelectOption[] = [
  { label: 'Liviano', value: 'Liviano' },
  { label: 'Pesado', value: 'Pesado' },
];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const PERMISO_MAYOR = 'flota.viajes.autorizar_mayor';

/**
 * El conductor completa el Gerenciamiento de Viaje (DYN-SGI-RE-049) de su unidad desde su tarea: mismo formulario de 4 pasos de la demo.
 * El puntaje que se muestra es una vista previa: lo decide el servidor, que también valida que sea el conductor asignado.
 */
@Component({
  selector: 'app-viaje-solicitud-dialog',
  imports: [
    DynadrillTextComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillButtonComponent,
    DynadrillDataTableComponent,
    DynadrillStepperComponent,
    DynadrillContextCardComponent,
    DynadrillChipGroupComponent,
    DynadrillTagComponent,
    DynadrillIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-dialog-fullscreen-mobile' },
  templateUrl: './viaje-solicitud-dialog.html',
  styleUrl: './viaje-solicitud-dialog.scss',
})
export class ViajeSolicitudDialog {
  private readonly data = inject<ViajeSolicitudDialogData>(NZ_MODAL_DATA);
  private readonly api = inject(FlotaViajesService);
  private readonly inspecciones = inject(FlotaInspeccionesService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ViajeSolicitudDialog, boolean>);

  protected readonly steps = STEPS;
  protected readonly currentStep = signal(0);
  protected readonly submitting = signal(false);
  protected readonly tipo = signal<TipoViaje>(this.data.tipo);
  protected readonly tipoLabel = TIPO_VIAJE_LABEL[this.data.tipo].toLowerCase();

  private readonly unidades = signal<UnidadViaje[]>([]);
  protected readonly preguntas = signal<PreguntaRiesgo[]>([]);
  private readonly umbrales = signal<UmbralRiesgo[]>([]);

  // ── Paso 1: Información general ──
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly motivoViaje = signal('');
  /** La inspección de salida de esta unidad en el ticket: de ahí salen el origen y el destino (ya no se piden). */
  protected readonly inspeccionSalida = signal<InspeccionDetalle | null>(null);
  protected readonly cargandoInspeccion = signal(true);
  protected readonly vehicleTypeOptions = VEHICLE_TYPE_OPTIONS;

  private readonly unidad = computed(
    () => this.unidades().find((u) => u.id === this.data.unidadId) ?? null,
  );
  protected readonly vehicleType = computed<'Liviano' | 'Pesado' | null>(() => {
    const c = this.unidad()?.categoriaPeso;
    return c === 'pesado' ? 'Pesado' : c === 'liviano' ? 'Liviano' : null;
  });
  protected readonly placas = computed(
    () =>
      this.unidad()?.placa ??
      this.unidad()?.codigo ??
      this.data.ticket.unidades.find((u) => u.unidadId === this.data.unidadId)?.codigo ??
      '',
  );

  protected readonly ticketCode = signal(
    String(this.data.ticket.ticketNumero ?? this.data.ticket.pedidoCodigo),
  );
  protected readonly lineaServicio = signal(
    this.data.ticket.serviciosPrincipales.map((s) => s.nombre).join(', '),
  );
  protected readonly assignedSupervisorNombre = signal(this.data.ticket.supervisor?.nombre ?? '');
  /** En el retorno el recorrido va al revés. */
  protected readonly origen = computed(() => {
    const i = this.inspeccionSalida();
    return ((this.tipo() === 'salida' ? i?.puntoPartida : i?.destino)?.nombre) || '—';
  });
  protected readonly destino = computed(() => {
    const i = this.inspeccionSalida();
    return ((this.tipo() === 'salida' ? i?.destino : i?.puntoPartida)?.nombre) || '—';
  });

  /** Cabecera móvil con la context-card: ticket y tipo de viaje agrupados. */
  protected readonly headerGroups = computed<DynadrillContextCardItem[][]>(() => [
    [
      { label: 'Ticket', value: this.ticketCode(), icon: 'file-text' },
      {
        label: 'Tipo de viaje',
        value: TIPO_VIAJE_LABEL[this.tipo()],
        icon: 'tool',
        badgeVariant: 'brand',
      },
    ],
  ]);
  protected readonly headerItems = computed<DynadrillContextCardItem[]>(() => [
    { label: 'Documento', value: 'DYN-SGI-RE-049' },
    { label: 'Tipo de viaje', value: TIPO_VIAJE_LABEL[this.tipo()] },
  ]);

  // ── Paso 2: Evaluación de riesgos ──
  protected readonly elegidas = signal<Record<string, string>>({});
  protected readonly riesgo = computed(() =>
    previsualizarRiesgo(this.preguntas(), this.elegidas(), this.umbrales()),
  );
  protected readonly riskLevel = computed(() => {
    const n = this.riesgo().nivel;
    return n ? NIVEL_LABEL[n] : '—';
  });
  protected readonly riskDescription = computed(
    () => this.umbrales().find((u) => u.nivel === this.riesgo().nivel)?.descripcion ?? '',
  );
  protected readonly riskLevelColor = computed(() => {
    switch (this.riesgo().nivel) {
      case 'alto':
        return 'error';
      case 'medio':
        return 'warning';
      default:
        return 'success';
    }
  });
  /** Quién autoriza el nivel de riesgo calculado (lo dice el umbral del servidor). */
  protected readonly revisor = computed(() => {
    const u = this.umbrales().find((x) => x.nivel === this.riesgo().nivel);
    return u?.permisoAutoriza === PERMISO_MAYOR
      ? 'del Jefe de Base o el Gerente HSE'
      : 'del Supervisor de Pumping';
  });

  protected readonly riskTableColumns: DynadrillDataTableColumn[] = [
    { key: 'level', header: 'RIESGO' },
    { key: 'points', header: 'PUNTOS' },
    { key: 'schedule', header: 'GESTIÓN DE RIESGOS' },
  ];
  protected readonly riskTableRows = computed(() => {
    const u = [...this.umbrales()].sort((a, b) => b.desdePuntos - a.desdePuntos);
    return u.map((x, i) => {
      const techo = i === 0 ? null : u[i - 1].desdePuntos - 1;
      return {
        level: NIVEL_LABEL[x.nivel],
        points: techo === null ? `${x.desdePuntos} o más` : `${x.desdePuntos} a ${techo}`,
        schedule:
          x.permisoAutoriza === PERMISO_MAYOR
            ? 'Autoriza el Jefe de Base o el Gerente HSE'
            : 'Autoriza el Supervisor de Pumping',
      };
    });
  });

  protected elegir(preguntaId: string, opcionId: string): void {
    this.elegidas.update((m) => ({ ...m, [preguntaId]: opcionId }));
  }

  /**
   * Llenado rápido: responde cada pregunta pendiente con su opción de menor puntaje (nunca una que impida conducir), para no marcar
   * una por una. No pisa lo elegido a mano. Se busca el mínimo, no la primera opción: no todas vienen ordenadas por riesgo.
   */
  protected llenadoRapidoRiesgo(): void {
    this.elegidas.update((m) => {
      const nuevas = { ...m };
      for (const p of this.preguntas()) {
        if (nuevas[p.id]) continue;
        const mejor = p.opciones
          .filter((o) => !o.impideConducir)
          .reduce<(typeof p.opciones)[number] | null>(
            (a, o) => (!a || o.puntos < a.puntos ? o : a),
            null,
          );
        if (mejor) nuevas[p.id] = mejor.id;
      }
      return nuevas;
    });
  }

  // ── Paso 3: Plan y ruta ──
  protected readonly passengerDraft = signal('');
  protected readonly passengersList = signal<string[]>([]);
  protected readonly passengersLabel = computed(() => {
    const count = this.passengersList().length;
    return count > 0 ? `Pasajeros (${count} agregado${count === 1 ? '' : 's'})` : 'Pasajeros';
  });
  protected readonly canCombineTrips = signal<string[]>([]);
  protected readonly combineOptions = ['Sí', 'No'];

  protected addPassenger(): void {
    const name = this.passengerDraft().trim();
    if (!name) return;
    this.passengersList.update((list) => [...list, name]);
    this.passengerDraft.set('');
  }
  protected removePassenger(index: number): void {
    this.passengersList.update((list) => list.filter((_, i) => i !== index));
  }
  protected onPassengerDraftKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addPassenger();
    } else if (event.key === 'Backspace' && this.passengerDraft() === '') {
      this.passengersList.update((list) => list.slice(0, -1));
    }
  }

  protected readonly routeLocation = signal('');
  protected readonly routeArrivalTime = signal('');
  protected readonly routeDepartureTime = signal('');
  protected readonly routeOvernightDetails = signal('');
  protected readonly commFrequency = signal('');
  protected readonly commContactPerson = signal('');
  protected readonly commContactDetails = signal('');

  // ── Paso 4: Confirmación ──
  protected readonly conductorNames = signal(this.auth.currentUser()?.name ?? '');

  protected readonly puedeGuardar = computed(() => {
    const r = this.riesgo();
    return (
      this.fecha() !== null &&
      this.motivoViaje().trim().length >= 3 &&
      !!this.unidad() &&
      !!this.inspeccionSalida() &&
      r.sinContestar === 0 &&
      !r.impide &&
      this.routeLocation().trim().length > 0 &&
      [this.routeArrivalTime(), this.routeDepartureTime()].every((h) => !h || HORA.test(h))
    );
  });

  constructor() {
    const que = this.data.tipo === 'salida' ? 'Traslado' : 'Retorno';
    this.motivoViaje.set(
      `${que} de la unidad ${this.placas() || '—'} — ticket ${this.ticketCode()}`,
    );
    this.api.unidades().subscribe((u) => this.unidades.set(u));
    this.inspecciones.casos(this.data.ticket.ticketId).subscribe({
      next: (casos) => {
        const caso = casos.find((c) => c.unidad.id === this.data.unidadId);
        if (!caso?.salidaInspeccionId) {
          this.cargandoInspeccion.set(false);
          return;
        }
        this.inspecciones.obtener(caso.salidaInspeccionId).subscribe({
          next: (i) => {
            this.inspeccionSalida.set(i);
            this.cargandoInspeccion.set(false);
          },
          error: () => this.cargandoInspeccion.set(false),
        });
      },
      error: () => this.cargandoInspeccion.set(false),
    });
    this.api.preguntas().subscribe((p) => this.preguntas.set(p));
    this.api.umbrales().subscribe((u) => this.umbrales.set(u));
  }

  protected goToNextStep(): void {
    if (this.currentStep() === 0 && !this.inspeccionSalida()) {
      this.notify.error(
        'Falta la inspección',
        'Registre la inspección de salida de la unidad antes de continuar.',
      );
      return;
    }
    if (this.currentStep() < this.steps.length - 1) this.currentStep.update((s) => s + 1);
  }
  protected goToPreviousStep(): void {
    if (this.currentStep() > 0) this.currentStep.update((s) => s - 1);
  }
  protected cancelar(): void {
    this.modalRef.close(false);
  }

  protected guardar(): void {
    if (!this.puedeGuardar() || this.submitting()) return;
    const vacio = (s: string) => s.trim() || null;
    const hora = (h: string) => (HORA.test(h) ? h : null);
    this.submitting.set(true);
    this.api
      .solicitar({
        tipo: this.tipo(),
        ticketId: this.data.ticket.ticketId,
        unidadId: this.unidad()!.id,
        fecha: aFechaIso(this.fecha())!,
        motivo: this.motivoViaje().trim(),
        respuestas: this.preguntas().map((p) => ({
          preguntaId: p.id,
          opcionId: this.elegidas()[p.id],
        })),
        pasajeros: this.passengersList().join(', ') || null,
        puedeCombinarViajes:
          this.canCombineTrips()[0] === 'Sí'
            ? true
            : this.canCombineTrips()[0] === 'No'
              ? false
              : null,
        horaSalida: hora(this.routeDepartureTime()),
        horaLlegada: hora(this.routeArrivalTime()),
        datosPernocta: vacio(this.routeOvernightDetails()),
        paradas: [
          {
            lugar: this.routeLocation().trim(),
            horaLlegada: hora(this.routeArrivalTime()),
            horaSalida: hora(this.routeDepartureTime()),
            detallePernocta: vacio(this.routeOvernightDetails()),
          },
        ],
        comunicaciones:
          this.commFrequency().trim() && this.commContactPerson().trim()
            ? [
                {
                  frecuencia: this.commFrequency().trim(),
                  personaContacto: this.commContactPerson().trim(),
                  datosContacto: vacio(this.commContactDetails()),
                },
              ]
            : [],
      })
      .subscribe({
        next: (r) => {
          this.notify.success(
            'Gerenciamiento de viaje enviado',
            `${r.codigo} — pendiente de autorización ${this.revisor()}.`,
          );
          this.modalRef.close(true);
        },
        error: (e: HttpErrorResponse) => {
          this.submitting.set(false);
          this.notify.error(
            'No se pudo enviar',
            mensajeDeError(e, 'No se pudo registrar el gerenciamiento de viaje.'),
          );
        },
      });
  }
}
