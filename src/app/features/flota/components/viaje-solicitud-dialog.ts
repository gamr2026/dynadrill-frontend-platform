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
import { FlotaViajesService } from '../services/flota-viajes.service';
import {
  NIVEL_LABEL,
  TIPO_VIAJE_LABEL,
  previsualizarRiesgo,
  type BodegaViaje,
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
  vehiculoId: string;
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
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ViajeSolicitudDialog, boolean>);

  protected readonly steps = STEPS;
  protected readonly currentStep = signal(0);
  protected readonly submitting = signal(false);
  protected readonly tipo = signal<TipoViaje>(this.data.tipo);
  protected readonly tipoLabel = TIPO_VIAJE_LABEL[this.data.tipo].toLowerCase();

  private readonly unidades = signal<UnidadViaje[]>([]);
  protected readonly bodegas = signal<BodegaViaje[]>([]);
  protected readonly preguntas = signal<PreguntaRiesgo[]>([]);
  private readonly umbrales = signal<UmbralRiesgo[]>([]);

  // ── Paso 1: Información general ──
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly motivoViaje = signal('');
  protected readonly bodegaId = signal<string | null>(null);
  protected readonly vehicleTypeOptions = VEHICLE_TYPE_OPTIONS;

  private readonly unidad = computed(
    () => this.unidades().find((u) => u.vehiculoId === this.data.vehiculoId) ?? null,
  );
  protected readonly vehicleType = computed<'Liviano' | 'Pesado' | null>(() => {
    const c = this.unidad()?.categoriaPeso;
    return c === 'pesado' ? 'Pesado' : c === 'liviano' ? 'Liviano' : null;
  });
  protected readonly placas = computed(
    () =>
      this.unidad()?.placa ??
      this.data.ticket.unidades.find((u) => u.vehiculoId === this.data.vehiculoId)?.placa ??
      '',
  );

  protected readonly ticketCode = signal(
    String(this.data.ticket.ticketNumero ?? this.data.ticket.pedidoCodigo),
  );
  protected readonly lineaServicio = signal(
    this.data.ticket.serviciosPrincipales.map((s) => s.nombre).join(', '),
  );
  protected readonly assignedSupervisorNombre = signal(this.data.ticket.supervisor?.nombre ?? '');
  protected readonly pozoDelTicket = computed(() => this.data.ticket.destino.pozo);
  private readonly baseNombre = computed(
    () => this.bodegas().find((b) => b.id === this.bodegaId())?.nombre ?? '—',
  );
  protected readonly origen = computed(() =>
    this.tipo() === 'salida' ? this.baseNombre() : (this.pozoDelTicket()?.nombre ?? '—'),
  );
  protected readonly destino = computed(() =>
    this.tipo() === 'salida' ? (this.pozoDelTicket()?.nombre ?? '—') : this.baseNombre(),
  );
  protected readonly bodegaOpciones = computed<DynadrillSelectOption[]>(() =>
    this.bodegas().map((b) => ({ label: b.nombre, value: b.id })),
  );

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
      !!this.pozoDelTicket() &&
      !!this.bodegaId() &&
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
    this.api.bodegas().subscribe((b) => {
      this.bodegas.set(b);
      if (b.length === 1) this.bodegaId.set(b[0].id);
    });
    this.api.preguntas().subscribe((p) => this.preguntas.set(p));
    this.api.umbrales().subscribe((u) => this.umbrales.set(u));
  }

  protected goToNextStep(): void {
    if (this.currentStep() === 0 && !this.bodegaId()) {
      this.notify.error('Falta información', 'Elija la base del viaje antes de continuar.');
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
    const pozo = this.pozoDelTicket()!.id;
    const base = this.bodegaId()!;
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
        origen: this.tipo() === 'salida' ? { bodegaId: base } : { pozoId: pozo },
        destino: this.tipo() === 'salida' ? { pozoId: pozo } : { bodegaId: base },
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
