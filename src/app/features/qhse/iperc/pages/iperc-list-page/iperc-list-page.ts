import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
} from '@digitec-it-projects/dynadrill-ui';
import { calcularNR, interpretarNR, IPERC_STATUS_LABELS, IpercMatrix, IpercStatus, NivelRiesgo } from '../../models/iperc.model';
import { IpercService } from '../../services/iperc.service';
import { IpercMatrixDialog } from '../../components/iperc-matrix-dialog';
import { IpercMatrixPdfDialog, IpercMatrixPdfDialogData } from '../../components/iperc-matrix-pdf-dialog';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
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
  imports: [PageHeader, KpiStat, DynadrillDataTableComponent, DynadrillIconButtonComponent, DynadrillButtonComponent],
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
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly matrices = signal<IpercMatrix[]>([]);

  /** Tarjetas de color (Figma): total en neutro, en evaluación en azul, en revisión en ámbar y aprobadas en verde. */
  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.matrices();
    return [
      { label: 'Actividades evaluadas', value: all.length, tone: 'neutral' },
      { label: 'En evaluación', value: all.filter(m => m.status === 'en_evaluacion').length, tone: 'info' },
      { label: 'En revisión', value: all.filter(m => m.status === 'en_revision').length, tone: 'warning' },
      { label: 'Aprobadas', value: all.filter(m => m.status === 'aprobada').length, tone: 'success' },
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
    { key: 'fase', header: 'Fase' },
    { key: 'riesgoBadge', header: 'Riesgo residual', type: 'badge' },
  ]);

  protected readonly rows = computed(() =>
    this.matrices().map(m => ({
      id: m.id,
      code: m.code,
      // Si la matriz nació como solicitud desde un ticket operativo, se
      // muestra de dónde vino — HSE-PLAN-001 arranca de "una nueva actividad".
      actividad: m.origenOperativo ? `${m.actividad} · solicitada desde ${m.origenOperativo.ticketCode}` : m.actividad,
      ubicacion: m.ubicacion,
      estadoBadge: STATUS_BADGES[m.status],
      fase: `${STATUS_INDEX[m.status] + 1} / ${FASE_STEPS}`,
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
    const ref = this.dialogService.open<IpercMatrixDialog>({ title: 'Agregar actividad a la Matriz Maestra', content: IpercMatrixDialog, footer: false });
    ref.afterClose.subscribe(created => {
      if (created) this.router.navigate([created.id], { relativeTo: this.route });
    });
  }

  protected viewDetail(row: Record<string, unknown>): void {
    this.router.navigate([String(row['id'])], { relativeTo: this.route });
  }

  /**
   * Si está Aprobada, la reabre (vuelve a "en_evaluacion" — mismo criterio
   * que "Editar matriz" en el detalle, ver IpercDetailPage.reopenForEdit())
   * antes de entrar, para no obligar a repetir el paso ahí adentro. En
   * cualquier otro estado ya es editable, así que solo navega.
   */
  protected editarMatriz(row: Record<string, unknown>): void {
    const matrix = this.matrices().find(m => m.id === row['id']);
    if (!matrix) return;
    if (matrix.status !== 'aprobada') {
      this.viewDetail(row);
      return;
    }
    this.ipercService.update(matrix.id, { status: 'en_evaluacion' }).subscribe({
      next: () => this.viewDetail(row),
      error: () => this.notify.error('Error', 'No se pudo reabrir la matriz para editarla. Inténtalo de nuevo.'),
    });
  }

  /** Réplica imprimible de la matriz, formato DYN-SGI-RE-087 (GTC 45) — ver IpercMatrixPdfDialog. */
  protected imprimirMatriz(row: Record<string, unknown>): void {
    const matrix = this.matrices().find(m => m.id === row['id']);
    if (!matrix) return;
    this.dialogService.open<IpercMatrixPdfDialog, IpercMatrixPdfDialogData>({
      title: `Matriz IPERC ${matrix.code} — Vista de impresión`,
      content: IpercMatrixPdfDialog,
      data: { matrices: [matrix] },
      footer: false,
      width: '95vw',
    });
  }

  /**
   * "Matriz general" — todas las matrices consolidadas en una sola tabla,
   * agrupadas por proceso y actividad (mismo IpercMatrixPdfDialog, con
   * varias matrices en vez de una). Igual que el archivo real: ahí
   * PROCESO/ACTIVIDAD son columnas planas de un solo registro para toda la
   * empresa, no una matriz por actividad (verificado contra las 325 filas
   * del DYN-SGI-RE-087 original).
   */
  protected verMatrizConsolidada(): void {
    const matrices = this.matrices();
    if (matrices.length === 0) return;
    this.dialogService.open<IpercMatrixPdfDialog, IpercMatrixPdfDialogData>({
      title: 'Matriz IPERC consolidada — todas las áreas',
      content: IpercMatrixPdfDialog,
      data: { matrices },
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
