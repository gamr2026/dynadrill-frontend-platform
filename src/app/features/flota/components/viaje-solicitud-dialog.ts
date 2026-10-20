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
  DynadrillTextareaComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { FlotaInspeccionesService } from '../services/flota-inspecciones.service';
import { FlotaViajesService } from '../services/flota-viajes.service';
import {
  NIVEL_LABEL,
  previsualizarRiesgo,
  type BodegaViaje,
  type PreguntaRiesgo,
  type TipoViaje,
  type UmbralRiesgo,
  type UnidadViaje,
  type ViajeContextoPumping,
} from '../models/viaje-flota.model';
import { aFechaIso, mensajeDeError } from '../utils/flota.util';

const STEPS = ['Viaje', 'Riesgo', 'Plan y ruta', 'Confirmar'];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Al abrirlo desde una tarea del conductor el ticket, el tipo y la unidad ya vienen definidos y no se cambian. */
export interface ViajeSolicitudDialogData {
  ticketId: string;
  tipo: TipoViaje;
  vehiculoId: string;
}

interface FilaParada {
  lugar: string;
  llegada: string;
  salida: string;
  pernocta: string;
}
interface FilaContacto {
  frecuencia: string;
  persona: string;
  datos: string;
}

/**
 * Solicitud del Gerenciamiento de Viaje (DYN-SGI-RE-049) por el Conductor. Los tickets salen de Pumping (`mis-viajes`); el origen es
 * la base y el destino el pozo del ticket (al revés en el retorno). El puntaje mostrado es una vista previa: lo decide el servidor.
 */
@Component({
  selector: 'app-viaje-solicitud-dialog',
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    DynadrillButtonComponent,
    DynadrillDatetimePickerComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillStepperComponent,
    DynadrillTextareaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './viaje-solicitud-dialog.html',
  styleUrl: './viaje-solicitud-dialog.scss',
})
export class ViajeSolicitudDialog {
  private readonly api = inject(FlotaViajesService);
  private readonly inspecciones = inject(FlotaInspeccionesService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<ViajeSolicitudDialog, boolean>);
  private readonly tarea = inject<ViajeSolicitudDialogData | null>(NZ_MODAL_DATA, {
    optional: true,
  });
  /** Viene de una tarea: ticket, tipo y unidad están definidos. */
  protected readonly fijo = this.tarea !== null;

  protected readonly steps = STEPS;
  protected readonly nivelTexto = NIVEL_LABEL;
  protected readonly paso = signal(0);
  protected readonly enviando = signal(false);
  protected readonly cargando = signal(true);

  protected readonly tickets = signal<ViajeContextoPumping[]>([]);
  protected readonly unidades = signal<UnidadViaje[]>([]);
  protected readonly bodegas = signal<BodegaViaje[]>([]);
  protected readonly preguntas = signal<PreguntaRiesgo[]>([]);
  protected readonly umbrales = signal<UmbralRiesgo[]>([]);

  protected readonly tipo = signal<TipoViaje>('salida');
  protected readonly ticketId = signal<string | null>(null);
  protected readonly unidadId = signal<string | null>(null);
  protected readonly bodegaId = signal<string | null>(null);
  protected readonly fecha = signal<Date | null>(new Date());
  protected readonly motivo = signal('');
  protected readonly elegidas = signal<Record<string, string>>({});
  protected readonly horaSalida = signal('');
  protected readonly horaLlegada = signal('');
  protected readonly pasajeros = signal('');
  protected readonly combinar = signal<boolean | null>(null);
  protected readonly pernocta = signal('');
  protected readonly telefonicaDe = signal('');
  protected readonly telefonicaHora = signal('');
  protected readonly paradas = signal<FilaParada[]>([]);
  protected readonly contactos = signal<FilaContacto[]>([]);

  protected readonly tipoOpciones: DynadrillSelectOption[] = [
    { label: 'Salida (de la base al pozo)', value: 'salida' },
    { label: 'Retorno (del pozo a la base)', value: 'retorno' },
  ];
  protected readonly combinarOpciones: DynadrillSelectOption[] = [
    { label: 'Sí', value: 'si' },
    { label: 'No', value: 'no' },
  ];
  protected readonly ticketOpciones = computed<DynadrillSelectOption[]>(() =>
    this.tickets().map((t) => ({
      label: `Ticket ${t.ticketNumero ?? t.pedidoCodigo} · ${t.cliente?.nombre ?? 'sin cliente'} · ${t.destino.pozo?.nombre ?? 'sin pozo'}`,
      value: t.ticketId,
    })),
  );
  protected readonly unidadOpciones = computed<DynadrillSelectOption[]>(() =>
    this.unidades().map((u) => ({ label: `${u.codigo} — ${u.placa ?? u.nombre}`, value: u.id })),
  );
  protected readonly bodegaOpciones = computed<DynadrillSelectOption[]>(() =>
    this.bodegas().map((b) => ({ label: b.nombre, value: b.id })),
  );

  protected readonly ticket = computed(
    () => this.tickets().find((t) => t.ticketId === this.ticketId()) ?? null,
  );
  protected readonly pozoDelTicket = computed(() => this.ticket()?.destino.pozo ?? null);
  protected readonly riesgo = computed(() =>
    previsualizarRiesgo(this.preguntas(), this.elegidas(), this.umbrales()),
  );
  protected readonly descripcionNivel = computed(
    () => this.umbrales().find((u) => u.nivel === this.riesgo().nivel)?.descripcion ?? '',
  );
  protected readonly bodegaNombre = computed(
    () => this.bodegas().find((b) => b.id === this.bodegaId())?.nombre ?? '—',
  );

  protected readonly rutaTexto = computed(() => {
    const base = this.bodegaNombre();
    const pozo = this.pozoDelTicket()?.nombre ?? '—';
    return this.tipo() === 'salida' ? `${base} → ${pozo}` : `${pozo} → ${base}`;
  });

  protected readonly motivoNoEnviar = computed(() => {
    if (!this.ticketId()) return 'Elija el ticket del viaje.';
    if (!this.pozoDelTicket()) return 'El ticket no tiene pozo: no se puede armar la ruta.';
    if (!this.unidadId()) return 'Elija la unidad.';
    if (!this.bodegaId()) return 'Elija la base de origen o destino.';
    if (!this.fecha()) return 'Indique la fecha.';
    if (this.motivo().trim().length < 3) return 'Indique el motivo del viaje.';
    const r = this.riesgo();
    if (r.sinContestar > 0) return `Falta contestar ${r.sinContestar} pregunta(s) del riesgo.`;
    if (r.impide) return `La respuesta «${r.impide}» indica que no debe viajar.`;
    for (const h of [this.horaSalida(), this.horaLlegada()])
      if (h && !HORA.test(h)) return 'Las horas van como HH:MM (por ejemplo 06:30).';
    return '';
  });

  /** La unidad de la tarea, con su placa, para mostrarla y para el motivo sugerido. */
  protected readonly unidadFija = computed(
    () => this.unidades().find((u) => u.vehiculoId === this.tarea?.vehiculoId) ?? null,
  );

  constructor() {
    if (this.tarea) this.tipo.set(this.tarea.tipo);
    this.api.misViajesPumping().subscribe({
      next: (t) => {
        this.tickets.set(t);
        if (this.tarea) this.elegirTicket(this.tarea.ticketId);
        else if (t.length === 1) this.elegirTicket(t[0].ticketId);
      },
      error: () => this.notify.error('Error', 'No se pudieron cargar sus tickets de Pumping.'),
    });
    this.api.unidades().subscribe((u) => {
      this.unidades.set(u);
      const fija = u.find((x) => x.vehiculoId === this.tarea?.vehiculoId);
      if (fija) {
        this.unidadId.set(fija.id);
        this.sugerirMotivo();
      }
    });
    this.api.bodegas().subscribe((b) => {
      this.bodegas.set(b);
      if (b.length === 1 && !this.bodegaId()) this.bodegaId.set(b[0].id);
      this.cargando.set(false);
    });
    this.api.preguntas().subscribe((p) => this.preguntas.set(p));
    this.api.umbrales().subscribe((u) => this.umbrales.set(u));
  }

  /** Motivo propuesto cuando viene de una tarea (la persona lo puede ajustar). */
  private sugerirMotivo(): void {
    const t = this.ticket();
    const u = this.unidadFija();
    if (!this.tarea || !t || !u || this.motivo()) return;
    const que = this.tarea.tipo === 'salida' ? 'Traslado' : 'Retorno';
    this.motivo.set(
      `${que} de la unidad ${u.placa ?? u.codigo} — ticket ${t.ticketNumero ?? t.pedidoCodigo}`,
    );
  }

  /** Al elegir el ticket se sugiere la unidad de la inspección que le abrió Pumping a esta cuenta. */
  protected elegirTicket(id: string | null): void {
    this.ticketId.set(id);
    if (!id) return;
    if (this.tarea) {
      this.sugerirMotivo();
      return; // la unidad ya está definida por la tarea
    }
    this.inspecciones.casos(id).subscribe({
      next: (casos) => {
        const caso = casos[0];
        if (caso && !this.unidadId()) this.unidadId.set(caso.unidad.id);
      },
      error: () => undefined, // la sugerencia es opcional: sin permiso o sin caso, se elige a mano
    });
  }

  protected elegir(preguntaId: string, opcionId: string): void {
    this.elegidas.update((m) => ({ ...m, [preguntaId]: opcionId }));
  }

  protected agregarParada(): void {
    this.paradas.update((l) => [...l, { lugar: '', llegada: '', salida: '', pernocta: '' }]);
  }
  protected cambiarParada(i: number, campo: keyof FilaParada, v: string): void {
    this.paradas.update((l) => l.map((f, k) => (k === i ? { ...f, [campo]: v } : f)));
  }
  protected quitarParada(i: number): void {
    this.paradas.update((l) => l.filter((_, k) => k !== i));
  }
  protected agregarContacto(): void {
    this.contactos.update((l) => [...l, { frecuencia: '', persona: '', datos: '' }]);
  }
  protected cambiarContacto(i: number, campo: keyof FilaContacto, v: string): void {
    this.contactos.update((l) => l.map((f, k) => (k === i ? { ...f, [campo]: v } : f)));
  }
  protected quitarContacto(i: number): void {
    this.contactos.update((l) => l.filter((_, k) => k !== i));
  }

  protected siguiente(): void {
    if (
      this.paso() === 0 &&
      (!this.ticketId() || !this.unidadId() || !this.bodegaId() || this.motivo().trim().length < 3)
    ) {
      this.notify.error(
        'Falta información',
        'Complete el ticket, la unidad, la base y el motivo antes de continuar.',
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

  protected enviar(): void {
    if (this.enviando() || this.motivoNoEnviar()) return;
    const pozo = this.pozoDelTicket()!.id;
    const base = this.bodegaId()!;
    const vacio = (s: string) => s.trim() || null;
    this.enviando.set(true);
    this.api
      .solicitar({
        tipo: this.tipo(),
        ticketId: this.ticketId()!,
        unidadId: this.unidadId()!,
        fecha: aFechaIso(this.fecha())!,
        motivo: this.motivo().trim(),
        origen: this.tipo() === 'salida' ? { bodegaId: base } : { pozoId: pozo },
        destino: this.tipo() === 'salida' ? { pozoId: pozo } : { bodegaId: base },
        respuestas: this.preguntas().map((p) => ({
          preguntaId: p.id,
          opcionId: this.elegidas()[p.id],
        })),
        pasajeros: vacio(this.pasajeros()),
        puedeCombinarViajes: this.combinar(),
        horaSalida: vacio(this.horaSalida()),
        horaLlegada: vacio(this.horaLlegada()),
        datosPernocta: vacio(this.pernocta()),
        aprobacionTelefonica:
          this.telefonicaDe().trim() && HORA.test(this.telefonicaHora())
            ? { de: this.telefonicaDe().trim(), hora: this.telefonicaHora() }
            : null,
        paradas: this.paradas()
          .filter((p) => p.lugar.trim())
          .map((p) => ({
            lugar: p.lugar.trim(),
            horaLlegada: HORA.test(p.llegada) ? p.llegada : null,
            horaSalida: HORA.test(p.salida) ? p.salida : null,
            detallePernocta: vacio(p.pernocta),
          })),
        comunicaciones: this.contactos()
          .filter((c) => c.frecuencia.trim() && c.persona.trim())
          .map((c) => ({
            frecuencia: c.frecuencia.trim(),
            personaContacto: c.persona.trim(),
            datosContacto: vacio(c.datos),
          })),
      })
      .subscribe({
        next: (r) => {
          this.notify.success(
            'Solicitud enviada',
            `${r.codigo} · riesgo ${r.nivel.toUpperCase()}: queda pendiente de autorización.`,
          );
          this.modalRef.close(true);
        },
        error: (e: HttpErrorResponse) => {
          this.enviando.set(false);
          this.notify.error(
            'No se pudo enviar',
            mensajeDeError(e, 'No se pudo enviar la solicitud.'),
          );
        },
      });
  }

  protected cambiarCombinar(v: string | null): void {
    this.combinar.set(v === 'si' ? true : v === 'no' ? false : null);
  }
}
