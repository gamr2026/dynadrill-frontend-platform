import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillContextCardComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  ACCION_ESTADO_LABELS,
  ACCION_TIPO_LABELS,
  AccionCorrectiva,
  AccionEstado,
  AccionTipo,
  accionesPendientes,
  cincoPorquesCompleto,
  CONCLUSION_LABELS,
  DEFAULT_CAUSAS,
  DetalleIncidente,
  EntornoTrabajoFactor,
  INCIDENTE_RESULTADO_LABELS,
  Investigacion,
  InvestigacionConclusion,
  ISHIKAWA_CATEGORIAS,
  IshikawaCategoria,
  plazoFinalVencido,
  plazoInicioVencido,
  PorQueEntry,
  sugiereNotificacionLegal,
  Testigo,
  TrabajadorInvolucrado,
} from '../../models/investigacion.model';
import { InvestigacionService } from '../../services/investigacion.service';
import { IpercMatrix } from '../../../iperc/models/iperc.model';
import { IpercService } from '../../../iperc/services/iperc.service';

/**
 * HSE-TRIAGE-002 — investigación completa, alineada al formato físico
 * DYN-SGI-RE-034: datos del trabajador, información del incidente,
 * testigos, entorno de trabajo, 5 Porqués, Ishikawa, causas (inmediatas/
 * básicas/fuente), acciones con jerarquía de control (P/D-F-M-T) y
 * verificación de eficacia, notificación legal, conclusión
 * (incidente/accidente) y retroalimentación a IPERC.
 */
@Component({
  selector: 'app-investigacion-detail-page',
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
    DynadrillCheckboxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './investigacion-detail-page.html',
  styleUrl: './investigacion-detail-page.scss',
})
export class InvestigacionDetailPage {
  private readonly investigacionService = inject(InvestigacionService);
  private readonly ipercService = inject(IpercService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly resultadoLabels = INCIDENTE_RESULTADO_LABELS;
  protected readonly accionTipoLabels = ACCION_TIPO_LABELS;
  protected readonly accionEstadoLabels = ACCION_ESTADO_LABELS;
  protected readonly ishikawaCategorias = ISHIKAWA_CATEGORIAS;
  protected readonly conclusionLabels = CONCLUSION_LABELS;

  protected readonly accionTipoOptions: DynadrillSelectOption[] = (['correctiva', 'preventiva'] as AccionTipo[]).map(t => ({
    label: ACCION_TIPO_LABELS[t],
    value: t,
  }));

  protected readonly accionEstadoOptions: DynadrillSelectOption[] = (['pendiente', 'implementada', 'verificada'] as AccionEstado[]).map(e => ({
    label: ACCION_ESTADO_LABELS[e],
    value: e,
  }));

  protected readonly jornadaOptions: DynadrillSelectOption[] = [
    { label: 'Ordinaria', value: 'ordinaria' },
    { label: 'Extra', value: 'extra' },
    { label: 'Suplementaria', value: 'suplementaria' },
  ];

  protected readonly zonaOptions: DynadrillSelectOption[] = [
    { label: 'Rural', value: 'rural' },
    { label: 'Urbana', value: 'urbana' },
  ];

  protected readonly conclusionOptions: DynadrillSelectOption[] = (['incidente', 'accidente'] as InvestigacionConclusion[]).map(c => ({
    label: CONCLUSION_LABELS[c],
    value: c,
  }));

  protected readonly loading = signal(true);
  protected readonly investigacion = signal<Investigacion | null>(null);
  protected readonly matrices = signal<IpercMatrix[]>([]);

  protected readonly ipercOptions = computed<DynadrillSelectOption[]>(() =>
    this.matrices().map(m => ({ label: `${m.code} — ${m.actividad}`, value: m.id })),
  );

  // ── Formularios locales ──
  protected readonly nuevoIntegrante = signal('');
  protected readonly mostrarTrabajador = signal(false);
  protected readonly trabajador = signal<TrabajadorInvolucrado>({
    apellidosNombres: '',
    cedula: '',
    direccion: '',
    telefono: '',
    cargo: '',
    tipoVinculacion: '',
    oficioDesempenaba: '',
    jornadaHabitual: '',
  });
  protected readonly detalle = signal<DetalleIncidente>({});
  protected readonly evidencias = signal('');
  protected readonly testimonios = signal('');
  protected readonly nuevoTestigo = signal<Omit<Testigo, 'id'>>({ nombresApellidos: '', cedula: '', version: '' });
  protected readonly nuevoFactor = signal<Omit<EntornoTrabajoFactor, 'id'>>({ tipo: '', fuente: '', existeControl: '', contribuyoAlSuceso: '' });
  protected readonly nuevaPregunta = signal('');
  protected readonly nuevaRespuesta = signal('');
  protected readonly causas = signal(DEFAULT_CAUSAS);
  protected readonly leccionesAprendidas = signal('');
  protected readonly nuevaAccionDescripcion = signal('');
  protected readonly nuevaAccionTipo = signal<AccionTipo>('correctiva');
  protected readonly nuevaAccionResponsable = signal('');
  protected readonly nuevaAccionPlazo = signal('');

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const i = this.investigacion();
    if (!i) return [];
    return [
      { label: 'Investigación', value: i.code },
      { label: 'Clasificación', value: INCIDENTE_RESULTADO_LABELS[i.resultado] },
      { label: 'Ubicación', value: i.ubicacion || '—' },
      { label: 'Fecha del incidente', value: new Date(i.fechaIncidente).toLocaleDateString('es-EC') },
      { label: 'Estado', value: i.estado === 'abierta' ? 'Abierta' : 'Cerrada' },
    ];
  });

  protected readonly inicioVencido = computed(() => {
    const i = this.investigacion();
    return !!i && plazoInicioVencido(i);
  });

  protected readonly finalVencido = computed(() => {
    const i = this.investigacion();
    return !!i && plazoFinalVencido(i);
  });

  protected readonly porquesCompleto = computed(() => {
    const i = this.investigacion();
    return !!i && cincoPorquesCompleto(i.cincoPorques);
  });

  private causasCompleto(): boolean {
    const c = this.investigacion()?.causas;
    if (!c) return false;
    return !!(c.actosInseguros.trim() || c.condicionesInseguras.trim() || c.factoresPersonales.trim() || c.factoresTrabajo.trim() || c.causasFuenteGestion.trim());
  }

  protected readonly puedeCerrar = computed(() => {
    const i = this.investigacion();
    if (!i) return false;
    return (
      this.porquesCompleto() &&
      this.causasCompleto() &&
      i.acciones.length > 0 &&
      accionesPendientes(i.acciones) === 0 &&
      i.leccionesAprendidas.trim().length > 0 &&
      i.conclusion != null
    );
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.investigacionService.get(id).subscribe({
      next: inv => {
        this.investigacion.set(inv);
        this.evidencias.set(inv.evidenciasRecopiladas);
        this.testimonios.set(inv.testimoniosResumen);
        this.causas.set(inv.causas);
        this.leccionesAprendidas.set(inv.leccionesAprendidas);
        this.detalle.set(inv.detalle);
        if (inv.trabajador) {
          this.trabajador.set(inv.trabajador);
          this.mostrarTrabajador.set(true);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.ipercService.list().subscribe(matrices => this.matrices.set(matrices));
  }

  private patch(changes: Partial<Investigacion>): void {
    const current = this.investigacion();
    if (!current) return;
    this.investigacion.set({ ...current, ...changes });
    this.investigacionService.update(current.id, changes).subscribe();
  }

  // ── Escena y equipo ──

  protected asegurarEscena(): void {
    this.patch({ escenaAseguradaAt: new Date().toISOString() });
  }

  protected agregarIntegrante(): void {
    const i = this.investigacion();
    const nombre = this.nuevoIntegrante().trim();
    if (!i || !nombre) return;
    this.patch({ equipoInvestigador: [...i.equipoInvestigador, nombre] });
    this.nuevoIntegrante.set('');
  }

  // ── Datos del trabajador involucrado ──

  protected activarTrabajador(): void {
    this.mostrarTrabajador.set(true);
  }

  protected guardarTrabajador(): void {
    this.patch({ trabajador: this.trabajador() });
    this.notify.success('Guardado', 'Datos del trabajador involucrado actualizados.');
  }

  protected setTrabajadorField<K extends keyof TrabajadorInvolucrado>(field: K, value: TrabajadorInvolucrado[K]): void {
    this.trabajador.update(t => ({ ...t, [field]: value }));
  }

  /** Los templates de Angular no resuelven `String(...)` como global — de acá salen los inputs numéricos opcionales. */
  protected numToStr(n: number | undefined): string {
    return n != null ? String(n) : '';
  }

  // ── Información sobre el incidente ──

  protected setDetalleField<K extends keyof DetalleIncidente>(field: K, value: DetalleIncidente[K]): void {
    this.detalle.update(d => ({ ...d, [field]: value }));
  }

  protected guardarDetalle(): void {
    this.patch({ detalle: this.detalle() });
    this.notify.success('Guardado', 'Información del incidente actualizada.');
  }

  // ── Evidencias, testimonios y testigos ──

  protected guardarEvidencias(): void {
    this.patch({ evidenciasRecopiladas: this.evidencias(), testimoniosResumen: this.testimonios() });
    this.notify.success('Guardado', 'Evidencias y testimonios actualizados.');
  }

  protected readonly puedeAgregarTestigo = computed(() => {
    const t = this.nuevoTestigo();
    return t.nombresApellidos.trim().length > 0 && (this.investigacion()?.testigos.length ?? 0) < 3;
  });

  protected agregarTestigo(): void {
    const i = this.investigacion();
    if (!i || !this.puedeAgregarTestigo()) return;
    const testigo: Testigo = { id: Date.now(), ...this.nuevoTestigo() };
    this.patch({ testigos: [...i.testigos, testigo] });
    this.nuevoTestigo.set({ nombresApellidos: '', cedula: '', version: '' });
  }

  // ── Entorno de trabajo ──

  protected readonly puedeAgregarFactor = computed(() => this.nuevoFactor().tipo.trim().length > 0);

  protected agregarFactor(): void {
    const i = this.investigacion();
    if (!i || !this.puedeAgregarFactor()) return;
    const factor: EntornoTrabajoFactor = { id: Date.now(), ...this.nuevoFactor() };
    this.patch({ entornoTrabajo: [...i.entornoTrabajo, factor] });
    this.nuevoFactor.set({ tipo: '', fuente: '', existeControl: '', contribuyoAlSuceso: '' });
  }

  // ── 5 Porqués ──

  protected agregarPorque(): void {
    const i = this.investigacion();
    const pregunta = this.nuevaPregunta().trim();
    const respuesta = this.nuevaRespuesta().trim();
    if (!i || !pregunta || !respuesta) return;
    const entry: PorQueEntry = { pregunta, respuesta };
    this.patch({ cincoPorques: [...i.cincoPorques, entry] });
    this.nuevaPregunta.set('');
    this.nuevaRespuesta.set('');
  }

  // ── Ishikawa ──

  protected actualizarIshikawa(categoria: IshikawaCategoria, valor: string): void {
    const i = this.investigacion();
    if (!i) return;
    this.patch({ ishikawa: { ...i.ishikawa, [categoria]: valor } });
  }

  // ── Causas (inmediatas/básicas/fuente) y lecciones aprendidas ──

  protected guardarCausas(): void {
    this.patch({ causas: this.causas(), leccionesAprendidas: this.leccionesAprendidas() });
    this.notify.success('Guardado', 'Causas y lecciones aprendidas actualizadas.');
  }

  // ── Acciones correctivas/preventivas ──

  protected readonly puedeAgregarAccion = computed(
    () => this.nuevaAccionDescripcion().trim().length > 0 && this.nuevaAccionResponsable().trim().length > 0 && this.nuevaAccionPlazo().trim().length > 0,
  );

  protected agregarAccion(): void {
    const i = this.investigacion();
    if (!i || !this.puedeAgregarAccion()) return;
    const nueva: AccionCorrectiva = {
      id: Date.now(),
      descripcion: this.nuevaAccionDescripcion().trim(),
      tipo: this.nuevaAccionTipo(),
      responsable: this.nuevaAccionResponsable().trim(),
      plazo: this.nuevaAccionPlazo(),
      estado: 'pendiente',
      controlAplicadoA: { planeacionDiseno: false, fuente: false, medio: false, trabajador: false },
    };
    this.patch({ acciones: [...i.acciones, nueva] });
    this.nuevaAccionDescripcion.set('');
    this.nuevaAccionResponsable.set('');
    this.nuevaAccionPlazo.set('');
  }

  protected actualizarEstadoAccion(accion: AccionCorrectiva, estado: AccionEstado): void {
    const i = this.investigacion();
    if (!i) return;
    const acciones = i.acciones.map(a => (a.id === accion.id ? { ...a, estado } : a));
    this.patch({ acciones });
  }

  protected toggleControlAplicadoA(accion: AccionCorrectiva, campo: keyof AccionCorrectiva['controlAplicadoA']): void {
    const i = this.investigacion();
    if (!i) return;
    const acciones = i.acciones.map(a =>
      a.id === accion.id ? { ...a, controlAplicadoA: { ...a.controlAplicadoA, [campo]: !a.controlAplicadoA[campo] } } : a,
    );
    this.patch({ acciones });
  }

  protected verificarAccion(accion: AccionCorrectiva, fueEficaz: boolean): void {
    const i = this.investigacion();
    if (!i) return;
    const acciones = i.acciones.map(a =>
      a.id === accion.id
        ? { ...a, fueEficaz, fechaVerificacion: new Date().toISOString(), verificadoPor: this.auth.currentUser()?.name ?? '' }
        : a,
    );
    this.patch({ acciones });
  }

  // ── Notificación legal ──

  protected readonly sugiereLegal = computed(() => {
    const i = this.investigacion();
    return !!i && sugiereNotificacionLegal(i.resultado);
  });

  protected marcarNotificadoMinisterio(): void {
    const i = this.investigacion();
    if (!i) return;
    this.patch({ notificacionLegal: { ...i.notificacionLegal, requerida: true, ministerioTrabajoNotificadoAt: new Date().toISOString() } });
  }

  protected marcarNotificadoIess(): void {
    const i = this.investigacion();
    if (!i) return;
    this.patch({ notificacionLegal: { ...i.notificacionLegal, requerida: true, iessNotificadoAt: new Date().toISOString() } });
  }

  // ── Retroalimentación a IPERC ──

  protected seleccionarIperc(ipercActualizadoId: number): void {
    this.patch({ ipercActualizadoId });
  }

  // ── Conclusión ──

  protected seleccionarConclusion(conclusion: InvestigacionConclusion): void {
    this.patch({ conclusion });
  }

  // ── Cierre ──

  protected cerrar(): void {
    const i = this.investigacion();
    if (!i || !this.puedeCerrar()) return;
    this.patch({
      estado: 'cerrada',
      cerradaAt: new Date().toISOString(),
      informeAprobadoPorNombre: this.auth.currentUser()?.name ?? '',
      informeAprobadoAt: new Date().toISOString(),
    });
    this.notify.success('Investigación cerrada', 'Se registró el cierre y, si aplica, la lección aprendida quedó vinculada a la matriz IPERC.');
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/eventos']);
  }
}
