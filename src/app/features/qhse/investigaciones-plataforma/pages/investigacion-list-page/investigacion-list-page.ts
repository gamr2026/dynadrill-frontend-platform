import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCardAccent,
  DynadrillCardComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { injectNarrowViewport } from '../../../../../core/utils/narrow-viewport.util';
import { KpiStat, type KpiStatTone } from '../../../../../shared/components/kpi-stat/kpi-stat';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import {
  QhseRegistrosMovil,
  type RegistroMovil,
} from '../../../shared/components/qhse-registros-movil';
import { InvestigacionNuevaDialog } from '../../components/investigacion-nueva-dialog';
import {
  ESTADO_INVESTIGACION_ETIQUETA,
  ESTADOS_INVESTIGACION,
  PERMISO_INVESTIGACIONES_GESTIONAR,
  conPlazoVencido,
  textoDePlazo,
  type InvestigacionFila,
} from '../../models/investigacion';
import { InvestigacionPlataformaService } from '../../services/investigacion.service';

/** Cuántas tarjetas se muestran de entrada — «Mostrar más» suma otra tanda. */
const PAGE_SIZE = 12;

const TODOS_OPTION: DynadrillSelectOption = { label: 'Todos los estados', value: '' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Bandeja de investigaciones de incidentes (HSE-TRIAGE-002) del contenedor `qhse`: KPI, búsqueda por código o ubicación, filtro de estado y
 * tarjetas con el plazo que queda (los plazos los calcula el backend con el resultado del incidente). Mismo diseño de la pestaña
 * «Investigaciones» de la bandeja de la demo.
 */
@Component({
  selector: 'app-investigacion-plataforma-list-page',
  imports: [
    PageHeader,
    KpiStat,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillIconComponent,
    DynadrillButtonComponent,
    DynadrillBannerComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    QhseRegistrosMovil,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './investigacion-list-page.html',
  styleUrl: './investigacion-list-page.scss',
})
export class InvestigacionPlataformaListPage {
  private readonly service = inject(InvestigacionPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isMobile = injectNarrowViewport();
  protected readonly loading = signal(true);
  protected readonly investigaciones = signal<InvestigacionFila[]>([]);
  protected readonly puedeGestionar = computed(() =>
    this.auth.can(PERMISO_INVESTIGACIONES_GESTIONAR),
  );

  // Búsqueda, filtro de estado y paginación
  protected readonly searchText = signal('');
  protected readonly estadoFiltro = signal('');
  protected readonly visibleCount = signal(PAGE_SIZE);

  protected readonly estadoOptions: DynadrillSelectOption[] = [
    TODOS_OPTION,
    ...ESTADOS_INVESTIGACION.map((e) => ({ label: ESTADO_INVESTIGACION_ETIQUETA[e], value: e })),
  ];

  protected readonly kpis = computed<{ label: string; value: number; tone: KpiStatTone }[]>(() => {
    const all = this.investigaciones();
    return [
      { label: 'Total', value: all.length, tone: 'neutral' },
      { label: 'Abiertas', value: all.filter((i) => i.estado !== 'cerrada').length, tone: 'brand' },
      {
        label: 'Plazo vencido',
        value: all.filter((i) => conPlazoVencido(i)).length,
        tone: 'error',
      },
      {
        label: 'Acciones pendientes',
        value: all.reduce((suma, i) => suma + i.accionesPendientes, 0),
        tone: 'warning',
      },
    ];
  });

  protected readonly cards = computed(() =>
    this.investigaciones().map((i) => {
      const vencida = conPlazoVencido(i);
      const accent: DynadrillTagVariant & DynadrillCardAccent =
        i.estado === 'cerrada' ? 'success' : vencida ? 'error' : 'warning';
      return {
        id: i.id,
        code: i.codigo,
        resultadoLabel: i.resultado.nombre,
        ubicacion: i.ubicacion || '—',
        fechaIncidente: formatDate(i.fechaIncidente),
        estado: i.estado,
        estadoLabel: ESTADO_INVESTIGACION_ETIQUETA[i.estado],
        accent,
        plazoLabel: textoDePlazo(i),
        accionesPendientes: i.accionesPendientes,
      };
    }),
  );

  private readonly filtradas = computed(() => {
    const q = this.searchText().trim().toLowerCase();
    const estado = this.estadoFiltro();
    return this.cards().filter((c) => {
      const coincide =
        !q || c.code.toLowerCase().includes(q) || c.ubicacion.toLowerCase().includes(q);
      return coincide && (!estado || c.estado === estado);
    });
  });
  protected readonly visibles = computed(() => this.filtradas().slice(0, this.visibleCount()));
  protected readonly mostrandoTodo = computed(() => this.visibleCount() >= this.filtradas().length);

  /** Tarjetas de la lista en móvil (Figma "M · Incidentes y Emergencias"). */
  protected readonly itemsMovil = computed<RegistroMovil[]>(() =>
    this.visibles().map((i) => ({
      id: i.id,
      eyebrow: i.code,
      title: i.resultadoLabel,
      subtitle: `${i.ubicacion} · ${i.fechaIncidente}`,
      status: { text: i.estadoLabel, tone: 'neutral' as const },
      fields: [
        {
          label: 'Plazo',
          value: i.plazoLabel,
          tone:
            i.accent === 'error'
              ? ('error' as const)
              : i.accent === 'warning'
                ? ('warning' as const)
                : ('success' as const),
        },
        ...(i.accionesPendientes > 0
          ? [{ label: 'Acciones pendientes', value: String(i.accionesPendientes) }]
          : []),
      ],
      actions: [
        { icon: 'eye', label: 'Ver detalle', primary: true, run: () => this.verDetalle(i.id) },
      ],
    })),
  );

  constructor() {
    this.service.listar().subscribe({
      next: (bandeja) => {
        this.investigaciones.set(bandeja.items);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error('Error', mensajeDeError(e, 'No se pudieron cargar las investigaciones.'));
      },
    });
  }

  protected setSearchText(value: string): void {
    this.searchText.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected setEstadoFiltro(value: string): void {
    this.estadoFiltro.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  protected mostrarMas(): void {
    this.visibleCount.update((v) => v + PAGE_SIZE);
  }

  protected verDetalle(id: string): void {
    this.router.navigate(['/dashboard/qhse/investigaciones', id]);
  }

  /** Vía directa de apertura (sin emergencia formal): daño material significativo o Near Miss con alto potencial. */
  protected nuevaInvestigacion(): void {
    const ref = this.dialogService.open<InvestigacionNuevaDialog>({
      title: 'Nueva investigación',
      content: InvestigacionNuevaDialog,
      footer: false,
    });
    ref.afterClose.subscribe((inv) => {
      if (inv) this.router.navigate(['/dashboard/qhse/investigaciones', inv.id]);
    });
  }
}
