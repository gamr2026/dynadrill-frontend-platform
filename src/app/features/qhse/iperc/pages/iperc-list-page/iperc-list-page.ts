import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillKpiRowComponent,
  DynadrillPhaseTrackComponent,
  DynadrillScreenHeaderComponent,
  type DynadrillKpiRowItem,
} from '@digitec-it-projects/dynadrill-ui';
import { calcularNR, interpretarNR, IPERC_STATUS_LABELS, IpercMatrix, IpercStatus, NivelRiesgo } from '../../models/iperc.model';
import { IpercService } from '../../services/iperc.service';
import { IpercMatrixDialog } from '../../components/iperc-matrix-dialog';
import { IpercMatrixPdfDialog, IpercMatrixPdfDialogData } from '../../components/iperc-matrix-pdf-dialog';
import { AuthService } from '../../../../../core/services/auth.service';
import { AppNotificationItem, NotificationsService } from '../../../../../core/services/notifications.service';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';

const STATUS_BADGES: Record<IpercStatus, { text: string; tone: BadgeTone }> = {
  borrador: { text: 'Borrador', tone: 'neutral' },
  en_evaluacion: { text: 'En evaluación', tone: 'info' },
  en_revision: { text: 'En revisión', tone: 'warning' },
  aprobada: { text: 'Aprobada', tone: 'success' },
  rechazada: { text: 'Rechazada', tone: 'error' },
};

/** I/II = No aceptable (crítico); III = Mejorable (advertencia); IV = Aceptable. */
const RISK_TONE: Record<NivelRiesgo, BadgeTone> = {
  I: 'error',
  II: 'error',
  III: 'warning',
  IV: 'success',
};

const STATUS_FILTERS = Object.entries(IPERC_STATUS_LABELS).map(([value, text]) => ({ text, value }));

/** HSE-PLAN-001: Preparación → Identificación/Evaluación → Controles/Reevaluación → Documentación y aprobación. */
const FASE_STEPS = 4;
const FASE_LABELS = ['Preparación', 'Identificación/Evaluación', 'Controles/Reevaluación', 'Documentación y aprobación'];
const STATUS_INDEX: Record<IpercStatus, number> = {
  borrador: 0,
  en_evaluacion: 1,
  en_revision: 2,
  aprobada: 3,
  rechazada: 2,
};

@Component({
  selector: 'app-iperc-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
    DynadrillButtonComponent,
    DynadrillPhaseTrackComponent,
  ],
  templateUrl: './iperc-list-page.html',
  styleUrl: './iperc-list-page.scss',
})
export class IpercListPage {
  private readonly ipercService = inject(IpercService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);

  protected readonly loading = signal(true);
  protected readonly matrices = signal<IpercMatrix[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.matrices();
    return [
      { label: 'Total IPERC', value: all.length },
      { label: 'En evaluación', value: all.filter(m => m.status === 'en_evaluacion').length },
      { label: 'En revisión', value: all.filter(m => m.status === 'en_revision').length },
      { label: 'Aprobadas', value: all.filter(m => m.status === 'aprobada').length },
    ];
  });

  /**
   * Sin fixed:'left'/'right' ni scrollX — mismo criterio que
   * maintenance-list-page.ts: nzScroll.x mide columnas con un renglón
   * oculto antes de que los componentes Angular (íconos, badges) terminen
   * de renderizar, y activa el pipeline de columnas fijas de nz-table
   * (NzResizeObserver + mergeMap interno) en cada tabla montada — con
   * cards/tablas en casi toda la app, eso es carga real que se acumula al
   * navegar. table-layout vuelve a "auto" y el scroll horizontal en móvil
   * lo da el wrapper .table-scroll en el HTML.
   */
  protected readonly columns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'actividad', header: 'Actividad', searchable: true },
    { key: 'ubicacion', header: 'Ubicación', searchable: true },
    { key: 'estadoBadge', header: 'Estado', type: 'badge', filters: STATUS_FILTERS },
    { key: 'faseIndex', header: 'Fase' },
    { key: 'riesgoBadge', header: 'Riesgo residual más alto', type: 'badge' },
  ]);

  protected readonly faseSteps = FASE_STEPS;
  protected readonly faseLabels = FASE_LABELS;

  protected readonly rows = computed(() =>
    this.matrices().map(m => ({
      id: m.id,
      code: m.code,
      // Si la matriz nació como solicitud desde un ticket operativo, se
      // muestra de dónde vino — HSE-PLAN-001 arranca de "una nueva actividad".
      actividad: m.origenOperativo ? `${m.actividad} · solicitada desde ${m.origenOperativo.ticketCode}` : m.actividad,
      ubicacion: m.ubicacion,
      estadoBadge: STATUS_BADGES[m.status],
      faseIndex: STATUS_INDEX[m.status],
      riesgoBadge: this.highestResidualBadge(m),
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  /**
   * Avisa al Técnico HSE (quien la levantó) cuando una matriz vuelve
   * rechazada — antes no había ninguna forma de que se enterara sin
   * entrar a cada matriz por su cuenta. Coordinador/Gerente HSE no la
   * necesitan: ellos mismos tomaron la decisión.
   */
  protected readonly notificationItems = computed<AppNotificationItem[]>(() => {
    if (this.auth.currentUser()?.roleName !== 'Técnico HSE') return [];
    return this.matrices()
      .filter(m => m.status === 'rechazada')
      .map(m => ({
        id: `iperc-rechazada-${m.id}`,
        title: `${m.code} rechazada`,
        description: m.rejectedReason ? `Motivo: ${m.rejectedReason}` : `Rechazada por ${m.rejectedByName ?? '—'}`,
        tone: 'error',
        link: `/dashboard/qhse/iperc/${m.id}`,
      }));
  });

  constructor() {
    this.reload();

    effect(() => this.notifications.setSource('iperc', this.notificationItems()));
    inject(DestroyRef).onDestroy(() => this.notifications.clearSource('iperc'));
  }

  private reload(): void {
    this.ipercService.list().subscribe({
      next: matrices => {
        this.matrices.set(matrices);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected nuevaMatriz(): void {
    const ref = this.dialogService.open<IpercMatrixDialog>({ title: 'Nueva matriz IPERC', content: IpercMatrixDialog, footer: false });
    ref.afterClose.subscribe(created => {
      if (created) this.router.navigate([created.id], { relativeTo: this.route });
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }

  /** Réplica imprimible de la matriz, formato DYN-SGI-RE-087 (GTC 45) — ver IpercMatrixPdfDialog. */
  protected imprimirMatriz(row: Record<string, unknown>): void {
    const matrix = this.matrices().find(m => m.id === row['id']);
    if (!matrix) return;
    this.dialogService.open<IpercMatrixPdfDialog, IpercMatrixPdfDialogData>({
      title: `Matriz IPERC ${matrix.code} — Vista de impresión`,
      content: IpercMatrixPdfDialog,
      data: { matrix },
      footer: false,
      width: '95vw',
    });
  }

  /**
   * Si algún peligro todavía no tiene riesgo residual evaluado, no se
   * calcula el máximo solo con los que sí lo tienen: eso podía mostrar
   * "Bajo" en la bandeja mientras un peligro sin evaluar resultaba ser el
   * más grave — un supervisor que aprueba mirando solo esta columna, sin
   * abrir el detalle, se llevaría una falsa sensación de seguridad.
   */
  private highestResidualBadge(matrix: IpercMatrix): { text: string; tone: BadgeTone } {
    const hazards = matrix.tasks.flatMap(t => t.hazards);
    if (hazards.length === 0) return { text: 'Sin evaluar', tone: 'neutral' };
    const nrs = hazards.map(h => calcularNR(h.riesgoResidual.nd, h.riesgoResidual.ne, h.riesgoResidual.nc));
    if (nrs.some(nr => nr == null)) {
      return { text: 'Evaluación incompleta', tone: 'warning' };
    }
    const { nivel, label } = interpretarNR(Math.max(...(nrs as number[])));
    return { text: `Nivel ${label}`, tone: RISK_TONE[nivel] };
  }
}
