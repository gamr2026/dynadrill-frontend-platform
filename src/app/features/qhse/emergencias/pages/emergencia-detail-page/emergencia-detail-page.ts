import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
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
import {
  ConteoPersonal,
  conteoFaltantes,
  EMERGENCIA_ESTADO_LABELS,
  EMERGENCIA_NIVEL_LABELS,
  EmergenciaEvento,
  EmergenciaNivel,
  emergenciaNotificacionCompleta,
  emergenciaRequiereInvestigacion,
  Herido,
  MEDIO_TRANSPORTE_MEDEVAC_LABELS,
  MedioTransporteMedevac,
  reporteFlashVencido,
  TRIAGE_COLOR_LABELS,
  TriageColor,
} from '../../models/emergencia.model';
import { EmergenciaService } from '../../services/emergencia.service';
import { IncidenteResultado } from '../../../investigaciones/models/investigacion.model';
import { InvestigacionService } from '../../../investigaciones/services/investigacion.service';

const NIVEL_OPTIONS: DynadrillSelectOption[] = [
  { label: EMERGENCIA_NIVEL_LABELS[1], value: 1 },
  { label: EMERGENCIA_NIVEL_LABELS[2], value: 2 },
  { label: EMERGENCIA_NIVEL_LABELS[3], value: 3 },
];

const TRIAGE_OPTIONS: DynadrillSelectOption[] = (['rojo', 'amarillo', 'verde', 'negro'] as TriageColor[]).map(c => ({
  label: TRIAGE_COLOR_LABELS[c],
  value: c,
}));

const TRIAGE_TONE: Record<TriageColor, DynadrillTagVariant> = {
  rojo: 'error',
  amarillo: 'warning',
  verde: 'success',
  negro: 'neutral',
};

const TRANSPORTE_OPTIONS: DynadrillSelectOption[] = (['ambulancia', 'lancha', 'helicoptero'] as MedioTransporteMedevac[]).map(m => ({
  label: MEDIO_TRANSPORTE_MEDEVAC_LABELS[m],
  value: m,
}));

/** HSE-TRIAGE-001 — gestión completa del evento: cronómetro, conteo, triage/MEDEVAC, cascada de notificación, Reporte Flash y cierre. */
@Component({
  selector: 'app-emergencia-detail-page',
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
  private readonly emergenciaService = inject(EmergenciaService);
  private readonly investigacionService = inject(InvestigacionService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly estadoLabels = EMERGENCIA_ESTADO_LABELS;
  protected readonly nivelOptions = NIVEL_OPTIONS;
  protected readonly triageOptions = TRIAGE_OPTIONS;
  protected readonly triageLabels = TRIAGE_COLOR_LABELS;
  protected readonly triageTone = TRIAGE_TONE;
  protected readonly transporteOptions = TRANSPORTE_OPTIONS;
  protected readonly transporteLabels = MEDIO_TRANSPORTE_MEDEVAC_LABELS;

  protected readonly loading = signal(true);
  protected readonly evento = signal<EmergenciaEvento | null>(null);

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

  // ── Reporte Flash ──
  protected readonly flashResumen = signal('');
  protected readonly flashPersonalAfectado = signal('');
  protected readonly flashAcciones = signal('');
  protected readonly flashEstado = signal('');
  protected readonly flashProximosPasos = signal('');

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const e = this.evento();
    if (!e) return [];
    return [
      { label: 'Evento', value: e.code },
      { label: 'Tipo', value: e.tipo },
      { label: 'Ubicación', value: e.ubicacion || '—' },
      { label: 'Activado por', value: e.activadoPorNombre },
      { label: 'Nivel', value: e.nivel ? EMERGENCIA_NIVEL_LABELS[e.nivel] : 'Sin declarar' },
      { label: 'Estado', value: EMERGENCIA_ESTADO_LABELS[e.estado] },
    ];
  });

  protected readonly faltantes = computed(() => {
    const e = this.evento();
    return e ? conteoFaltantes(e.conteoPersonal) : 0;
  });

  protected readonly notificacionCompleta = computed(() => {
    const e = this.evento();
    return !!e && emergenciaNotificacionCompleta(e);
  });

  protected readonly flashVencido = computed(() => {
    const e = this.evento();
    return !!e && reporteFlashVencido(e);
  });

  protected readonly requiereInvestigacion = computed(() => {
    const e = this.evento();
    return !!e && emergenciaRequiereInvestigacion(e);
  });

  protected readonly puedeCerrar = computed(() => {
    const e = this.evento();
    if (!e) return false;
    return e.estado === 'controlada' && !!e.reporteFlash.emitidoAt;
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.emergenciaService.get(id).subscribe({
      next: e => {
        this.evento.set(e);
        this.flashResumen.set(e.reporteFlash.resumenEjecutivo);
        this.flashPersonalAfectado.set(e.reporteFlash.personalAfectado);
        this.flashAcciones.set(e.reporteFlash.accionesTomadas);
        this.flashEstado.set(e.reporteFlash.estadoActual);
        this.flashProximosPasos.set(e.reporteFlash.proximosPasos);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private patch(changes: Partial<EmergenciaEvento>): void {
    const current = this.evento();
    if (!current) return;
    this.evento.set({ ...current, ...changes });
    this.emergenciaService.update(current.id, changes).subscribe();
  }

  // ── Cronómetro ──

  protected agregarEvento(): void {
    const e = this.evento();
    const texto = this.nuevoEventoTexto().trim();
    if (!e || !texto) return;
    this.patch({ timeline: [...e.timeline, { timestamp: new Date().toISOString(), evento: texto }] });
    this.nuevoEventoTexto.set('');
  }

  // ── Nivel ──

  protected declararNivel(nivel: EmergenciaNivel): void {
    this.patch({ nivel });
  }

  // ── Conteo de personal ──

  protected completarConteo(): void {
    const e = this.evento();
    if (!e) return;
    const conteoPersonal: ConteoPersonal = {
      totalEnLocacion: Number(this.totalEnLocacion()) || 0,
      evacuados: Number(this.evacuados()) || 0,
      completadoAt: new Date().toISOString(),
    };
    this.patch({ conteoPersonal });
  }

  // ── Notificaciones en cascada ──

  protected notificarPaso(paso: number): void {
    const e = this.evento();
    if (!e) return;
    const notificaciones = e.notificaciones.map(n => (n.paso === paso && !n.notificadoAt ? { ...n, notificadoAt: new Date().toISOString() } : n));
    this.patch({ notificaciones });
  }

  // ── Heridos ──

  protected readonly puedeAgregarHerido = computed(
    () => this.nuevoHeridoNombre().trim().length > 0 && this.nuevoHeridoMecanismo().trim().length > 0,
  );

  protected agregarHerido(): void {
    const e = this.evento();
    if (!e || !this.puedeAgregarHerido()) return;
    const nuevo: Herido = {
      id: Date.now(),
      nombreCompleto: this.nuevoHeridoNombre().trim(),
      cedula: this.nuevoHeridoCedula().trim() || undefined,
      triageColor: this.nuevoHeridoTriage(),
      mecanismoLesion: this.nuevoHeridoMecanismo().trim(),
      lesiones: this.nuevoHeridoLesiones().trim(),
      signosVitales: [],
      medevacActivado: false,
    };
    this.patch({ heridos: [...e.heridos, nuevo] });
    this.nuevoHeridoNombre.set('');
    this.nuevoHeridoCedula.set('');
    this.nuevoHeridoTriage.set('verde');
    this.nuevoHeridoMecanismo.set('');
    this.nuevoHeridoLesiones.set('');
  }

  private patchHerido(id: number, changes: Partial<Herido>): void {
    const e = this.evento();
    if (!e) return;
    const heridos = e.heridos.map(h => (h.id === id ? { ...h, ...changes } : h));
    this.patch({ heridos });
  }

  protected activarMedevac(herido: Herido): void {
    this.patchHerido(herido.id, { medevacActivado: true });
  }

  protected actualizarMedevac(herido: Herido, changes: Partial<Herido>): void {
    this.patchHerido(herido.id, changes);
  }

  protected notificarHospital(herido: Herido): void {
    this.patchHerido(herido.id, { hospitalNotificadoAt: new Date().toISOString() });
  }

  protected transferirHerido(herido: Herido): void {
    this.patchHerido(herido.id, { transferidoAt: new Date().toISOString() });
  }

  protected registrarSignosVitales(herido: Herido, pulso: string, presion: string, respiracion: string, consciencia: string): void {
    const entry = {
      registradoAt: new Date().toISOString(),
      pulso: pulso ? Number(pulso) : undefined,
      presion: presion || undefined,
      respiracion: respiracion ? Number(respiracion) : undefined,
      consciencia: consciencia || undefined,
    };
    this.patchHerido(herido.id, { signosVitales: [...herido.signosVitales, entry] });
  }

  // ── Reporte Flash ──

  protected emitirReporteFlash(): void {
    const e = this.evento();
    if (!e) return;
    this.patch({
      reporteFlash: {
        resumenEjecutivo: this.flashResumen(),
        personalAfectado: this.flashPersonalAfectado(),
        accionesTomadas: this.flashAcciones(),
        estadoActual: this.flashEstado(),
        proximosPasos: this.flashProximosPasos(),
        emitidoAt: new Date().toISOString(),
      },
    });
    this.notify.success('Reporte Flash emitido', 'Se registró dentro del plazo de 2 horas.');
  }

  // ── Cierre ──

  protected marcarControlada(): void {
    this.patch({ estado: 'controlada', controladaAt: new Date().toISOString() });
  }

  // ── Investigación de Incidentes (HSE-TRIAGE-002) ──

  protected readonly abriendoInvestigacion = signal(false);

  protected abrirInvestigacion(): void {
    const e = this.evento();
    if (!e || this.abriendoInvestigacion()) return;
    this.abriendoInvestigacion.set(true);
    const resultado: IncidenteResultado = e.nivel === 3 ? 'grave' : 'leve';
    this.investigacionService
      .abrir({
        resultado,
        descripcionEvento: e.descripcion,
        fechaIncidente: e.activadoAt,
        ubicacion: e.ubicacion ?? '',
        origenEmergenciaId: e.id,
      })
      .subscribe(inv => {
        this.abriendoInvestigacion.set(false);
        this.patch({ investigacionId: inv.id });
        this.router.navigate(['/dashboard/qhse/investigaciones', inv.id]);
      });
  }

  protected cerrar(): void {
    if (!this.puedeCerrar()) return;
    this.patch({ estado: 'cerrada', cerradaAt: new Date().toISOString() });
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/eventos']);
  }
}
