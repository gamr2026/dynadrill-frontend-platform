import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { Observable } from 'rxjs';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDialogService,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import { EmergenciaHospitalDialog } from '../../components/emergencia-hospital-dialog';
import {
  CONSCIENCIA_ETIQUETA,
  ESTADO_EMERGENCIA_ETIQUETA,
  ETAPA_MEDEVAC_ETIQUETA,
  MEDIO_TRANSPORTE_ETIQUETA,
  MEDIOS_TRANSPORTE,
  NIVEL_EMERGENCIA_ETIQUETA,
  NIVELES_CONSCIENCIA,
  NIVELES_EMERGENCIA,
  PERMISO_EMERGENCIAS_GESTIONAR,
  TRIAGE_ETIQUETA,
  TRIAGES,
  enteroDeTexto,
  estadoPasoCascada,
  etiquetaHospital,
  faltantes,
  pendientesDeCierre,
  resumenSignos,
  type EmergenciaDetalle,
  type Herido,
  type Hospital,
  type MedioTransporte,
  type NivelConsciencia,
  type NivelEmergencia,
  type TriageColor,
} from '../../models/emergencia';
import { EmergenciaService } from '../../services/emergencia.service';

const NIVEL_OPCIONES: DynadrillSelectOption[] = NIVELES_EMERGENCIA.map((n) => ({
  label: NIVEL_EMERGENCIA_ETIQUETA[n],
  value: n,
}));

const TRIAGE_OPCIONES: DynadrillSelectOption[] = TRIAGES.map((c) => ({
  label: TRIAGE_ETIQUETA[c],
  value: c,
}));

const TRIAGE_TONO: Record<TriageColor, DynadrillTagVariant> = {
  rojo: 'error',
  amarillo: 'warning',
  verde: 'success',
  negro: 'neutral',
};

const TRANSPORTE_OPCIONES: DynadrillSelectOption[] = MEDIOS_TRANSPORTE.map((m) => ({
  label: MEDIO_TRANSPORTE_ETIQUETA[m],
  value: m,
}));

/** Lo que el equipo HSE va eligiendo del MEDEVAC de un herido antes de guardarlo. */
interface BorradorMedevac {
  medioTransporte?: MedioTransporte;
  hospitalId?: string;
  etaMinutos?: string;
}

/** HSE-TRIAGE-001 — gestión completa de la emergencia: nivel, cronómetro, conteo, heridos y MEDEVAC, cascada de notificación, Reporte Flash y cierre. */
@Component({
  selector: 'app-emergencia-plataforma-detail-page',
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillContextCardComponent,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillSelectComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './emergencia-detail-page.html',
  styleUrl: './emergencia-detail-page.scss',
})
export class EmergenciaDetailPage {
  private readonly servicio = inject(EmergenciaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialogos = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly estadoEtiqueta = ESTADO_EMERGENCIA_ETIQUETA;
  protected readonly nivelOpciones = NIVEL_OPCIONES;
  protected readonly triageOpciones = TRIAGE_OPCIONES;
  protected readonly triageEtiqueta = TRIAGE_ETIQUETA;
  protected readonly triageTono = TRIAGE_TONO;
  protected readonly transporteOpciones = TRANSPORTE_OPCIONES;
  protected readonly etapaEtiqueta = ETAPA_MEDEVAC_ETIQUETA;
  protected readonly medioEtiqueta = MEDIO_TRANSPORTE_ETIQUETA;
  protected readonly nivelesConsciencia = NIVELES_CONSCIENCIA;
  protected readonly conscienciaEtiqueta = CONSCIENCIA_ETIQUETA;
  protected readonly resumenSignos = resumenSignos;
  protected readonly estadoPaso = estadoPasoCascada;

  protected readonly cargando = signal(true);
  protected readonly evento = signal<EmergenciaDetalle | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly hospitales = signal<Hospital[]>([]);

  /** Quien puede gestionar ve los botones de acción; quien solo ve, solo lee. */
  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_EMERGENCIAS_GESTIONAR));
  protected readonly abierta = computed(() => this.evento()?.estado !== 'cerrada');
  protected readonly puedeActuar = computed(() => this.puedeGestionar() && this.abierta());

  // ── Cronómetro ──
  protected readonly nuevoEventoTexto = signal('');

  // ── Conteo de personal ──
  protected readonly totalEnLocacion = signal('');
  protected readonly evacuados = signal('');

  // ── Nuevo herido ──
  protected readonly nuevoHeridoNombre = signal('');
  protected readonly nuevoHeridoCedula = signal('');
  protected readonly nuevoHeridoTriage = signal<TriageColor>('verde');
  protected readonly nuevoHeridoMecanismo = signal('');
  protected readonly nuevoHeridoLesiones = signal('');

  // ── MEDEVAC: lo que se va eligiendo por herido ──
  protected readonly borradores = signal<Record<string, BorradorMedevac>>({});

  // ── Reporte Flash ──
  protected readonly flashResumen = signal('');
  protected readonly flashPersonalAfectado = signal('');
  protected readonly flashAcciones = signal('');
  protected readonly flashEstado = signal('');
  protected readonly flashProximosPasos = signal('');

  protected readonly opcionesHospital = computed<DynadrillSelectOption[]>(() =>
    this.hospitales().map((h) => ({ value: h.id, label: etiquetaHospital(h) })),
  );

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const e = this.evento();
    if (!e) return [];
    return [
      { label: 'Evento', value: e.codigo },
      { label: 'Tipo', value: e.tipo.nombre },
      { label: 'Ubicación', value: e.ubicacion || '—' },
      { label: 'Activado por', value: e.activadoPor ?? '—' },
      {
        label: 'Nivel',
        value: e.nivel ? NIVEL_EMERGENCIA_ETIQUETA[e.nivel.valor] : 'Sin declarar',
      },
      { label: 'Estado', value: ESTADO_EMERGENCIA_ETIQUETA[e.estado] },
      ...(e.ticketId
        ? [
            {
              label: 'Servicio',
              value: `${e.pedidoCodigo ?? ''} · Ticket ${e.ticketNumero ?? '—'}${e.cliente ? ` · ${e.cliente}` : ''}`,
            },
          ]
        : []),
    ];
  });

  protected readonly conteoItems = computed<DynadrillContextCardItem[]>(() => {
    const c = this.evento()?.conteo;
    if (!c) return [];
    return [
      { label: 'Total en locación', value: c.totalEnLocacion.toString() },
      { label: 'Evacuados', value: c.evacuados.toString() },
      { label: 'Faltantes', value: faltantes(c).toString() },
    ];
  });

  protected readonly pendientes = computed(() => {
    const e = this.evento();
    return e ? pendientesDeCierre(e) : [];
  });

  protected readonly puedeAgregarHerido = computed(
    () =>
      this.nuevoHeridoNombre().trim().length > 0 && this.nuevoHeridoMecanismo().trim().length > 0,
  );

  protected readonly puedeEmitirFlash = computed(() =>
    [
      this.flashResumen(),
      this.flashPersonalAfectado(),
      this.flashAcciones(),
      this.flashEstado(),
      this.flashProximosPasos(),
    ].every((t) => t.trim().length > 0),
  );

  constructor() {
    this.servicio.detalle(this.id).subscribe({
      next: (e) => {
        this.aplicar(e);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar la emergencia.'));
      },
    });
    this.cargarHospitales();
  }

  /** Muestra el detalle que devolvió el backend y prellena el conteo con el vigente. */
  private aplicar(e: EmergenciaDetalle): void {
    this.evento.set(e);
    if (e.conteo) {
      this.totalEnLocacion.set(e.conteo.totalEnLocacion.toString());
      this.evacuados.set(e.conteo.evacuados.toString());
    }
  }

  private cargarHospitales(): void {
    this.servicio.hospitales().subscribe({
      next: (h) => this.hospitales.set(h),
      error: () => undefined,
    });
  }

  /** Ejecuta una acción del backend: muestra el detalle resultante o el mensaje con el que el backend la rechazó. */
  private ejecutar(
    llamada: Observable<EmergenciaDetalle>,
    exito: string,
    alTerminar?: () => void,
  ): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    llamada.subscribe({
      next: (e) => {
        this.aplicar(e);
        this.trabajando.set(false);
        this.notify.success('Listo', exito);
        alTerminar?.();
      },
      error: (err) => {
        this.trabajando.set(false);
        this.notify.error('No se pudo', mensajeDeError(err, 'No se pudo completar la acción.'));
      },
    });
  }

  // ── Cronómetro ──

  protected agregarEvento(): void {
    const texto = this.nuevoEventoTexto().trim();
    if (!texto) return;
    this.ejecutar(
      this.servicio.agregarLinea(this.id, texto),
      'Acción registrada en el cronómetro.',
      () => this.nuevoEventoTexto.set(''),
    );
  }

  // ── Nivel ──

  protected declararNivel(nivel: NivelEmergencia | null): void {
    if (!nivel || nivel === this.evento()?.nivel?.valor) return;
    this.ejecutar(
      this.servicio.declararNivel(this.id, Number(nivel) as NivelEmergencia),
      'Nivel declarado.',
    );
  }

  // ── Conteo de personal ──

  protected completarConteo(): void {
    const total = enteroDeTexto(this.totalEnLocacion());
    const evacuados = enteroDeTexto(this.evacuados());
    if (total === undefined || evacuados === undefined) {
      this.notify.error(
        'Revise el conteo',
        'Indique el total en la locación y los evacuados, en número de personas.',
      );
      return;
    }
    this.ejecutar(
      this.servicio.registrarConteo(this.id, total, evacuados),
      'Conteo de personal registrado.',
    );
  }

  // ── Cascada de notificación ──

  protected notificarPaso(pasoId: string): void {
    this.ejecutar(this.servicio.notificarPaso(this.id, pasoId), 'Notificación registrada.');
  }

  // ── Heridos ──

  protected agregarHerido(): void {
    if (!this.puedeAgregarHerido()) return;
    const cedula = this.nuevoHeridoCedula().trim();
    const lesiones = this.nuevoHeridoLesiones().trim();
    this.ejecutar(
      this.servicio.registrarHerido(this.id, {
        nombreCompleto: this.nuevoHeridoNombre().trim(),
        triage: this.nuevoHeridoTriage(),
        mecanismoLesion: this.nuevoHeridoMecanismo().trim(),
        ...(cedula ? { cedula } : {}),
        ...(lesiones ? { lesiones } : {}),
      }),
      'Herido registrado.',
      () => {
        this.nuevoHeridoNombre.set('');
        this.nuevoHeridoCedula.set('');
        this.nuevoHeridoTriage.set('verde');
        this.nuevoHeridoMecanismo.set('');
        this.nuevoHeridoLesiones.set('');
      },
    );
  }

  protected cambiarTriage(herido: Herido, triage: TriageColor | null): void {
    if (!triage || triage === herido.triage) return;
    this.ejecutar(
      this.servicio.actualizarHerido(this.id, herido.id, { triage }),
      'Triage actualizado.',
    );
  }

  protected registrarSignos(
    herido: Herido,
    pulso: string,
    sistolica: string,
    diastolica: string,
    respiracion: string,
    consciencia: string,
  ): void {
    const p = pulso.trim() ? enteroDeTexto(pulso) : undefined;
    const s = sistolica.trim() ? enteroDeTexto(sistolica) : undefined;
    const d = diastolica.trim() ? enteroDeTexto(diastolica) : undefined;
    const r = respiracion.trim() ? enteroDeTexto(respiracion) : undefined;
    const invalido =
      (pulso.trim() && p === undefined) ||
      (sistolica.trim() && s === undefined) ||
      (diastolica.trim() && d === undefined) ||
      (respiracion.trim() && r === undefined);
    if (invalido) {
      this.notify.error(
        'Revise los signos vitales',
        'Escriba números enteros en pulso, presión y respiración.',
      );
      return;
    }
    if ((s === undefined) !== (d === undefined)) {
      this.notify.error(
        'Revise la presión',
        'La presión arterial se registra completa: sistólica y diastólica.',
      );
      return;
    }
    const c = NIVELES_CONSCIENCIA.find((n) => n === consciencia);
    if (p === undefined && s === undefined && r === undefined && !c) {
      this.notify.error(
        'Falta una medida',
        'Registre al menos pulso, presión, respiración o consciencia.',
      );
      return;
    }
    this.ejecutar(
      this.servicio.registrarSignos(this.id, herido.id, {
        ...(p !== undefined ? { pulso: p } : {}),
        ...(s !== undefined && d !== undefined
          ? { presionSistolica: s, presionDiastolica: d }
          : {}),
        ...(r !== undefined ? { respiracion: r } : {}),
        ...(c ? { consciencia: c as NivelConsciencia } : {}),
      }),
      'Signos vitales registrados.',
    );
  }

  // ── MEDEVAC ──

  protected activarMedevac(herido: Herido): void {
    this.ejecutar(this.servicio.activarMedevac(this.id, herido.id), 'MEDEVAC activado.');
  }

  protected medioDe(herido: Herido): MedioTransporte | null {
    return this.borradores()[herido.id]?.medioTransporte ?? herido.medevac?.medioTransporte ?? null;
  }

  protected hospitalDe(herido: Herido): string | null {
    return this.borradores()[herido.id]?.hospitalId ?? herido.medevac?.hospital?.id ?? null;
  }

  protected etaDe(herido: Herido): string {
    return this.borradores()[herido.id]?.etaMinutos ?? herido.medevac?.etaMinutos?.toString() ?? '';
  }

  protected elegirMedio(herido: Herido, medio: MedioTransporte | null): void {
    this.borradores.update((b) => ({
      ...b,
      [herido.id]: { ...b[herido.id], medioTransporte: medio ?? undefined },
    }));
  }

  protected elegirHospital(herido: Herido, hospitalId: string | null): void {
    this.borradores.update((b) => ({
      ...b,
      [herido.id]: { ...b[herido.id], hospitalId: hospitalId ?? undefined },
    }));
  }

  protected elegirEta(herido: Herido, eta: string): void {
    this.borradores.update((b) => ({ ...b, [herido.id]: { ...b[herido.id], etaMinutos: eta } }));
  }

  protected agregarHospital(herido: Herido): void {
    const ref = this.dialogos.open<EmergenciaHospitalDialog>({
      title: 'Agregar hospital al catálogo',
      content: EmergenciaHospitalDialog,
      footer: false,
      width: '460px',
    });
    ref.afterClose.subscribe((h) => {
      if (!h) return;
      this.hospitales.update((lista) => [...lista, h]);
      this.elegirHospital(herido, h.id);
    });
  }

  protected guardarMedevac(herido: Herido): void {
    const medio = this.medioDe(herido);
    const hospitalId = this.hospitalDe(herido);
    const etaTexto = this.etaDe(herido).trim();
    const eta = etaTexto ? enteroDeTexto(etaTexto) : undefined;
    if (etaTexto && (eta === undefined || eta < 1)) {
      this.notify.error(
        'Revise el ETA',
        'El tiempo estimado de llegada se escribe en minutos enteros, mayor que cero.',
      );
      return;
    }
    if (!medio && !hospitalId && eta === undefined) {
      this.notify.error('Falta información', 'Elija el medio de transporte, el hospital o el ETA.');
      return;
    }
    this.ejecutar(
      this.servicio.datosMedevac(this.id, herido.id, {
        ...(medio ? { medioTransporte: medio } : {}),
        ...(hospitalId ? { hospitalId } : {}),
        ...(eta !== undefined ? { etaMinutos: eta } : {}),
      }),
      'Datos del MEDEVAC guardados.',
      () =>
        this.borradores.update((b) => {
          const resto = { ...b };
          delete resto[herido.id];
          return resto;
        }),
    );
  }

  protected notificarHospital(herido: Herido): void {
    this.ejecutar(this.servicio.notificarHospital(this.id, herido.id), 'Hospital notificado.');
  }

  protected transferirHerido(herido: Herido): void {
    this.ejecutar(this.servicio.transferir(this.id, herido.id), 'Herido transferido al hospital.');
  }

  // ── Reporte Flash ──

  protected emitirReporteFlash(): void {
    if (!this.puedeEmitirFlash()) return;
    this.ejecutar(
      this.servicio.emitirReporteFlash(this.id, {
        resumenEjecutivo: this.flashResumen().trim(),
        personalAfectado: this.flashPersonalAfectado().trim(),
        accionesTomadas: this.flashAcciones().trim(),
        estadoActual: this.flashEstado().trim(),
        proximosPasos: this.flashProximosPasos().trim(),
      }),
      'Reporte Flash emitido.',
    );
  }

  // ── Control y cierre ──

  protected marcarControlada(): void {
    this.ejecutar(this.servicio.controlar(this.id), 'Emergencia marcada como controlada.');
  }

  protected cerrar(): void {
    this.ejecutar(this.servicio.cerrar(this.id), 'Emergencia cerrada.');
  }

  protected back(): void {
    void this.router.navigate(['/dashboard/qhse/emergencias']);
  }
}
