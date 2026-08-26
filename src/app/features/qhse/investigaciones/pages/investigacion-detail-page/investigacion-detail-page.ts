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
  INCIDENTE_RESULTADO_LABELS,
  Investigacion,
  ISHIKAWA_CATEGORIAS,
  IshikawaCategoria,
  plazoFinalVencido,
  plazoInicioVencido,
  PorQueEntry,
  sugiereNotificacionLegal,
} from '../../models/investigacion.model';
import { InvestigacionService } from '../../services/investigacion.service';
import { IpercMatrix } from '../../../iperc/models/iperc.model';
import { IpercService } from '../../../iperc/services/iperc.service';

/** HSE-TRIAGE-002 — investigación completa: clasificación, 5 Porqués, Ishikawa, acciones correctivas, notificación legal y retroalimentación a IPERC. */
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

  protected readonly accionTipoOptions: DynadrillSelectOption[] = (['correctiva', 'preventiva'] as AccionTipo[]).map(t => ({
    label: ACCION_TIPO_LABELS[t],
    value: t,
  }));

  protected readonly accionEstadoOptions: DynadrillSelectOption[] = (['pendiente', 'implementada', 'verificada'] as AccionEstado[]).map(e => ({
    label: ACCION_ESTADO_LABELS[e],
    value: e,
  }));

  protected readonly loading = signal(true);
  protected readonly investigacion = signal<Investigacion | null>(null);
  protected readonly matrices = signal<IpercMatrix[]>([]);

  protected readonly ipercOptions = computed<DynadrillSelectOption[]>(() =>
    this.matrices().map(m => ({ label: `${m.code} — ${m.actividad}`, value: m.id })),
  );

  // ── Formularios locales ──
  protected readonly nuevoIntegrante = signal('');
  protected readonly evidencias = signal('');
  protected readonly testimonios = signal('');
  protected readonly nuevaPregunta = signal('');
  protected readonly nuevaRespuesta = signal('');
  protected readonly causasRaiz = signal('');
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

  protected readonly puedeCerrar = computed(() => {
    const i = this.investigacion();
    if (!i) return false;
    return (
      this.porquesCompleto() &&
      i.causasRaiz.trim().length > 0 &&
      i.acciones.length > 0 &&
      accionesPendientes(i.acciones) === 0 &&
      i.leccionesAprendidas.trim().length > 0
    );
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.investigacionService.get(id).subscribe({
      next: inv => {
        this.investigacion.set(inv);
        this.evidencias.set(inv.evidenciasRecopiladas);
        this.testimonios.set(inv.testimoniosResumen);
        this.causasRaiz.set(inv.causasRaiz);
        this.leccionesAprendidas.set(inv.leccionesAprendidas);
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

  // ── Evidencias y testimonios ──

  protected guardarEvidencias(): void {
    this.patch({ evidenciasRecopiladas: this.evidencias(), testimoniosResumen: this.testimonios() });
    this.notify.success('Guardado', 'Evidencias y testimonios actualizados.');
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

  // ── Causas raíz y lecciones aprendidas ──

  protected guardarCausas(): void {
    this.patch({ causasRaiz: this.causasRaiz(), leccionesAprendidas: this.leccionesAprendidas() });
    this.notify.success('Guardado', 'Causas raíz y lecciones aprendidas actualizadas.');
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
