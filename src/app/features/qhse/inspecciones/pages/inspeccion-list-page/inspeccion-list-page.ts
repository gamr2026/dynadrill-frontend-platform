import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillKpiRowComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  type DynadrillKpiRowItem,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { InspeccionEquipo, TIPO_EQUIPO_LABELS, inspeccionEnCuarentena, inspeccionVencida } from '../../models/inspeccion-equipo.model';
import { InspeccionEquipoService } from '../../services/inspeccion-equipo.service';
import { InspeccionEquipoDialog } from '../../components/inspeccion-equipo-dialog';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** HSE-SEGUIMIENTO-001 — bandeja de inspecciones, vigencias y cuarentena. */
@Component({
  selector: 'app-inspeccion-list-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillKpiRowComponent,
    DynadrillButtonComponent,
    DynadrillDataTableComponent,
    DynadrillSpinnerComponent,
    ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspeccion-list-page.html',
  styleUrl: './inspeccion-list-page.scss',
})
export class InspeccionListPage {
  private readonly inspeccionService = inject(InspeccionEquipoService);
  private readonly dialogService = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly inspecciones = signal<InspeccionEquipo[]>([]);

  protected readonly kpis = computed<DynadrillKpiRowItem[]>(() => {
    const all = this.inspecciones();
    return [
      { label: 'Total registradas', value: all.length },
      { label: 'Vigentes', value: all.filter(i => !inspeccionEnCuarentena(i) && !inspeccionVencida(i)).length },
      { label: 'Vencidas', value: all.filter(i => !inspeccionEnCuarentena(i) && inspeccionVencida(i)).length },
    ];
  });

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Código', sortable: true, searchable: true },
    { key: 'equipoCodigo', header: 'Equipo', searchable: true },
    {
      key: 'tipoLabel',
      header: 'Tipo',
      filters: Object.entries(TIPO_EQUIPO_LABELS).map(([, text]) => ({ text, value: text })),
    },
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'vigenciaHasta', header: 'Vigente hasta', sortable: true },
    {
      key: 'estadoBadge',
      header: 'Estado',
      type: 'badge',
      filters: [
        { text: 'Vigente', value: 'Vigente' },
        { text: 'Vencida', value: 'Vencida' },
        { text: 'En cuarentena', value: 'En cuarentena' },
      ],
    },
  ];

  protected readonly rows = computed(() =>
    this.inspecciones().map(i => {
      let estado: { text: string; tone: DynadrillTagVariant };
      if (inspeccionEnCuarentena(i)) estado = { text: 'En cuarentena', tone: 'error' };
      else if (inspeccionVencida(i)) estado = { text: 'Vencida', tone: 'warning' };
      else estado = { text: 'Vigente', tone: 'success' };

      return {
        id: i.id,
        code: i.code,
        equipoCodigo: i.equipoCodigo,
        tipoLabel: TIPO_EQUIPO_LABELS[i.tipo],
        fecha: formatDate(i.fecha),
        vigenciaHasta: formatDate(i.vigenciaHasta),
        estadoBadge: estado,
      };
    }),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.inspeccionService.list().subscribe({
      next: inspecciones => {
        this.inspecciones.set(inspecciones);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar las inspecciones.');
      },
    });
  }

  protected nuevaInspeccion(): void {
    const ref = this.dialogService.open<InspeccionEquipoDialog>({ title: 'Nueva inspección de equipo', content: InspeccionEquipoDialog, footer: false });
    ref.afterClose.subscribe(result => {
      if (result) this.reload();
    });
  }
}
