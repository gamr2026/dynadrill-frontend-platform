import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DynadrillApprovalActionsComponent,
  DynadrillAvatarComponent,
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCardComponent,
  DynadrillContextCardComponent,
  DynadrillDrawerService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillStepperComponent,
  DynadrillTagComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
  type DynadrillApprovalDecision,
  type DynadrillContextCardItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  calcularNR,
  GTC_EVALUACION_VACIA,
  interpretarNR,
  IPERC_STATUS_LABELS,
  IpercHazard,
  IpercMatrix,
  IpercStatus,
  IpercTask,
} from '../../models/iperc.model';
import { IpercService } from '../../services/iperc.service';
import { PTW_FASE_LABELS, ptwCerrado } from '../../../ptw/models/ptw.model';
import { PtwService } from '../../../ptw/services/ptw.service';
import { TIPO_EQUIPO_LABELS } from '../../../inspecciones/models/inspeccion-equipo.model';
import { InspeccionEquipoService } from '../../../inspecciones/services/inspeccion-equipo.service';
import { IpercHazardPanel, IpercHazardPanelData } from '../../components/iperc-hazard-panel';
import { downloadQhseReport, qhseBadge, type QhseReportSection } from '../../../shared/utils/qhse-report.util';

interface HazardDraft {
  peligro: string;
  fuenteRiesgo: string;
  controlesExistentes: string;
}

const EMPTY_HAZARD_DRAFT: HazardDraft = { peligro: '', fuenteRiesgo: '', controlesExistentes: '' };

/** Mismas 4 fases documentadas en HSE-PLAN-001. */
const FASE_STEPS = ['Preparación', 'Identificación/Evaluación', 'Controles/Reevaluación', 'Documentación y aprobación'];
const STATUS_STEP_INDEX: Record<IpercStatus, number> = {
  borrador: 0,
  en_evaluacion: 1,
  en_revision: 2,
  aprobada: 3,
  rechazada: 1,
};

@Component({
  selector: 'app-iperc-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillStepperComponent,
    DynadrillContextCardComponent,
    DynadrillAvatarComponent,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillInputComponent,
    DynadrillTextareaComponent,
    DynadrillUploadZoneComponent,
    DynadrillApprovalActionsComponent,
    DynadrillBannerComponent,
  ],
  templateUrl: './iperc-detail-page.html',
  styleUrl: './iperc-detail-page.scss',
})
export class IpercDetailPage {
  private readonly ipercService = inject(IpercService);
  private readonly ptwService = inject(PtwService);
  private readonly inspeccionService = inject(InspeccionEquipoService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly drawer = inject(DynadrillDrawerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly matrixId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly matrix = signal<IpercMatrix | null>(null);

  protected readonly faseSteps = FASE_STEPS;
  protected readonly faseIndex = computed(() => STATUS_STEP_INDEX[this.matrix()?.status ?? 'borrador']);

  protected readonly statusLabel = computed(() => {
    const m = this.matrix();
    return m ? IPERC_STATUS_LABELS[m.status] : '';
  });

  protected readonly statusTone = computed<DynadrillTagVariant>(() => {
    const status = this.matrix()?.status;
    if (status === 'aprobada') return 'success';
    if (status === 'rechazada') return 'error';
    if (status === 'en_revision') return 'warning';
    return 'info';
  });

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const m = this.matrix();
    if (!m) return [];
    return [
      { label: 'Código', value: m.code },
      { label: 'ATS base', value: m.atsAdjunto ?? 'Sin adjuntar' },
      { label: 'Procedimiento operativo', value: m.procedimientoAdjunto ?? 'Sin adjuntar' },
      { label: 'Aprobada por', value: m.approvedByName ? `${m.approvedByName}` : '—' },
      { label: 'Tareas desglosadas', value: String(m.tasks.length) },
    ];
  });

  /**
   * Fase 2/3 de HSE-PLAN-001: mientras la matriz está "en_evaluacion" se
   * edita el riesgo inicial y el residual; una vez pasa a "en_revision"
   * queda congelada hasta que se apruebe o se rechace (y vuelva a
   * evaluación).
   */
  protected readonly riskEditable = computed(() => this.matrix()?.status === 'en_evaluacion');

  /**
   * Fase 1 de HSE-PLAN-001 ("desglosar actividad en tareas") — se puede
   * seguir ampliando el desglose tanto en borrador como ya iniciada la
   * evaluación. Identificar peligros (nombre/fuente/controles existentes)
   * comparte el mismo gate: no tiene sentido obligar a "Iniciar
   * evaluación" solo para poder nombrar el peligro de una tarea recién
   * creada — evaluar el riesgo (probabilidad x severidad, dentro del
   * panel de detalle) sí sigue esperando a "en_evaluacion" vía
   * riskEditable().
   */
  protected readonly canAddTask = computed(() => {
    const status = this.matrix()?.status;
    return status === 'borrador' || status === 'en_evaluacion';
  });
  protected readonly canIdentifyHazards = this.canAddTask;

  protected readonly addingTask = signal(false);
  protected readonly nuevaTareaDescripcion = signal('');

  protected readonly addingHazardForTask = signal<number | null>(null);
  protected readonly hazardDraft = signal<HazardDraft>(EMPTY_HAZARD_DRAFT);

  protected readonly canStartEvaluation = computed(() => this.matrix()?.status === 'borrador');

  /**
   * Fase 4 de HSE-PLAN-001: "Elaborar procedimiento y ATS base" está antes
   * de "¿Aprobado?" en el diagrama — no se puede enviar a revisión sin
   * tener ambos documentos adjuntos, para que quien aprueba (Coordinador/
   * Gerente HSE) ya los tenga disponibles al decidir.
   */
  protected readonly isEnEvaluacion = computed(() => this.matrix()?.status === 'en_evaluacion');
  protected readonly documentacionCompleta = computed(() => {
    const m = this.matrix();
    return !!m?.atsAdjunto && !!m?.procedimientoAdjunto;
  });

  /** No se puede enviar a revisión sin peligros identificados, y ninguno puede quedar sin su riesgo residual evaluado — si no, el Coordinador/Gerente HSE aprobaría a ciegas. */
  protected readonly peligrosCompletos = computed(() => {
    const hazards = this.matrix()?.tasks.flatMap(t => t.hazards) ?? [];
    return hazards.length > 0 && hazards.every(h => calcularNR(h.riesgoResidual.nd, h.riesgoResidual.ne, h.riesgoResidual.nc) != null);
  });

  protected readonly canSendToReview = this.isEnEvaluacion;
  protected readonly canReviewNow = computed(() => this.matrix()?.status === 'en_revision');
  protected readonly canResumeEvaluation = computed(() => this.matrix()?.status === 'rechazada');

  protected readonly canApprove = computed(() => {
    const roleName = this.auth.currentUser()?.roleName;
    return roleName === 'Coordinador HSE' || roleName === 'Gerente HSE';
  });

  /** HSE-MASTER-001: sin IPERC aprobado el sistema bloquea la apertura del PTW — por eso solo aparece con status "aprobada". */
  protected readonly canOpenPtw = computed(() => this.matrix()?.status === 'aprobada');

  protected readonly openingPtw = signal(false);
  protected readonly openPtwError = signal('');

  protected readonly motivoRechazo = signal('');
  protected readonly descargandoSeguimiento = signal(false);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.ipercService.get(this.matrixId).subscribe({
      next: matrix => {
        this.matrix.set(matrix);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * Nivel de riesgo residual más alto entre los peligros de una tarea —
   * para el badge de la card, de un vistazo, sin tener que abrir cada
   * peligro. Si falta evaluar el residual de AL MENOS UNO, no se calcula
   * el máximo solo con los que sí están evaluados: eso podía mostrar
   * "Riesgo bajo" aunque el peligro sin evaluar resultara ser el más
   * peligroso de la tarea — un supervisor que no abre el detalle se
   * llevaría una falsa sensación de seguridad.
   */
  protected taskRiskTone(task: IpercTask): { label: string; tone: DynadrillTagVariant } {
    if (task.hazards.length === 0) return { label: 'Sin peligros', tone: 'neutral' };
    const nrs = task.hazards.map(h => calcularNR(h.riesgoResidual.nd, h.riesgoResidual.ne, h.riesgoResidual.nc));
    if (nrs.some(nr => nr == null)) {
      return { label: 'Evaluación incompleta', tone: 'warning' };
    }
    const { nivel, label } = interpretarNR(Math.max(...(nrs as number[])));
    // I/II = No aceptable (crítico); III = Mejorable (advertencia); IV = Aceptable.
    const tone: DynadrillTagVariant = nivel === 'IV' ? 'success' : nivel === 'III' ? 'warning' : 'error';
    return { label: `Riesgo ${label}`, tone };
  }

  /**
   * El riesgo inicial (antes de controles) y el residual (después) se
   * muestran juntos en la fila del peligro, sin abrir el panel de
   * detalle — antes solo se veía el residual: un peligro que arrancó en
   * Alto y quedó en Bajo tras los controles se veía igual de "tranquilo"
   * que uno que siempre fue Bajo, ocultando que hubo un riesgo severo de
   * por medio. Quien aprueba (Coordinador/Gerente HSE) necesita ver esto
   * sin depender de abrir cada peligro uno por uno.
   */
  protected hazardRiskTagInicial(hazard: IpercHazard): { label: string; tone: DynadrillTagVariant } {
    const nr = calcularNR(hazard.riesgoInicial.nd, hazard.riesgoInicial.ne, hazard.riesgoInicial.nc);
    if (nr == null) return { label: 'Inicial: sin evaluar', tone: 'neutral' };
    const { nivel, label } = interpretarNR(nr);
    const tone: DynadrillTagVariant = nivel === 'IV' ? 'success' : nivel === 'III' ? 'warning' : 'error';
    return { label: `Inicial: ${label}`, tone };
  }

  protected hazardRiskTag(hazard: IpercHazard): { label: string; tone: DynadrillTagVariant } {
    const nr = calcularNR(hazard.riesgoResidual.nd, hazard.riesgoResidual.ne, hazard.riesgoResidual.nc);
    if (nr == null) return { label: 'Residual: sin evaluar', tone: 'neutral' };
    const { nivel, label } = interpretarNR(nr);
    const tone: DynadrillTagVariant = nivel === 'IV' ? 'success' : nivel === 'III' ? 'warning' : 'error';
    return { label: `Residual: ${label}`, tone };
  }

  protected verPeligro(task: IpercTask, hazard: IpercHazard): void {
    const matrix = this.matrix();
    if (!matrix) return;
    const ref = this.drawer.open<IpercHazardPanel, IpercHazardPanelData>({
      title: 'Detalle del peligro',
      content: IpercHazardPanel,
      data: { matrix, taskId: task.id, hazardId: hazard.id, editable: this.riskEditable() },
      size: 'medium',
    });
    ref.afterClose.subscribe(() => this.reload());
  }

  protected startEvaluation(): void {
    this.transitionTo('en_evaluacion');
  }

  protected sendToReview(): void {
    if (!this.documentacionCompleta() || !this.peligrosCompletos()) return;
    this.transitionTo('en_revision');
  }

  protected onDecision(decision: DynadrillApprovalDecision): void {
    const current = this.matrix();
    if (!current || !decision) return;

    if (decision === 'approved') {
      const approvedByName = this.auth.currentUser()?.name ?? '';
      this.ipercService.approve(current.id, approvedByName).subscribe(updated => this.matrix.set(updated));
      return;
    }

    /**
     * Rechazada: antes saltaba directo a "en_evaluacion" sin dejar rastro,
     * así que quien la levantó no tenía forma de notar que hubo un
     * rechazo (mismo botón "Enviar a revisión" de siempre, sin motivo ni
     * quién rechazó). Ahora queda en "rechazada" — visible con el motivo
     * — hasta que retoma la evaluación explícitamente con
     * resumeEvaluation().
     */
    const rejectedByName = this.auth.currentUser()?.name ?? '';
    this.ipercService
      .update(current.id, {
        status: 'rechazada',
        rejectedByName,
        rejectedAt: new Date().toISOString(),
        rejectedReason: this.motivoRechazo().trim() || undefined,
      })
      .subscribe(updated => this.matrix.set(updated));
    this.motivoRechazo.set('');
  }

  /** El equipo evaluador retoma la matriz rechazada de vuelta a "en_evaluacion" para corregirla. */
  protected resumeEvaluation(): void {
    this.transitionTo('en_evaluacion');
  }

  /** HSE-PLAN-001 → HSE-SITIO-001: abre el PTW/Recibimiento de Sitio a partir de esta matriz ya aprobada. */
  protected abrirRecibimientoSitio(): void {
    const current = this.matrix();
    if (!current || this.openingPtw()) return;
    this.openingPtw.set(true);
    this.openPtwError.set('');
    this.ptwService.createFromIperc(current.id).subscribe({
      next: ptw => {
        this.openingPtw.set(false);
        this.router.navigate(['/dashboard/qhse/ptw', ptw.id]);
      },
      error: () => {
        this.openingPtw.set(false);
        this.openPtwError.set('No se pudo abrir el PTW. Verifica que la matriz siga aprobada e intenta de nuevo.');
      },
    });
  }

  /** HSE-TRIAGE-002 cerró una investigación con lección aprendida para esta matriz: se marca revisada tras actualizar controles. */
  protected marcarLeccionRevisada(): void {
    const current = this.matrix();
    if (!current) return;
    this.ipercService
      .update(current.id, { leccionAprendidaPendiente: false })
      .subscribe(updated => this.matrix.set(updated));
  }

  /**
   * Reporte descargable con el seguimiento completo de esta matriz: sus
   * datos, los peligros evaluados, los PTW/Recibimientos de Sitio
   * abiertos a partir de ella y las inspecciones de equipo registradas
   * durante el período en que esos PTW estuvieron activos. No existe un
   * vínculo directo en el modelo entre una inspección y un PTW/matriz
   * específicos (InspeccionEquipo no guarda esa referencia) — la
   * correlación es por fecha, dentro de la ventana de los PTW de esta
   * matriz, y así queda explícito en el propio reporte para no sugerir
   * una trazabilidad más fuerte de la que realmente hay.
   */
  protected descargarSeguimiento(): void {
    const m = this.matrix();
    if (!m || this.descargandoSeguimiento()) return;
    this.descargandoSeguimiento.set(true);

    forkJoin({ ptws: this.ptwService.list(), inspecciones: this.inspeccionService.list() }).subscribe({
      next: ({ ptws, inspecciones }) => {
        const ptwsDeMatriz = ptws.filter(p => p.ipercMatrixId === m.id);

        const desde = ptwsDeMatriz.length > 0 ? Math.min(...ptwsDeMatriz.map(p => new Date(p.createdAt).getTime())) : null;
        const hasta = ptwsDeMatriz.length > 0 ? Math.max(...ptwsDeMatriz.map(p => new Date(p.updatedAt).getTime())) : null;
        const inspeccionesEnVentana =
          desde != null && hasta != null
            ? inspecciones.filter(i => {
                const t = new Date(i.fecha).getTime();
                return t >= desde && t <= hasta;
              })
            : [];

        const matrizSection: QhseReportSection = {
          title: 'Matriz IPERC',
          bodyHtml: `
            <table>
              <tr><th>Código</th><td>${m.code}</td></tr>
              <tr><th>Actividad</th><td>${m.actividad}</td></tr>
              <tr><th>Ubicación</th><td>${m.ubicacion}</td></tr>
              <tr><th>Estado</th><td>${IPERC_STATUS_LABELS[m.status]}</td></tr>
              <tr><th>Equipo evaluador</th><td>${m.equipoEvaluador.join(', ') || '—'}</td></tr>
              <tr><th>ATS base</th><td>${m.atsAdjunto ?? 'Sin adjuntar'}</td></tr>
              <tr><th>Procedimiento operativo</th><td>${m.procedimientoAdjunto ?? 'Sin adjuntar'}</td></tr>
              <tr><th>Aprobada por</th><td>${m.approvedByName ? `${m.approvedByName} — ${m.approvedAt}` : '—'}</td></tr>
              <tr><th>Último rechazo</th><td>${m.rejectedByName ? `${m.rejectedByName} — ${m.rejectedAt} — ${m.rejectedReason ?? 'sin motivo registrado'}` : '—'}</td></tr>
            </table>`,
        };

        const peligrosRows = m.tasks
          .flatMap(t => t.hazards.map(h => ({ tarea: t.descripcion, hazard: h })))
          .map(({ tarea, hazard: h }) => {
            const nrInicial = calcularNR(h.riesgoInicial.nd, h.riesgoInicial.ne, h.riesgoInicial.nc);
            const nrResidual = calcularNR(h.riesgoResidual.nd, h.riesgoResidual.ne, h.riesgoResidual.nc);
            return `
              <tr>
                <td>${tarea}</td>
                <td>${h.peligro}</td>
                <td>${h.fuenteRiesgo}</td>
                <td>${nrInicial != null ? `NR ${nrInicial} — ${interpretarNR(nrInicial).label}` : 'Sin evaluar'}</td>
                <td>${h.controles.map(c => c.description).join('; ') || '—'}</td>
                <td>${nrResidual != null ? `NR ${nrResidual} — ${interpretarNR(nrResidual).label}` : 'Sin evaluar'}</td>
              </tr>`;
          })
          .join('');
        const peligrosSection: QhseReportSection = {
          title: 'Peligros identificados y evaluación de riesgo',
          bodyHtml:
            m.tasks.length === 0
              ? '<p class="qr-empty">Sin tareas desglosadas.</p>'
              : `<table><tr><th>Tarea</th><th>Peligro</th><th>Fuente</th><th>Riesgo inicial</th><th>Controles</th><th>Riesgo residual</th></tr>${peligrosRows}</table>`,
        };

        const ptwRows = ptwsDeMatriz
          .map(
            p => `
              <tr>
                <td>${p.code}</td>
                <td>${p.ordenTrabajo}</td>
                <td>${PTW_FASE_LABELS[p.fase]}</td>
                <td>${ptwCerrado(p) ? qhseBadge('Cerrado', 'ok') : qhseBadge('Abierto', 'warn')}</td>
                <td>${new Date(p.createdAt).toLocaleString('es-EC')}</td>
                <td>${new Date(p.updatedAt).toLocaleString('es-EC')}</td>
              </tr>`,
          )
          .join('');
        const ptwSection: QhseReportSection = {
          title: 'Recibimientos de Sitio (PTW) abiertos desde esta matriz',
          bodyHtml:
            ptwsDeMatriz.length === 0
              ? '<p class="qr-empty">Todavía no se ha abierto ningún PTW a partir de esta matriz.</p>'
              : `<table><tr><th>Código</th><th>Orden de trabajo</th><th>Fase</th><th>Estado</th><th>Abierto</th><th>Última actualización</th></tr>${ptwRows}</table>`,
        };

        const inspeccionRows = inspeccionesEnVentana
          .map(
            i => `
              <tr>
                <td>${i.code}</td>
                <td>${i.equipoCodigo}</td>
                <td>${TIPO_EQUIPO_LABELS[i.tipo]}</td>
                <td>${new Date(i.fecha).toLocaleString('es-EC')}</td>
                <td>${i.resultado === 'aprobado' ? qhseBadge('Aprobado', 'ok') : qhseBadge('Rechazado', 'error')}</td>
              </tr>`,
          )
          .join('');
        const inspeccionSection: QhseReportSection = {
          title: 'Inspecciones de equipo durante el período de los PTW de esta matriz',
          bodyHtml:
            (ptwsDeMatriz.length === 0
              ? '<p class="qr-empty">Sin PTW asociados — no hay ventana de tiempo que correlacionar.</p>'
              : inspeccionesEnVentana.length === 0
                ? '<p class="qr-empty">No se registraron inspecciones de equipo en ese período.</p>'
                : `<table><tr><th>Código</th><th>Equipo</th><th>Tipo</th><th>Fecha</th><th>Resultado</th></tr>${inspeccionRows}</table>`) +
            '<p class="qr-meta">Nota: el sistema no guarda un vínculo directo entre una inspección de equipo y un PTW o matriz IPERC específicos — esta lista es por coincidencia de fecha dentro del período de apertura de los PTW listados arriba, no una trazabilidad exacta.</p>',
        };

        downloadQhseReport(
          `seguimiento-${m.code}.html`,
          `Seguimiento — ${m.code}`,
          `${m.actividad} — ${m.ubicacion}`,
          [matrizSection, peligrosSection, ptwSection, inspeccionSection],
        );
        this.descargandoSeguimiento.set(false);
      },
      error: () => {
        this.descargandoSeguimiento.set(false);
        this.notify.error('Error', 'No se pudo generar el seguimiento.');
      },
    });
  }

  /** Fase 4: "Elaborar procedimiento y ATS base" — ambos se adjuntan acá, antes de enviar a revisión (ver documentacionCompleta()). */
  protected onAtsUpload(file: { name?: string }): void {
    const current = this.matrix();
    if (!current) return;
    this.ipercService
      .update(current.id, { atsAdjunto: file.name ?? 'ats.pdf', atsAdjuntadoAt: new Date().toISOString() })
      .subscribe(updated => this.matrix.set(updated));
  }

  protected onProcedimientoUpload(file: { name?: string }): void {
    const current = this.matrix();
    if (!current) return;
    this.ipercService
      .update(current.id, { procedimientoAdjunto: file.name ?? 'procedimiento.pdf', procedimientoAdjuntadoAt: new Date().toISOString() })
      .subscribe(updated => this.matrix.set(updated));
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/iperc']);
  }

  protected toggleAddTask(): void {
    this.addingTask.update(v => !v);
    this.nuevaTareaDescripcion.set('');
  }

  /** Fase 1: "Desglosar actividades en tareas secuenciales". */
  protected agregarTarea(): void {
    const current = this.matrix();
    const descripcion = this.nuevaTareaDescripcion().trim();
    if (!current || !descripcion) return;

    const nuevaTarea: IpercTask = { id: this.nextLocalId(current), descripcion, hazards: [] };
    const tasks = [...current.tasks, nuevaTarea];
    this.persistTasks(current, tasks);
    this.addingTask.set(false);
    this.nuevaTareaDescripcion.set('');
  }

  protected toggleAddHazard(taskId: number): void {
    this.addingHazardForTask.update(current => (current === taskId ? null : taskId));
    this.hazardDraft.set(EMPTY_HAZARD_DRAFT);
  }

  protected setHazardDraftField(field: keyof HazardDraft, value: string): void {
    this.hazardDraft.update(draft => ({ ...draft, [field]: value }));
  }

  /** Fase 2: "Identificar peligros por tarea" (el riesgo y los controles se completan después, dentro del panel de detalle). */
  protected agregarPeligro(taskId: number): void {
    const current = this.matrix();
    const draft = this.hazardDraft();
    if (!current || !draft.peligro.trim() || !draft.fuenteRiesgo.trim()) return;

    const nuevoPeligro: IpercHazard = {
      id: this.nextLocalId(current),
      peligro: draft.peligro.trim(),
      fuenteRiesgo: draft.fuenteRiesgo.trim(),
      controlesExistentes: draft.controlesExistentes.trim(),
      riesgoInicial: { ...GTC_EVALUACION_VACIA },
      controles: [],
      riesgoResidual: { ...GTC_EVALUACION_VACIA },
    };
    const tasks = current.tasks.map(t => (t.id === taskId ? { ...t, hazards: [...t.hazards, nuevoPeligro] } : t));
    this.persistTasks(current, tasks);
    this.addingHazardForTask.set(null);
    this.hazardDraft.set(EMPTY_HAZARD_DRAFT);
  }

  /** IDs únicos dentro de la matriz — no hay backend real generándolos, así que se calculan a partir del máximo existente entre tareas, peligros y controles. */
  private nextLocalId(matrix: IpercMatrix): number {
    let max = 0;
    for (const task of matrix.tasks) {
      max = Math.max(max, task.id);
      for (const hazard of task.hazards) {
        max = Math.max(max, hazard.id);
        for (const control of hazard.controles) max = Math.max(max, control.id);
      }
    }
    return max + 1;
  }

  private persistTasks(current: IpercMatrix, tasks: IpercTask[]): void {
    const updated: IpercMatrix = { ...current, tasks };
    this.matrix.set(updated);
    this.ipercService.update(current.id, { tasks }).subscribe();
  }

  private transitionTo(status: IpercMatrix['status']): void {
    const current = this.matrix();
    if (!current) return;
    this.ipercService.update(current.id, { status }).subscribe(updated => this.matrix.set(updated));
  }
}
